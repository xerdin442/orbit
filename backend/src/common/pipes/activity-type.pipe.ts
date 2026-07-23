import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ActivityType } from '@generated/client';

const VALID_TYPES = new Set<string>(Object.values(ActivityType));

@Injectable()
export class ParseActivityTypePipe implements PipeTransform<
  string,
  ActivityType
> {
  transform(value: string): ActivityType {
    if (!VALID_TYPES.has(value)) {
      throw new BadRequestException(
        `Invalid activity type "${value}". Valid values: ${[...VALID_TYPES].join(', ')}`,
      );
    }

    return value as ActivityType;
  }
}
