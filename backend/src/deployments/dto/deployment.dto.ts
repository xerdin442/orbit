import { BuildStatus, DeploymentTrigger } from '@generated/client';
import { PaginationDto } from '@src/common/dto/pagination.dto';
import { IsOptional, IsEnum } from 'class-validator';

export class FilterDeploymentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DeploymentTrigger)
  trigger?: DeploymentTrigger;

  @IsOptional()
  @IsEnum(BuildStatus)
  status?: BuildStatus;
}
