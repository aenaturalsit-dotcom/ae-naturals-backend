// src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AppCacheService } from 'src/common/cache/cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private cacheService: AppCacheService) {
    const secret = process.env.JWT_SECRET; //
    
    if (!secret) {
      throw new Error('FATAL: JWT_SECRET is missing from .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret, // TypeScript now knows this is a string
    });
  }

  async validate(payload: any) {
    // Secondary check against session cache
    const sessionKey = `session:${payload.sub}`;
    const isValid = await this.cacheService.get(sessionKey);
    
    if (!isValid) {
      throw new UnauthorizedException('Session invalidated or expired');
    }
console.log(`JWT validated for user ${payload.sub} with email ${payload.email}`); 
    return { 
      userId: payload.sub, 
      sub: payload.sub,
      email: payload.email, 
      role: payload.role 
    };
  }
}