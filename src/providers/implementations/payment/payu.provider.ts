// src/providers/implementations/payment/payu.provider.ts

import * as crypto from 'crypto';
import { PaymentProviderInterface } from '../../interfaces/provider.interfaces';

export class PayuProvider implements PaymentProviderInterface {
  private config: any;

  constructor(config: any) {
    if (!config.merchant_key || !config.merchant_salt) {
      throw new Error('PayU configuration is incomplete: Missing Key or Salt.');
    }
    // ✅ ADD THIS CHECK to fail early instead of breaking the redirect
    if (!config.backend_webhook_url) {
      throw new Error('PayU configuration is incomplete: Missing backend_webhook_url.');
    }
    this.config = config;
  }
  async createOrder(orderId: string, amount: number, currency: string): Promise<any> {
    // 1. TRIM KEYS (Crucial: Removes hidden spaces copied from the dashboard)
    const key = String(this.config.merchant_key).trim();
    const salt = String(this.config.merchant_salt).trim();

    const txnid = orderId;
    const productinfo = 'Order Payment';
    const firstname = 'Customer';
    const email = 'customer@example.com';

    // 2. STRICT STRING AMOUNT FORMATTING
    // Forces "456.00" as a String so JSON doesn't strip the decimals
    const formattedAmount = Number(amount).toFixed(2);

    // 3. EXACT HASH STRING
    const hashString = `${key}|${txnid}|${formattedAmount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    
    const actionUrl = this.config.is_production === 'true'
      ? 'https://secure.payu.in/_payment'
      : 'https://test.payu.in/_payment';


      const backendUrl = this.config.backend_webhook_url || process.env.BACKEND_URL || 'http://localhost:4000/api/v1';
    return {
      providerOrderId: txnid,
      provider: 'PAYU',
      formPayload: {
        key,
        txnid,
        amount: formattedAmount, // Passed strictly as string
        productinfo,
        firstname,
        email,
        // 4. EXPLICIT BLANK UDFS (Forces frontend to create hidden inputs)
        udf1: '',
        udf2: '',
        udf3: '',
        udf4: '',
        udf5: '',
        surl: `${this.config.backend_webhook_url}/payments/payu/verify`,
        furl: `${this.config.backend_webhook_url}/payments/payu/verify`,
        hash,
        actionUrl
      }
    };
  }

  verifyPayment(paymentData: any): boolean {
    const { status, email, firstname, productinfo, amount, txnid, hash: receivedHash, additionalCharges } = paymentData;

    const key = String(this.config.merchant_key).trim();
    const salt = String(this.config.merchant_salt).trim();

    let reverseHashString = '';

    if (additionalCharges) {
       reverseHashString = `${additionalCharges}|${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    } else {
       reverseHashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    }

    const calculatedHash = crypto.createHash('sha512').update(reverseHashString).digest('hex');
    return calculatedHash === receivedHash;
  }
}