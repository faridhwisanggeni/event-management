import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { LlmModule } from '../llm/llm.module';
import { AttendeeEmbeddingService } from './attendee-embedding.service';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';

@Module({
  imports: [EventsModule, LlmModule],
  controllers: [AttendeesController],
  providers: [AttendeesService, AttendeeEmbeddingService],
  exports: [AttendeesService, AttendeeEmbeddingService],
})
export class AttendeesModule {}
