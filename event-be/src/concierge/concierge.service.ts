import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConciergeMessage, ConciergeRole, Prisma } from '@prisma/client';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRunner } from './agent/agent.runner';

export interface ConciergeTurnResponse {
  session_id: string;
  message_id: string;
  reply: string;
  matches: unknown;
}

@Injectable()
export class ConciergeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly agent: AgentRunner,
  ) {}

  async postMessage(
    eventId: string,
    attendeeId: string,
    userMessage: string,
  ): Promise<ConciergeTurnResponse> {
    const attendee = await this.prisma.attendee.findUnique({ where: { id: attendeeId } });
    if (!attendee || attendee.eventId !== eventId) {
      throw new NotFoundException('Attendee not found in this event');
    }
    if (!userMessage.trim()) {
      throw new BadRequestException('message must not be empty');
    }

    const session = await this.prisma.conciergeSession.upsert({
      where: { eventId_attendeeId: { eventId, attendeeId } },
      create: { eventId, attendeeId },
      update: {},
    });

    await this.prisma.conciergeMessage.create({
      data: {
        sessionId: session.id,
        role: ConciergeRole.USER,
        content: userMessage,
      },
    });

    if (!this.llm.isEnabled()) {
      const stub = await this.prisma.conciergeMessage.create({
        data: {
          sessionId: session.id,
          role: ConciergeRole.ASSISTANT,
          content:
            'LLM is not configured (set OPENAI_API_KEY). The concierge agent is offline; ' +
            'CRUD endpoints still work.',
        },
      });
      return {
        session_id: session.id,
        message_id: stub.id,
        reply: stub.content!,
        matches: null,
      };
    }

    const history = await this.loadHistory(session.id);
    const turn = await this.agent.run(history, userMessage, {
      eventId,
      askerAttendeeId: attendeeId,
    });

    let finalMessage: ConciergeMessage | null = null;
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < turn.newMessages.length; i++) {
        const m = turn.newMessages[i];
        const isFinalAssistant = m.role === 'ASSISTANT' && i === turn.newMessages.length - 1;

        if (m.role === 'ASSISTANT') {
          const created = await tx.conciergeMessage.create({
            data: {
              sessionId: session.id,
              role: ConciergeRole.ASSISTANT,
              content: m.content,
              toolCalls: (m.toolCalls as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              promptTokens: m.promptTokens,
              completionTokens: m.completionTokens,
              latencyMs: m.latencyMs,
              matches: isFinalAssistant ? (turn.matches as Prisma.InputJsonValue) : Prisma.JsonNull,
            },
          });
          if (isFinalAssistant) finalMessage = created;
        } else {
          await tx.conciergeMessage.create({
            data: {
              sessionId: session.id,
              role: ConciergeRole.TOOL,
              toolCallId: m.toolCallId,
              toolName: m.toolName,
              content: m.content,
            },
          });
        }
      }
    });

    if (!finalMessage) {
      throw new Error('agent_produced_no_assistant_message');
    }
    const fm = finalMessage as ConciergeMessage;
    return {
      session_id: session.id,
      message_id: fm.id,
      reply: turn.finalText,
      matches: turn.matches,
    };
  }

  async upsertFeedback(
    eventId: string,
    messageId: string,
    rating: number,
    notes: string | undefined,
  ) {
    const message = await this.prisma.conciergeMessage.findUnique({
      where: { id: messageId },
      include: { session: true },
    });
    if (!message || message.session.eventId !== eventId) {
      throw new NotFoundException('Message not found in this event');
    }
    if (message.role !== ConciergeRole.ASSISTANT) {
      throw new BadRequestException('Only assistant messages can receive feedback');
    }

    return this.prisma.feedback.upsert({
      where: { messageId },
      create: { messageId, rating, notes: notes ?? null },
      update: { rating, notes: notes ?? null },
    });
  }

  private async loadHistory(sessionId: string): Promise<ChatCompletionMessageParam[]> {
    const rows = await this.prisma.conciergeMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const out: ChatCompletionMessageParam[] = [];
    for (const r of rows) {
      switch (r.role) {
        case ConciergeRole.USER:
          out.push({ role: 'user', content: r.content ?? '' });
          break;
        case ConciergeRole.ASSISTANT:
          out.push({
            role: 'assistant',
            content: r.content ?? '',
            tool_calls: (r.toolCalls as never) ?? undefined,
          } as ChatCompletionMessageParam);
          break;
        case ConciergeRole.TOOL:
          if (r.toolCallId) {
            out.push({
              role: 'tool',
              tool_call_id: r.toolCallId,
              content: r.content ?? '',
            });
          }
          break;
        case ConciergeRole.SYSTEM:
          break;
      }
    }
    return out;
  }
}
