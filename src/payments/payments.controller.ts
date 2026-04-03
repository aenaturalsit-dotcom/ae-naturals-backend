// Location: src/payments/payments.controller.ts

import { Controller, Post, Body, Headers, Req, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentsService, PaymentGateway } from './payments.service';
import { StripeService } from './providers/stripe.service';
import { RazorpayService } from './providers/razorpay.service';
import { PhonePeService } from './providers/phonepe.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private stripeService: StripeService,
    private razorpayService: RazorpayService,
    private phonepeService: PhonePeService,
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
      console.error('PayU Verification Error:', error.message);
      return res.redirect(`${fallbackFrontendUrl}/checkout?error=hash_mismatch`);
    }
  }

  // 2. Stripe Webhook
 @Post('stripe/webhook')
  async stripeWebhook(
    @Headers('stripe-signature') signature: string, 
    @Req() req: RawBodyRequest<Request>, 
    @Res() res: Response
  ) {
    try {
      // Assert that rawBody is present
      if (!req.rawBody) throw new BadRequestException('Raw body is missing');
      
      const event = this.stripeService.verifyWebhook(req.rawBody, signature);
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        await this.paymentsService.markOrderPaid(session.id);
      }
      res.status(HttpStatus.OK).send();
    } catch (err) {
      res.status(HttpStatus.BAD_REQUEST).send(`Stripe Error: ${err.message}`);
    }
  }

  // 3. Razorpay Frontend Success Verification
  @Post('razorpay/verify')
  async razorpayVerify(
    @Body() body: { razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }
  ) {
    this.razorpayService.verifySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature);
    await this.paymentsService.markOrderPaid(body.razorpay_order_id);
    return { success: true };
  }

  // 4. PhonePe Webhook
  @Post('phonepe/webhook')
  async phonepeWebhook(
    @Body() body: { response: string }, 
    @Headers('x-verify') checksum: string, 
    @Res() res: Response
  ) {
    try {
      this.phonepeService.verifyChecksum(body.response, checksum);
      
      const decodedData = JSON.parse(Buffer.from(body.response, 'base64').toString('utf-8'));
      if (decodedData.code === 'PAYMENT_SUCCESS') {
        await this.paymentsService.markOrderPaid(decodedData.data.merchantTransactionId);
      }
      res.status(HttpStatus.OK).send();
    } catch (err) {
      res.status(HttpStatus.BAD_REQUEST).send();
    }
  }
}