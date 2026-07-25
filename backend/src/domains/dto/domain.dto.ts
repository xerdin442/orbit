import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class AddDomainDto {
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/,
    {
      message: 'Invalid hostname',
    },
  )
  hostname: string;
}
