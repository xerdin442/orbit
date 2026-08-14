import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectProviderDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
