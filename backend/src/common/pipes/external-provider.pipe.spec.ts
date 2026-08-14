import { ParseExternalProviderPipe } from './external-provider.pipe';
import { BadRequestException } from '@nestjs/common';
import { ExternalProvider } from '@generated/client';

describe('ParseExternalProviderPipe', () => {
  const pipe = new ParseExternalProviderPipe();

  it('returns the provider for a valid value', () => {
    expect(pipe.transform('railway')).toBe(ExternalProvider.railway);
    expect(pipe.transform('vercel')).toBe(ExternalProvider.vercel);
  });

  it('throws for an invalid provider', () => {
    expect(() => pipe.transform('heroku')).toThrow(BadRequestException);
  });

  it('throws for an empty string', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });
});
