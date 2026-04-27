import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Event } from '@prisma/client';

import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEventDto): Promise<Event> {
    return this.events.create(dto);
  }

  @Get()
  list(): Promise<Event[]> {
    return this.events.list();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<Event> {
    return this.events.findById(id);
  }
}
