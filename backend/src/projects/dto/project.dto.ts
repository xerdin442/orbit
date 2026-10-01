import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  Matches,
} from 'class-validator';

const repoUrlPattern =
  /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'Name must be lowercase alphanumeric with optional hyphens, no spaces',
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(repoUrlPattern, { message: 'Invalid GitHub repository URL' })
  repositoryUrl: string;

  @IsString()
  @IsNotEmpty()
  defaultBranch: string;

  @IsBoolean()
  @IsOptional()
  healthCheck?: boolean;

  @IsNumber()
  @IsOptional()
  healthCheckPort?: number;

  @IsString()
  @IsOptional()
  healthCheckPath?: string;

  @IsNumber()
  @IsOptional()
  healthCheckTimeout?: number;

  @IsNumber()
  @IsOptional()
  installationId?: number;

  @IsObject()
  @IsOptional()
  envVars?: Record<string, string>;

  @IsString()
  @IsOptional()
  buildDirectory?: string;

  @IsString()
  @IsOptional()
  startCommand?: string;
}

export class UpdateProjectDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'Name must be lowercase alphanumeric with optional hyphens, no spaces',
  })
  name?: string;

  @IsBoolean()
  @IsOptional()
  healthCheck?: boolean;

  @IsNumber()
  @IsOptional()
  healthCheckPort?: number;

  @IsString()
  @IsOptional()
  healthCheckPath?: string;

  @IsNumber()
  @IsOptional()
  healthCheckTimeout?: number;

  @IsString()
  @IsOptional()
  buildDirectory?: string;

  @IsString()
  @IsOptional()
  startCommand?: string;
}
