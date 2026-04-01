// src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('FATAL: JWT_SECRET is missing from .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret, 
    });
  }

  async validate(payload: any) {
    // 🚀 ENTERPRISE STANDARD: 
    // Access tokens are short-lived (15m) and validated statelessly.
    // Session revocation is handled during the Refresh Token rotation flow.
    
    return { 
      userId: payload.sub, 
      sub: payload.sub,
      email: payload.email, 
      role: payload.role,
      sid: payload.sid, // Session ID from our new auth architecture
      tenantId: payload.tenantId || 'default-store',
    };
  }
}