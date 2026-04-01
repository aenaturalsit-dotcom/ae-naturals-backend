// src/modules/checkout/checkout.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { BuyNowDto } from '../dto/buy-now.dto';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('buy-now')
  async buyNow(@CurrentUser() user: any, @Body() dto: BuyNowDto) {
    const session = await this.checkoutService.processBuyNow(
      user.tenantId, 
      user.userId, 
      user.sessionId, 
      dto
    );

    return {
      success: true,
      checkoutSessionId: session.id,
      expiresAt: session.expiresAt,
      // Here you would typically return the payment gateway URL or client secret
    };
  }
}