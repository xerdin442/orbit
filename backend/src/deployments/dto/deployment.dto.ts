import { BuildStatus, DeploymentTrigger } from '@generated/client';
import { PaginationDto } from '@src/common/dto/pagination.dto';
import { IsOptional, IsEnum, IsArray, IsString } from 'class-validator';

export class FilterDeploymentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DeploymentTrigger)
  trigger?: DeploymentTrigger;

  @IsOptional()
  @IsEnum(BuildStatus)
  status?: BuildStatus;
}

export class AbortDeploymentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marked_resources?: string[];
}
