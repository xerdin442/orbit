import { IsString, IsNotEmpty } from 'class-validator';

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
