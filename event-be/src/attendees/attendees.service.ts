import { Injectable } from '@nestjs/common';
import { Attendee, Prisma } from '@prisma/client';

import { Paginated } from '../common/dto/pagination.dto';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendeeEmbeddingService } from './attendee-embedding.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import { ListAttendeesQueryDto } from './dto/list-attendees-query.dto';

@Injectable()
export class AttendeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly embeddings: AttendeeEmbeddingService,
  ) {}

  async create(eventId: string, dto: CreateAttendeeDto): Promise<Attendee> {
    await this.events.assertExists(eventId);

    const attendee = await this.prisma.attendee.create({
      data: {
        eventId,
        name: dto.name,
        headline: dto.headline,
        bio: dto.bio,
        company: dto.company,
        roleId: dto.roleId,
        skills: dto.skills ?? [],
        lookingFor: dto.lookingFor,
        openToChat: dto.openToChat ?? true,
      },
    });

    // Fire-and-forget; embedding failures are logged inside the service.
    void this.embeddings.upsertForAttendee(attendee.id);

    return attendee;
  }

  async list(eventId: string, query: ListAttendeesQueryDto): Promise<Paginated<Attendee>> {
    await this.events.assertExists(eventId);

    const where: Prisma.AttendeeWhereInput = { eventId };

    if (query.roleId) {
      where.roleId = query.roleId;
    }

    if (query.skills && query.skills.length > 0) {
      where.skills = { hasSome: query.skills };
    }

    const skip = (query.page - 1) * query.pageSize;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.attendee.findMany({
        where,
        include: { role: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.attendee.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async backfillEmbeddings(eventId: string): Promise<{ attempted: number; updated: number }> {
    await this.events.assertExists(eventId);
    return this.embeddings.backfillMissing(eventId);
  }
}
