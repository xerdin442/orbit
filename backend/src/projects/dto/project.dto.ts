import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';

const repoUrlPattern =
  /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(\.git)?$/;

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
  @IsOptional()
  defaultBranch?: string;

  @IsBoolean()
  @IsOptional()
  healthCheck?: boolean;
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
}
