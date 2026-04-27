import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { ConciergeService, ConciergeTurnResponse } from './concierge.service';
import { PostConciergeMessageDto } from './dto/post-message.dto';

@Controller('events/:eventId/concierge')
export class ConciergeController {
  constructor(private readonly concierge: ConciergeService) {}

  @Post('messages')
  @HttpCode(200)
  async postMessage(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() dto: PostConciergeMessageDto,
  ): Promise<ConciergeTurnResponse> {
    return this.concierge.postMessage(eventId, dto.attendee_id, dto.message);
  }
}
