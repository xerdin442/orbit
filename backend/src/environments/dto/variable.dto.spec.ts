import { validate } from 'class-validator';
import { CreateVariableDto, UpdateVariableDto } from './variable.dto';

describe('CreateVariableDto', () => {
  it('passes with valid data', async () => {
    const dto = new CreateVariableDto();
    dto.key = 'API_KEY';
    dto.value = 'secret';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing key', async () => {
    const dto = new CreateVariableDto();
    dto.value = 'secret';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'key')).toBe(true);
  });

  it('rejects missing value', async () => {
    const dto = new CreateVariableDto();
    dto.key = 'API_KEY';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'value')).toBe(true);
  });
});

describe('UpdateVariableDto', () => {
  it('passes with only value', async () => {
    const dto = new UpdateVariableDto();
    dto.value = 'new-secret';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with only key', async () => {
    const dto = new UpdateVariableDto();
    dto.key = 'NEW_KEY';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with both key and value', async () => {
    const dto = new UpdateVariableDto();
    dto.key = 'NEW_KEY';
    dto.value = 'new-secret';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with an empty string value', async () => {
    const dto = new UpdateVariableDto();
    dto.value = '';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with an empty string key', async () => {
    const dto = new UpdateVariableDto();
    dto.key = '';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
