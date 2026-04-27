import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString, MaxLength, MinLength, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'IsAfter', async: false })
class IsAfterConstraint implements ValidatorConstraintInterface {
  validate(value: Date, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints as [string];
    const related = (args.object as Record<string, unknown>)[relatedPropertyName];
    return value instanceof Date && related instanceof Date && value.getTime() > related.getTime();
  }
  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints as [string];
    return `${args.property} must be after ${relatedPropertyName}`;
  }
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location!: string;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Type(() => Date)
  @IsDate()
  @Validate(IsAfterConstraint, ['startsAt'])
  endsAt!: Date;
}
