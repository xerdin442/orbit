import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: { id: string };
}

export interface JwtPayload {
  sub: string;
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
