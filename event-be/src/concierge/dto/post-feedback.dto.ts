import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Feedback payload for an assistant turn. Rating uses a 1–5 scale; the FE
 * thumbs-up/down maps to 5 / 1 to keep the loop simple while preserving room
 * for richer ratings later.
 */
export class PostFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
