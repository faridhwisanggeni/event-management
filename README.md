# Event Management Platform

A full-stack event & attendee management application.

## Minimum Requirement
1. You should have docker for running this application.
2. You should have knowledge about javascript, python and dockerization technology to use this application.


## Repo layout

```
event-management/
├── docker-compose.yml    ← postgres + api + web + score-match (single-command boot)
├── README.md             ← this file (overview, quickstart, ops)
├── ARCHITECTURE.md       ← stack justification, agent design, scaling, PII
├── event-be/             ← NestJS API (Prisma + Postgres + OpenAI)
│   ├── src/concierge/    ← AI Networking Concierge agent + tools
│   ├── prisma/           ← schema + migrations (pgvector)
│   └── test/             ← unit specs + concierge.e2e-spec.ts
├── event-fe/             ← Next.js 14 dashboard (Tailwind + shadcn/ui)
│   └── src/app/          ← /events and /attendees routes
└── score-match/          ← Python FastAPI scoring microservice
    └── app/scoring.py    ← deterministic 0-100 match scorer
```

## Quickstart

The whole stack boots with one command. Migrations run automatically on the
API container's startup.

```bash
docker compose up --build
```

You can use this command for restarting (will be drop data), I will recomended this command.
If you don't want to drop the data you can remove -v

```bash
docker compose up -v && docker compose up --build
```

Note :

- **Web UI** → http://localhost:3000
- **API**    → http://localhost:3001/api/v1
- **Postgres** → `localhost:5432`, user `eventmgmt`, db `eventmgmt`
- **Score Match API** → http://localhost:8000

## Required environment

The agent only "comes alive" when `OPENAI_API_KEY` is set. Without it the
system still serves CRUD, and the concierge endpoint returns a friendly
"LLM is offline" stub instead of crashing.

```bash
# .env at repo root (copy from .env.example if present)
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini          # default
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMS=1536
SCORE_MATCH_URL=http://score-match:8000
DATABASE_URL=postgresql://eventmgmt:eventmgmt@postgres:5432/eventmgmt?schema=public
```

---

## Architecture (high level)

```mermaid
flowchart LR
  user([Attendee]) -->|HTTP| fe[Next.js UI<br/>:3000]
  fe -->|REST /api/v1| be[NestJS API<br/>:3001]
  be -->|Prisma| pg[(Postgres + pgvector)]
  be -->|tool calls| openai[OpenAI<br/>chat + embeddings]
  be -->|HTTP /score| sm[FastAPI<br/>score-match :8000]
  classDef svc fill:#eef,stroke:#446;
  class fe,be,sm svc;
```

- **Single Postgres** holds events, attendees (with `embedding vector(1536)`),
  concierge sessions, every concierge message (USER/ASSISTANT/TOOL), and
  feedback rows.
- **Concierge agent** lives inside the NestJS process. It uses OpenAI's
  **native tool calling** (no regex parsing) to dispatch three tools:
  `search_attendees` (semantic + keyword via pgvector), `score_match`
  (delegated to the Python service), `draft_intro_message`.
- **score-match** is a small FastAPI app — extracted so the scoring algorithm
  can evolve independently (rule-based today, cross-encoder later) without
  touching the agent. See `score-match/README.md` for the contract.

Full stack-justification, scaling notes, and PII discussion are in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

### Concierge turn — sequence

```mermaid
sequenceDiagram
  participant C as Client
  participant N as NestJS<br/>ConciergeService
  participant A as AgentRunner
  participant L as OpenAI
  participant DB as Postgres
  participant S as score-match
  C->>N: POST /events/:id/concierge/messages
  N->>DB: upsert ConciergeSession + persist USER msg
  N->>A: run(history, userMessage)
  loop max 6 iterations
    A->>L: chat.completions(messages, tools)
    L-->>A: assistant + tool_calls
    A->>DB: persist ASSISTANT msg (tokens, latency)
    alt tool = search_attendees
      A->>DB: pgvector cosine + filters
    else tool = score_match
      A->>S: POST /score
      S-->>A: { score, rationale, shared_ground }
    else tool = draft_intro_message
      A->>L: chat.completions (no tools)
    end
    A->>DB: persist TOOL result
  end
  A-->>N: finalText + matches
  N->>DB: persist final ASSISTANT (matches JSON)
  N-->>C: { session_id, message_id, reply, matches }
```

---

## Running the tests

| Layer | Command | What it covers |
|---|---|---|
| NestJS unit | `cd event-be && npm test` | services (events, attendees), `AgentRunner` tool-loop |
| NestJS e2e  | `cd event-be && npm run test:e2e` | full HTTP turn through agent + persistence + prompt-injection guard (mocked LLM) |
| score-match | `cd score-match && pytest` | scoring algorithm + FastAPI contract |

All three are wired into GitHub Actions — see
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml). Every PR runs
lint + unit + e2e + a smoke build of all three Docker images.

The e2e test is the spec-mandated *"end-to-end test that exercises a full
concierge conversation (mock the LLM)"*. It boots the real Nest app via
`@nestjs/testing`, overrides `LlmService` and `PrismaService`, then drives a
4-step search → score → draft → reply turn through `supertest`.

A second case in the same file verifies the prompt-injection hardening: an
attendee bio containing *"ignore previous instructions"* must (a) be passed
to the LLM with a system prompt that explicitly classifies bios as DATA, and
(b) get persisted verbatim for audit but never echoed back as the agent's
reply.

---

## Observability

