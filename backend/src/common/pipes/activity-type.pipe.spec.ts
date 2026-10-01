import { ParseActivityTypePipe } from './activity-type.pipe';
import { BadRequestException } from '@nestjs/common';
import { ActivityType } from '@generated/client';

describe('ParseActivityTypePipe', () => {
  const pipe = new ParseActivityTypePipe();

  it('returns the value for a valid ActivityType', () => {
    expect(pipe.transform('project_created')).toBe(
      ActivityType.project_created,
    );
  });

  it('throws BadRequestException for invalid type', () => {
    expect(() => pipe.transform('invalid_type')).toThrow(BadRequestException);
  });

  it('throws with a message listing valid types', () => {
    try {
      pipe.transform('invalid_type');
      fail('should have thrown');
    } catch (e) {
      expect((e as BadRequestException).message).toContain(
        'Invalid activity type',
      );
    }
  });

  it('rejects empty string', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });
});
