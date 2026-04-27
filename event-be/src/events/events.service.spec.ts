import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

type EventDelegateMock = {
  create: jest.Mock;
  findUnique: jest.Mock;
  findMany: jest.Mock;
};

const buildPrismaMock = (): { event: EventDelegateMock } => ({
  event: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
});

describe('EventsService', () => {
  let service: EventsService;
  let prisma: { event: EventDelegateMock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(EventsService);
  });

  it('creates an event with the provided fields', async () => {
    const dto = {
      title: 'AI Summit',
      location: 'Jakarta',
      startsAt: new Date('2026-05-01T09:00:00Z'),
      endsAt: new Date('2026-05-01T18:00:00Z'),
    };
    prisma.event.create.mockResolvedValue({ id: 'evt-1', ...dto });

    const result = await service.create(dto);

    expect(prisma.event.create).toHaveBeenCalledWith({ data: dto });
    expect(result.id).toBe('evt-1');
  });

  it('throws NotFoundException when event is missing', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assertExists returns void when event exists', async () => {
    prisma.event.findUnique.mockResolvedValue({ id: 'evt-1' });
    await expect(service.assertExists('evt-1')).resolves.toBeUndefined();
    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      select: { id: true },
    });
  });
});
