import { IsOptional, IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '@src/common/dto/pagination.dto';

export class FilterRequestLogsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  statusCode?: number;
}
