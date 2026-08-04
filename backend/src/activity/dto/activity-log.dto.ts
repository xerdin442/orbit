import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@src/common/dto/pagination.dto';

export class FilterActivityLogsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  deploymentId?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
