import { IsString, IsNotEmpty } from 'class-validator';

export class ExecuteQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}
