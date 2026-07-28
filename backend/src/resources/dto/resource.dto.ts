import { ResourceType } from '@generated/client';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

export class CreateResourceDto {
  @IsEnum(ResourceType)
  type: ResourceType;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsObject()
  @IsOptional()
  credentials?: Record<string, string>;
}
