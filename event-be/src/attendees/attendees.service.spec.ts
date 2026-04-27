import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendeeRole } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendeeEmbeddingService } from './attendee-embedding.service';
import { AttendeesService } from './attendees.service';

const buildPrismaMock = () => ({
  attendee: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
});

describe('AttendeesService', () => {
  let service: AttendeesService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let events: { assertExists: jest.Mock };
  let embeddings: { upsertForAttendee: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    events = { assertExists: jest.fn().mockResolvedValue(undefined) };
    embeddings = { upsertForAttendee: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        AttendeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: events },
        { provide: AttendeeEmbeddingService, useValue: embeddings },
      ],
    }).compile();

    service = module.get(AttendeesService);
  });

  it('creates an attendee under an existing event with sane defaults', async () => {
    prisma.attendee.create.mockResolvedValue({ id: 'a1' });

    await service.create('evt-1', { name: 'Asani' });

    expect(events.assertExists).toHaveBeenCalledWith('evt-1');
    expect(prisma.attendee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'evt-1',
        name: 'Asani',
        skills: [],
        openToChat: true,
      }),
    });
  });

  it('propagates NotFoundException when event does not exist', async () => {
    events.assertExists.mockRejectedValue(new NotFoundException());
    await expect(service.create('missing', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.attendee.create).not.toHaveBeenCalled();
  });

  it('builds list filters for role + skills overlap and paginates', async () => {
    prisma.attendee.findMany.mockResolvedValue([{ id: 'a1' }]);
    prisma.attendee.count.mockResolvedValue(42);

    const result = await service.list('evt-1', {
      page: 2,
      pageSize: 10,
      role: AttendeeRole.BACKEND_DEVELOPER,
      skills: ['ai', 'founder'],
    });

    expect(prisma.attendee.findMany).toHaveBeenCalledWith({
      where: {
        eventId: 'evt-1',
        role: AttendeeRole.BACKEND_DEVELOPER,
        skills: { hasSome: ['ai', 'founder'] },
      },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(result.meta).toEqual({ page: 2, pageSize: 10, total: 42, totalPages: 5 });
    expect(result.data).toHaveLength(1);
  });
});
