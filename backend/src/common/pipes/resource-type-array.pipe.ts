import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ResourceType } from '@generated/client';

const VALID_TYPES = new Set<string>(Object.values(ResourceType));

@Injectable()
export class ParseResourceTypeArrayPipe implements PipeTransform<
  string,
  ResourceType[]
> {
  transform(value: string): ResourceType[] {
    const types = value.split(',').map((t) => t.trim());

    for (const type of types) {
      if (!VALID_TYPES.has(type)) {
        throw new BadRequestException(
          `Invalid resource type "${type}". Valid: ${[...VALID_TYPES].join(', ')}`,
        );
      }
    }

    return types as ResourceType[];
  }
}
