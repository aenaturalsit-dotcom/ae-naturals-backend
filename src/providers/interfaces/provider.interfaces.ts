export interface SmsPayload {
  templateKey?: string;
  variables?: Record<string, string>;
}

export interface EmailProviderInterface {
  send(to: string, subject: string, html: string): Promise<boolean>;
}

export interface SmsProviderInterface {
  // ✅ Added optional payload for MSG91 Template Routing
  send(phone: string, message: string, payload?: SmsPayload): Promise<boolean>;
}

export interface PaymentProviderInterface {
  createOrder(orderId: string, amount: number, currency: string): Promise<any>;
  verifyPayment?(paymentData: any): boolean;
}