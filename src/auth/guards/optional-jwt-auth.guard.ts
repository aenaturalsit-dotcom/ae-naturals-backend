// src/auth/guards/optional-jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to NEVER throw an error. 
  // If the user has no token, it just returns null/undefined.
  handleRequest(err: any, user: any, info: any) {
    return user;
  }
}