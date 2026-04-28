import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Attendee } from '@prisma/client';

import { Paginated } from '../common/dto/pagination.dto';
import { AttendeesService } from './attendees.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import { ListAttendeesQueryDto } from './dto/list-attendees-query.dto';

@Controller({ path: 'events/:eventId/attendees', version: '1' })
export class AttendeesController {
  constructor(private readonly attendees: AttendeesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  register(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: CreateAttendeeDto,
  ): Promise<Attendee> {
    return this.attendees.create(eventId, dto);
  }

  @Get()
  list(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Query() query: ListAttendeesQueryDto,
  ): Promise<Paginated<Attendee>> {
    return this.attendees.list(eventId, query);
  }



  @Post('backfill-embeddings')
  @HttpCode(HttpStatus.OK)
  backfillEmbeddings(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
  ): Promise<{ attempted: number; updated: number }> {
    return this.attendees.backfillEmbeddings(eventId);
  }
}
