import { Injectable, Logger } from '@nestjs/common';
import { Attendee, Role } from '@prisma/client';

import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Builds and persists pgvector embeddings for attendees.
 *
 * - Embeds a concatenated profile string (name/headline/bio/role/skills/looking_for).
 * - Writes to the `embedding` column via raw SQL (Prisma can't bind `vector`).
 * - Failures are logged, NEVER thrown — embedding generation is best-effort
 *   and must not break attendee creation. The agent search tool degrades to
 *   keyword-only when an embedding is missing.
 */
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
      this.logger.warn({ msg: 'attendee.embedding.failed', attendeeId, err: (err as Error).message });
    }
  }
}
