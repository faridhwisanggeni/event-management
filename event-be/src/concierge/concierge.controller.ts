import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { ConciergeService, ConciergeTurnResponse } from './concierge.service';
import { PostConciergeMessageDto } from './dto/post-message.dto';
import { PostFeedbackDto } from './dto/post-feedback.dto';

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

  /**
   * Rate an assistant turn. Idempotent: re-posting overwrites the existing
   * row (one feedback per message — see Prisma `@unique` on `messageId`).
   */
  @Post('messages/:messageId/feedback')
  @HttpCode(200)
  async postFeedback(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body() dto: PostFeedbackDto,
  ) {
    const fb = await this.concierge.upsertFeedback(eventId, messageId, dto.rating, dto.notes);
    return { id: fb.id, rating: fb.rating, notes: fb.notes };
  }
}
