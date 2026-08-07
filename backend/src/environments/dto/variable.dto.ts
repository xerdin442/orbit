import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVariableDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class UpdateVariableDto {
  @IsString()
  @IsOptional()
  key?: string;

  @IsString()
  @IsOptional()
  value?: string;
}

export class BulkCreateVariablesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariableDto)
  variables: CreateVariableDto[];
}
