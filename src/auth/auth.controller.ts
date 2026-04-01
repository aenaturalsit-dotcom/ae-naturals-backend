import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import * as express from 'express';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using HTTP-only cookie' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing refresh token.',
  })
  async refresh(
    @Request() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.refreshTokens(req, res);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile from refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Returns user profile and new access token.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - No valid session.' })
  async getProfile(@Request() req: express.Request) {
    try {

      const refreshToken = req.cookies?.refresh_token;

      if (!refreshToken) {
        throw new UnauthorizedException('No refresh token');
      }

      const { user, access_token } =
        await this.authService.getUserFromRefreshToken(refreshToken);

      return { user, access_token };
    } catch (err) {
      throw new UnauthorizedException('Invalid session');
    }
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Logout user and clear session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async logout(
    @Request() req: express.Request, // <-- Changed to express.Request
    @Res({ passthrough: true }) res: express.Response,
  ) {
    // We no longer extract userId here. 
    // The service handles reading the cookie and clearing it.
    return this.authService.logout(req, res);
  }

  @Post('send-otp')
  @ApiOperation({ summary: 'Send a 6-digit OTP to email or phone' })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({ status: 201, description: 'OTP sent successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data.',
  })
  async sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body.identifier, body.type);
  }

 @Post('verify-otp')
  @ApiOperation({ summary: 'Verify initial OTP (Email or Phone)' })
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(
    @Body() body: VerifyOtpDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.verifyOtp(res, body.identifier, body.otp);
  }


  @Post('verify-phone-otp')
  @ApiOperation({ summary: 'Verify Phone OTP & Create/Update User (Temp Flow)' })
  @ApiBody({ type: VerifyPhoneOtpDto })
  async verifyPhoneOtp(
    @Body() body: VerifyPhoneOtpDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.verifyPhoneOtp(res, body.tempToken, body.phone, body.otp);
  }

  @Post('complete-profile')
  @ApiOperation({ summary: 'Link phone number to an email-only account' })
  @ApiBody({ type: CompleteProfileDto })
  async completeProfile(
    @Body() body: CompleteProfileDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.completeProfile(
      res,
      body.phone,
      body.otp,
      body.tempToken,
    );
  }
}

  
