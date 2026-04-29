import { Injectable, Logger } from '@nestjs/common';
import { Attendee, Role } from '@prisma/client';

import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendeeEmbeddingService {
  private readonly logger = new Logger(AttendeeEmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  buildProfileText(
    a: Pick<Attendee, 'name' | 'headline' | 'bio' | 'company' | 'skills' | 'lookingFor'> & {
      role?: Pick<Role, 'code' | 'label'> | null;
    },
  ): string {
    return [
      `Name: ${a.name}`,
      a.headline ? `Headline: ${a.headline}` : null,
      a.company ? `Company: ${a.company}` : null,
      a.role ? `Role: ${a.role.label}` : null,
      a.skills?.length ? `Skills: ${a.skills.join(', ')}` : null,
      a.bio ? `Bio: ${a.bio}` : null,
      a.lookingFor ? `Looking for: ${a.lookingFor}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  async upsertForAttendee(attendeeId: string): Promise<void> {
    if (!this.llm.isEnabled()) {
      this.logger.debug(`LLM disabled — skipping embedding for ${attendeeId}`);
      return;
    }

    try {
      const attendee = await this.prisma.attendee.findUniqueOrThrow({
        where: { id: attendeeId },
        include: { role: true },
      });
      const text = this.buildProfileText(attendee);
      const vector = await this.llm.embed(text);
      const literal = `[${vector.join(',')}]`;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "attendees" SET "embedding" = $1::vector WHERE "id" = $2::uuid`,
        literal,
        attendeeId,
      );
      this.logger.log({ msg: 'attendee.embedding.updated', attendeeId });
    } catch (err) {
      this.logger.warn({
        msg: 'attendee.embedding.failed',
        attendeeId,
        err: (err as Error).message,
      });
    }
  }

  async backfillMissing(eventId: string): Promise<{ attempted: number; updated: number }> {
    if (!this.llm.isEnabled()) {
      throw new Error('LLM is not configured — set OPENAI_API_KEY to backfill embeddings.');
    }

    const targets = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "attendees" WHERE "event_id" = $1::uuid AND "embedding" IS NULL`,
      eventId,
    );

    let updated = 0;
    for (const { id } of targets) {
      const before = await this.prisma.$queryRawUnsafe<Array<{ has_embedding: boolean }>>(
        `SELECT (embedding IS NOT NULL) AS has_embedding FROM "attendees" WHERE id = $1::uuid`,
        id,
      );
      await this.upsertForAttendee(id);
      const after = await this.prisma.$queryRawUnsafe<Array<{ has_embedding: boolean }>>(
        `SELECT (embedding IS NOT NULL) AS has_embedding FROM "attendees" WHERE id = $1::uuid`,
        id,
      );
      if (!before[0]?.has_embedding && after[0]?.has_embedding) updated += 1;
    }

    return { attempted: targets.length, updated };
  }
}
