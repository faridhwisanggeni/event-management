import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmService } from '../../../llm/llm.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ScoreMatchInput {
  candidate_id: string;
  intent: string;
}

export interface ScoreMatchResult {
  candidate_id: string;
  score: number;
  rationale: string;
  shared_ground: string[];
  source: 'fastapi' | 'fallback';
}

@Injectable()
export class ScoreMatchTool {
  private readonly logger = new Logger(ScoreMatchTool.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async run(
    input: ScoreMatchInput,
    ctx: { askerAttendeeId: string },
  ): Promise<ScoreMatchResult> {
    const [asker, candidate] = await Promise.all([
      this.prisma.attendee.findUnique({ where: { id: ctx.askerAttendeeId } }),
      this.prisma.attendee.findUnique({ where: { id: input.candidate_id } }),
    ]);

    if (!candidate) {
      return {
        candidate_id: input.candidate_id,
        score: 0,
        rationale: 'Candidate not found.',
        shared_ground: [],
        source: 'fallback',
      };
    }

    const url = this.config.get<string>('SCORE_MATCH_URL');
    if (url) {
      try {
        const res = await fetch(`${url.replace(/\/$/, '')}/score`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ asker, candidate, intent: input.intent }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          const body = (await res.json()) as Omit<ScoreMatchResult, 'candidate_id' | 'source'>;
          return { candidate_id: input.candidate_id, ...body, source: 'fastapi' };
        }
        this.logger.warn({ msg: 'score_match.http_error', status: res.status });
      } catch (err) {
        this.logger.warn({ msg: 'score_match.fetch_failed', err: (err as Error).message });
      }
    }

    return this.fallback(input, asker, candidate);
  }

  private async fallback(
    input: ScoreMatchInput,
    asker: Awaited<ReturnType<PrismaService['attendee']['findUnique']>>,
    candidate: NonNullable<Awaited<ReturnType<PrismaService['attendee']['findUnique']>>>,
  ): Promise<ScoreMatchResult> {
    if (!this.llm.isEnabled()) {

      const overlap = (asker?.skills ?? []).filter((s) => candidate.skills.includes(s));
      return {
        candidate_id: candidate.id,
        score: overlap.length ? 60 : 30,
        rationale: 'LLM disabled — using naive skill-overlap heuristic.',
        shared_ground: overlap.map((s) => `Both work with ${s}`),
        source: 'fallback',
      };
    }

    const { completion } = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content:
            'You score how well CANDIDATE matches the ASKER intent. ' +
            'Reply with strict JSON: {"score": int 0-100, "rationale": str, "shared_ground": str[]}. ' +
            'No prose outside JSON.',
        },
        {
          role: 'user',
          content: JSON.stringify({ intent: input.intent, asker, candidate }),
        },
      ],
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    try {
      const parsed = JSON.parse(raw) as {
        score: number;
        rationale: string;
        shared_ground: string[];
      };
      return {
        candidate_id: candidate.id,
        score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
        rationale: String(parsed.rationale ?? ''),
        shared_ground: Array.isArray(parsed.shared_ground) ? parsed.shared_ground.map(String) : [],
        source: 'fallback',
      };
    } catch {
      return {
        candidate_id: candidate.id,
        score: 0,
        rationale: 'Scoring failed to parse.',
        shared_ground: [],
        source: 'fallback',
      };
    }
  }
}
