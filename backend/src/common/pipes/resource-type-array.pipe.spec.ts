import { ParseResourceTypeArrayPipe } from './resource-type-array.pipe';
import { BadRequestException } from '@nestjs/common';
import { ResourceType } from '@generated/client';

describe('ParseResourceTypeArrayPipe', () => {
  const pipe = new ParseResourceTypeArrayPipe();

  it('returns single type', () => {
    expect(pipe.transform('postgres')).toEqual([ResourceType.postgres]);
  });

  it('splits comma-separated types', () => {
    expect(pipe.transform('postgres,redis')).toEqual([
      ResourceType.postgres,
      ResourceType.redis,
    ]);
  });

  it('trims whitespace around types', () => {
    expect(pipe.transform(' postgres , redis ')).toEqual([
      ResourceType.postgres,
      ResourceType.redis,
    ]);
  });

  it('throws for any invalid type in the list', () => {
    expect(() => pipe.transform('postgres,invalid')).toThrow(
      BadRequestException,
    );
  });

  it('throws for empty string', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });
});
