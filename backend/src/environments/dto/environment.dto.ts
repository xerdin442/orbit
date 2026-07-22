import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateEnvironmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  branch: string;

  @IsBoolean()
  @IsOptional()
  autoDeploy?: boolean;
}

export class UpdateEnvironmentDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  branch?: string;

  @IsBoolean()
  @IsOptional()
  autoDeploy?: boolean;
}
