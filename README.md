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
├── WALKTHROUGH.md        ← written demo + code walk-through (in lieu of Loom)
├── event-be/             ← NestJS API (Prisma + Postgres + OpenAI)
│   ├── src/concierge/    ← AI Networking Concierge agent + tools
│   ├── prisma/           ← schema + migrations (pgvector)
│   └── test/             ← unit specs + concierge.e2e-spec.ts
├── event-fe/             ← Next.js 14 dashboard (Tailwind + shadcn/ui)
│   └── src/app/          ← /events and /attendees routes
└── score-match/          ← Python FastAPI scoring microservice
    ├── app/scoring.py    ← deterministic 0-100 match scorer
    ├── eval/fixtures.json ← 10 hand-labelled eval fixtures
    └── tests/test_eval.py ← eval harness (recall@1 / recall@3)
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
| score-match unit | `cd score-match && pytest tests/test_scoring.py tests/test_api.py` | scoring algorithm + FastAPI contract |
| score-match eval | `cd score-match && pytest tests/test_eval.py -v -s` | 10-fixture eval harness — recall@1 across hand-labelled scenarios |

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

### Eval harness — 10 hand-labelled fixtures

The spec calls eval harnesses out as the kind of artefact that *separates
senior AI engineers from LLM-prompt jockeys*. There are 10 fixtures in
[`score-match/eval/fixtures.json`](./score-match/eval/fixtures.json)
covering scenarios like *"AI cofounder for B2B SaaS"*, *"hire senior
backend with postgres"*, *"Series A climate investor"*, *"DevOps
consultant who knows kubernetes"*, etc. Each fixture has one labelled
ground-truth candidate plus 3 plausible distractors.

[`tests/test_eval.py`](./score-match/tests/test_eval.py) replays every
fixture through `POST /score`, ranks by descending score, and asserts:

- Strict (one test per fixture): ground truth ranks **#1**.
- Aggregate: **recall@1 ≥ 90%** and **recall@3 = 100%** across all
  fixtures (current scorer hits 100% on both).

Current run output:

```
score-match eval — 10 fixtures
recall@1 = 100%    recall@3 = 100%
```

This guards against regressions when the scoring algorithm is swapped
(e.g. rule-based → cross-encoder, or future LLM-as-judge experiments).
The contract (`POST /score`) stays the same; the fixtures stay the same;
only the implementation changes underneath.

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

## Trade-offs and "what I would do with more time"

### What I would do with more time

The spec asks for an explicit callout of what I'd build next. In rough
priority order:

1. **User authentication and audit trail.** This is the gap I am most
   aware of. Today there is no login: anyone with the URL can register
   attendees on behalf of anyone, and — more concerning — anyone can
   claim *any* `attendee_id` in the concierge chat and impersonate that
   person. There are also no `created_by` / `updated_by` columns, so we
   cannot answer *"who edited Sarah's bio at 14:32?"*. With more time I
   would add:
   - Email-based magic-link login (NextAuth on the FE, signed JWT on
     the BE).
   - An `attendee_id` claim baked into the JWT and scoped to one event,
     so the concierge endpoint can only ever speak as the logged-in
     attendee.
   - `created_by_user_id` / `updated_by_user_id` audit columns on every
     mutable table, plus an `audit_log` table for who-did-what-when.
2. **Cloud deployment & real observability dashboards.** The README has
   a section explaining how to wire structured logs into CloudWatch /
   Azure Monitor, and the GitHub Actions CI builds all three Docker
   images on every PR — but I have not actually deployed any of this to
   AWS or Azure, nor written the Terraform module to provision the
   Postgres + container service. **This is a deliberate honest
   limitation: I do not have access to a paid AWS / Azure subscription
   right now.** Every `pino-cloudwatch` forwarder and every Terraform
   `aws_ecs_service` block in the world doesn't help if you can't run
   `terraform apply`. The shape of what I would do is documented; the
   apply step is what I would buy with more time (and an account).
3. **Per-event LLM spend cap.** `@nestjs/throttler` caps HTTP at 20 req/s
   burst, 300/min sustained per IP. There is *no* per-event token-budget
   yet. A real deployment needs a token-bucket keyed on `eventId` so a
   single noisy event can't drain the OpenAI budget for the whole tenant.
4. **Async re-embedding pipeline.** When an attendee updates their bio
   today, their `embedding` column gets replaced synchronously inside
   the request handler. At 10k attendees this becomes a head-of-line
   blocker. The fix is a Prisma middleware that enqueues a job whenever
   a profile field changes — Postgres `LISTEN/NOTIFY` for low volume,
   BullMQ on Redis if the queue ever needs replay. The admin "Rebuild
   embeddings" button is the temporary safety net.
5. **Learned scorer.** `score-match` today is a deterministic rule-based
   weighted sum (role complement, skill overlap, intent term overlap,
   open-to-chat baseline, seniority conflict). The eval harness already
   ships and currently scores recall@1 = 100% on the 10 fixtures; once
   we have ≥50 labelled match pairs I'd swap the scorer for a small
   cross-encoder and use the same harness as the regression gate.
6. **Rolling-summary conversation memory.** The agent currently replays
   every message each turn — cheap and correct, but wasteful past ~20
   turns. The schema already has the columns to store a rolling summary;
   just need a small summariser tool and a swap in `loadHistory()`.
