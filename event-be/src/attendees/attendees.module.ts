import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';

@Module({
  imports: [EventsModule],
  controllers: [AttendeesController],
  providers: [AttendeesService],
})
export class AttendeesModule {}
