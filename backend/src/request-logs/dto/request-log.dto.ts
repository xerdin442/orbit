import { IsOptional, IsInt, IsIn, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '@src/common/dto/pagination.dto';
import { STATUS_CLASSES, type StatusClass } from '@src/common/types';

export class FilterRequestLogsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  statusCode?: number;

  @IsOptional()
  @IsIn(STATUS_CLASSES)
  statusClass?: StatusClass;
}
