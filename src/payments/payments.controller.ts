// Location: src/payments/payments.controller.ts

import { Controller, Post, Body, Headers, Req, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentsService, PaymentGateway } from './payments.service';


@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
   
  ) {}

  // 1. Endpoint called by your Frontend to start payment
  @Post('initiate') // <--- FIXED ROUTE
async checkout(
  @Body() body: { orderId: string, provider: PaymentGateway }, 
  @Req() req: any
) {
  // Graceful fallback for JWT payload variations
  const userId = req.user?.id || req.user?.userId || 'guest_user'; 
  return this.paymentsService.initiateCheckout(body.orderId, body.provider, userId);
}

// ✅ NEW: PayU Direct Backend Callback & Redirect
  @Post('payu/verify')
  async payuVerify(@Body() body: any, @Res() res: Response) {
    // We set a safe fallback URL in case verification fails so the user isn't stuck on a blank screen
    const fallbackFrontendUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3001';

    try {
      const txnid = body.txnid;
      const status = body.status;

      // 1. If PayU explicitly tells us the payment failed (e.g., user cancelled)
      if (status !== 'success') {
        return res.redirect(`${fallbackFrontendUrl}/checkout?error=payment_failed`);
      }

      // 2. Pass to PaymentsService to verify reverse hash and mark order PAID
      const result = await this.paymentsService.verifyPayment('PAYU', txnid, body);

      // 3. Issue HTTP 302 Redirect to drop user on the Next.js Success Page
      if (result.success) {
        return res.redirect(`${result.frontendUrl}/order-success/${result.orderId}`);
      }
      
    } catch (error) {
      console.error('PayU Verification Error:', error);
      return res.redirect(`${fallbackFrontendUrl}/checkout?error=hash_mismatch`);
    }
  }




 
}