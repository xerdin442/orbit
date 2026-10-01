import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
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
  @IsNotEmpty()
  value: string;
}

class VariableEntry {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class BulkCreateVariablesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariableEntry)
  variables: VariableEntry[];
}
