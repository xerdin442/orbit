import { Request } from 'express';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface AuthenticatedRequest extends Request {
  user: { id: string };
}

export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

export interface GitHubTokenResponse {
  access_token: string;
}

export interface JwtPayload {
  sub: string;
}
