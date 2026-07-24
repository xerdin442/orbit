import { validate } from 'class-validator';
import { CreateEnvironmentDto, UpdateEnvironmentDto } from './environment.dto';

describe('CreateEnvironmentDto', () => {
  it('passes with valid data', async () => {
    const dto = new CreateEnvironmentDto();
    dto.name = 'staging';
    dto.branch = 'develop';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing name', async () => {
    const dto = new CreateEnvironmentDto();
    dto.branch = 'develop';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects missing branch', async () => {
    const dto = new CreateEnvironmentDto();
    dto.name = 'staging';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'branch')).toBe(true);
  });

  it('accepts optional autoDeploy', async () => {
    const dto = new CreateEnvironmentDto();
    dto.name = 'staging';
    dto.branch = 'develop';
    dto.autoDeploy = true;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateEnvironmentDto', () => {
  it('passes with empty object', async () => {
    const dto = new UpdateEnvironmentDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with partial fields', async () => {
    const dto = new UpdateEnvironmentDto();
    dto.name = 'updated';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
