import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class PostConciergeMessageDto {
  @IsUUID()
  attendee_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