Every request gets a `X-Request-Id` (echoed in the response header and on
every log line via `nestjs-pino`'s `genReqId`). Each LLM call records:

- `latencyMs`
- `promptTokens`, `completionTokens`
- `toolNames` invoked
- `model`

These are emitted as a structured log line `concierge.llm.chat.completed`
with the request-id attached, so a single concierge turn is one trace.

### Wiring to CloudWatch / Azure Monitor

Pino emits JSON to stdout — both clouds pick that up natively from a
container's log driver, so **no app-side change is needed**:

- **AWS** — run the container on ECS Fargate with `awslogs` log driver.
  CloudWatch Logs Insights query for a single turn:
  ```
  fields @timestamp, reqId, msg, latencyMs, promptTokens
  | filter msg = "concierge.llm.chat.completed"
  | sort @timestamp asc
  ```
  For metrics, install `pino-cloudwatch` or use a Lambda subscription that
  forwards `latencyMs` and token counts as custom CloudWatch Metrics
  (dimensions: `model`, `tool`).
- **Azure** — App Service / Container Apps streams stdout to **Log
  Analytics**. Use a Kusto query on `ContainerLog_CL` with the same
  `reqId` correlation.

Trace propagation (OpenTelemetry) was intentionally deferred — see
trade-offs below.

---

## Trade-offs and "what I'd do with more time"

**What I cut on purpose:**

- **No auth / no tenant scoping.** The spec doesn't require it and adding
  proper auth would have eaten the time I spent on the agent. In production
  this is the *first* thing I'd add — at minimum a per-event API key on
  registration, and an `attendee_id` cookie or signed JWT for the concierge
  endpoint so people can't impersonate each other.
- **Rate limiting is per-IP, not per-LLM-call-budget.** `@nestjs/throttler`
  caps HTTP rate at 20 req/s burst, 300/min sustained per IP. There is *no*
  per-event LLM-spend cap. With $5 of GPT-4o-mini you can run ~5k turns,
  which is plenty for the demo, but a real deployment needs a token-bucket
  keyed on `eventId`.
- **No per-attendee message edit / re-embed.** If an attendee updates their
  bio, the embedding becomes stale. The "Rebuild embeddings" admin button
  papers over this for now. A proper solution is a Prisma middleware that
  enqueues a re-embed job whenever a profile field changes.
- **score-match scorer is rule-based, not learned.** It uses a 5-feature
  weighted sum (role complement, skill overlap, intent term overlap,
  open-to-chat baseline, seniority conflict). With a labelled dataset I'd
  swap to a small cross-encoder; the FastAPI contract was designed to make
  that a one-line code change.
- **Agent state persistence is "replay all messages each turn".** Cheap to
  build, correct, but wasteful at long horizons. With more time I'd add a
  rolling summary every N turns (the system prompt already supports it; the
  schema has the columns).
- **No OpenTelemetry / distributed tracing.** Pino + request-id covers 90%
  of the debug value; OTEL spans across NestJS → score-match → OpenAI would
  be the next step.
- **Eval harness deferred.** The spec calls one out and I agree it's the
  highest-signal artefact for an AI role; design is sketched in
  `ARCHITECTURE.md` (§ "What an evaluation looks like") but not built.
  This is the single most valuable thing I'd ship with one more day.

**Hard no-gos I actively defended against:**

- **No raw SQL concatenation.** All `$queryRawUnsafe` / `$executeRawUnsafe`
  call sites use parameter placeholders (`$1::uuid`, `$2::vector`).
- **No prompt injection escape.** System prompt explicitly classifies
  attendee bios and user messages as DATA. Verified with a dedicated e2e
  test (`concierge.e2e-spec.ts` → "treats prompt-injection inside attendee
  bios as data").
- **No API keys in repo.** `.env` is gitignored; `.env.example` documents
  the required variables.

---

## AI assistants used (honesty disclosure)

I used **Cascade (Windsurf)** with Claude Sonnet 4.5 throughout this
project as a pair-programmer — primarily for:

- Scaffolding repetitive boilerplate (Nest controllers/DTOs, shadcn UI
  components, OpenAPI-style schemas for tool calls).
- Reviewing my Prisma schema for indexes I'd missed (the `(eventId, roleId)`
  composite came from a Cascade suggestion).
- Drafting this README and `ARCHITECTURE.md` from bullet-point notes.
- Debugging the e2e test's UUID-validation failure (ParseUUIDPipe defaults
  to v4; my hand-rolled UUIDs had version digit `1`).

Every architectural decision and every line that ships is reviewed by me
before commit. The concierge prompt, tool schemas, and scoring algorithm
were designed by hand — Cascade sped up the keystrokes, not the thinking.

---

## Submission notes

**What I'm most proud of:** the clean separation between *agent
orchestration*, *tool implementations*, and *scoring*. `AgentRunner` knows
nothing about Postgres or OpenAI specifics; tools own their dependencies;
scoring lives in its own Python service behind a stable contract. That's
what made it possible to ship the prompt-injection e2e test without any
network or DB — I just swap the providers via Nest's DI. The same seam will
let me replace rule-based scoring with a cross-encoder later without
touching the agent or the prompt.

**Biggest trade-off:** I built scoring as a deterministic rule-based scorer
instead of an LLM-as-judge or a learned model. Pros: free, sub-millisecond,
unit-testable, makes the agent reproducible across runs. Cons: it's only as
good as the heuristics — it will rank a senior backend engineer slightly
below an exact-keyword match in the bio, even when the senior is the better
human introduction. The fallback path to the LLM scorer is wired but
unused. Given more time I'd run an eval harness on 50 hand-labelled
intent/match pairs, then decide whether to keep heuristics, swap to a
cross-encoder, or use the LLM for the top-3 only.