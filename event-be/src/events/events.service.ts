import { Injectable, NotFoundException } from '@nestjs/common';
import { Event } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEventDto): Promise<Event> {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        location: dto.location,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
      },
    });
  }

  async findById(id: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }

  async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Event ${id} not found`);
    }
  }

  list(): Promise<Event[]> {
    return this.prisma.event.findMany({ orderBy: { startsAt: 'desc' } });
  }
}