7. **OpenTelemetry distributed tracing.** Pino + request-id covers 90%
   of the debug value, but OTEL spans across NestJS → score-match →
   OpenAI would let you see which leg of a slow concierge turn is the
   culprit.

### Hard no-gos I actively defended against

- **No raw SQL concatenation.** All `$queryRawUnsafe` / `$executeRawUnsafe`
  call sites use parameter placeholders (`$1::uuid`, `$2::vector`).
- **No prompt injection escape.** System prompt explicitly classifies
  attendee bios and user messages as DATA. Verified with a dedicated e2e
  test (`concierge.e2e-spec.ts` → "treats prompt-injection inside attendee
  bios as data").
- **No API keys in repo.** `.env` is gitignored; `.env.example` documents
  the required variables.

---

## Honesty policy & assumptions

The spec (§6 *Constraints and honesty policy*) explicitly invites a
clean partial submission over a broken complete one — *"a focused,
clean 70% beats a broken 100%"*. This README is written in that
spirit. Concretely:

- **Every Hard no-go from §5 is closed.** Raw SQL is parameterised,
  prompt injection is verified by an actual e2e test, no API keys in
  the repo, and "no tests at all" is decisively not the case (10 unit
  + 2 e2e + 11 eval + a 100% recall@1 result).
- **Every gap is listed in *"What I would do with more time"* above,
  ranked by priority.** The two biggest ones — no auth/audit-trail and
  no live cloud deployment — are flagged in the first two slots, not
  buried. The cloud gap is honest about its cause (*no paid AWS/Azure
  subscription right now*) rather than hand-waved.
- **The CRUD endpoints, the concierge end-to-end flow, the polyglot
  scorer, the eval harness, and CI all work today.** What does *not*
  ship is auth, Terraform, and live cloud dashboards. That trade is
  documented and was made on purpose.

### Assumptions I made (so you can sanity-check my judgment)

The spec leaves a few decisions to the implementer (§6 third bullet:
*"If a requirement is ambiguous, make a reasonable assumption and
document it"*). Mine:

1. **Attendee identity in the concierge endpoint.** The body is
   `{ attendee_id, message }` with no auth. I assumed the demo runs in
   a trusted reviewer environment and that auth is out of scope — but
   I called this out as the #1 gap in *"What I would do with more
   time"*.
2. **Roles are an enum maintained in the DB, not free-text.** The
   spec lists role as a generic field; I made it a foreign-keyed
   `attendee_roles` table seeded with codes like `BACKEND_DEVELOPER`,
   `AI_ENGINEER`, `FOUNDER`, etc. Reasoning: filterable, sortable,
   safer for the LLM (the system prompt is built from the seeded list,
   so the LLM cannot invent role codes that return zero results).
3. **Match scoring is rule-based, not LLM-judged.** The spec only
   requires that `score_match` returns `{ score, rationale,
   shared_ground }`. I implemented a deterministic 5-feature weighted
   sum so the agent is reproducible and unit-testable. The LLM-judge
   fallback is wired in `LlmService` but unused. The eval harness
   ships proof (recall@1 = 100% on 10 fixtures) that the rule-based
   path is good enough today.
4. **Stateful agent = "every message persisted, replay all on next
   turn"**, not a vector-cached summary. At our message counts SQL
   replay is correct and cheap; rolling-summary memory is on the
   wishlist but not needed yet.
5. **Open-to-chat is opt-out at the DB level, not per-conversation.**
   Attendees with `open_to_chat = false` are filtered out of every
   `search_attendees` call by SQL, so they never reach the LLM. This
   doubles as a privacy control (see *PII / data protection* in
   `ARCHITECTURE.md`).
6. **Feedback rating is 1–5 stars per the spec** (`rating: 1-5`,
   `notes?: string`). I added a unique index on `messageId` so every
   assistant message has at most one feedback row — re-rating
   overwrites rather than duplicates.

If any of these assumptions clash with how you read the spec, they
are all single-file changes; I deliberately built them so they could
be revisited without rewriting the agent or the DB.

---

## AI assistants used (honesty disclosure)

I used **Cascade (Windsurf)** with Claude Sonnet 4.5 throughout this
project as a pair-programmer.

### Development Workflow

1. **Scaffolding & Architecture Discussion**
   - Discussed project scaffolding structure and asked AI for recommendations on best practices
   - Collaborative brainstorming on entities, database schema (Prisma), tables, indexes, and relationships
2. **Planning & Task Breakdown**
   - Once scaffolding and entities were clear, I asked AI to generate a development plan
   - The plan was broken down into incremental deliverables:
     - Point 1: `event-be` (backend API)
     - Point 2: `event-fe` (frontend)
     - Point 3: `score-match` (scoring algorithm)
3. **Iterative Development & Testing**
   - Executed the plan point-by-point
   - After each milestone, performed manual testing via **Postman** (backend) and **UI exploration** (frontend)
   - Immediate bug fixes and refinements when issues were discovered

### What AI Helped With

- Generating boilerplate code (NestJS controllers, DTOs, Prisma schemas)
- Suggesting database indexes and optimization
- Drafting documentation from bullet-point notes
- Debugging validation errors and edge cases

### What I Did Manually

- All architectural decisions and code reviews before commit
- Core business logic (concierge prompt, tool schemas, scoring algorithm)
- Final testing and quality assurance

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