import { Injectable } from '@nestjs/common';

import { LlmService } from '../../../llm/llm.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface DraftIntroInput {
  candidate_id: string;
  context: string;
}

export interface DraftIntroResult {
  candidate_id: string;
  message: string;
}

@Injectable()
export class DraftIntroTool {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async run(
    input: DraftIntroInput,
    ctx: { askerAttendeeId: string },
  ): Promise<DraftIntroResult> {
    const [asker, candidate] = await Promise.all([
      this.prisma.attendee.findUnique({ where: { id: ctx.askerAttendeeId } }),
      this.prisma.attendee.findUnique({ where: { id: input.candidate_id } }),
    ]);

    if (!candidate || !asker) {
      return { candidate_id: input.candidate_id, message: '' };
    }

    if (!this.llm.isEnabled()) {
      return {
        candidate_id: candidate.id,
        message: `Hi ${candidate.name} — I'm ${asker.name}. ${input.context}`.trim(),
      };
    }

    const { completion } = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content:
            'Draft a short (max 4 sentences), warm, specific outreach DM from ASKER to CANDIDATE. ' +
            'Reference one concrete shared point. No greetings like "I hope this finds you well". ' +
            'Return only the message body, no quotes.',
        },
        {
          role: 'user',
          content: JSON.stringify({ asker, candidate, context: input.context }),
        },
      ],
      temperature: 0.5,
    });

    return {
      candidate_id: candidate.id,
      message: (completion.choices[0]?.message?.content ?? '').trim(),
    };
  }
}
