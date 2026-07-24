import { validate } from 'class-validator';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';

describe('CreateProjectDto', () => {
  it('passes with valid data', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my-app';
    dto.repositoryUrl = 'https://github.com/owner/repo';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects name with spaces', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my app';
    dto.repositoryUrl = 'https://github.com/owner/repo';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('rejects invalid GitHub URL', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my-app';
    dto.repositoryUrl = 'https://gitlab.com/owner/repo';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('repositoryUrl');
  });

  it('accepts URL with www prefix', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my-app';
    dto.repositoryUrl = 'https://www.github.com/owner/repo';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing name', async () => {
    const dto = new CreateProjectDto();
    dto.repositoryUrl = 'https://github.com/owner/repo';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects missing repositoryUrl', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my-app';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'repositoryUrl')).toBe(true);
  });

  it('accepts optional healthCheck boolean', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my-app';
    dto.repositoryUrl = 'https://github.com/owner/repo';
    dto.healthCheck = true;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects healthCheck as string', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my-app';
    dto.repositoryUrl = 'https://github.com/owner/repo';
    (dto as Record<string, unknown>).healthCheck = 'yes';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'healthCheck')).toBe(true);
  });

  it('accepts optional envVars', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my-app';
    dto.repositoryUrl = 'https://github.com/owner/repo';
    dto.envVars = { NODE_ENV: 'production' };
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts optional defaultBranch', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'my-app';
    dto.repositoryUrl = 'https://github.com/owner/repo';
    dto.defaultBranch = 'develop';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateProjectDto', () => {
  it('passes with only name', async () => {
    const dto = new UpdateProjectDto();
    dto.name = 'updated-name';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with only healthCheck', async () => {
    const dto = new UpdateProjectDto();
    dto.healthCheck = false;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with empty object', async () => {
    const dto = new UpdateProjectDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
