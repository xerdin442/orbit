import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ExternalProvider } from '@generated/client';

const VALID_PROVIDERS = new Set<string>(Object.values(ExternalProvider));

@Injectable()
export class ParseExternalProviderPipe implements PipeTransform<
  string,
  ExternalProvider
> {
  transform(value: string): ExternalProvider {
    if (!VALID_PROVIDERS.has(value)) {
      throw new BadRequestException(
        `Invalid provider "${value}". Valid: ${[...VALID_PROVIDERS].join(', ')}`,
      );
    }

    return value as ExternalProvider;
  }
}
