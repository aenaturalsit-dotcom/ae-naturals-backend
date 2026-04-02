// src/providers/provider.factory.ts
import { Injectable, BadRequestException } from '@nestjs/common';

// ✅ IMPORT YOUR INTERFACES
import { 
  EmailProviderInterface, 
  SmsProviderInterface, 
  PaymentProviderInterface 
} from './interfaces/provider.interfaces';

// Email
import { SmtpProvider } from './implementations/email/smtp.provider';
import { AwsSesProvider } from './implementations/email/aws-ses.provider';
import { SendGridProvider } from './implementations/email/sendgrid.provider';
// SMS
import { TwilioProvider } from './implementations/sms/twilio.provider';
import { Fast2SmsProvider } from './implementations/sms/fast2sms.provider';
import { Msg91Provider } from './implementations/sms/msg91.provider';
// Payment
import { StripeProvider } from './implementations/payment/stripe.provider';
import { RazorpayProvider } from './implementations/payment/razorpay.provider';
import { PhonepeProvider } from './implementations/payment/phonepe.provider';
import { PayuProvider } from './implementations/payment/payu.provider';

@Injectable()
export class ProviderFactory {
  
  // ✅ ADD TYPESCRIPT OVERLOADS HERE
  getProvider(type: 'EMAIL', name: string, config: any): EmailProviderInterface;
  getProvider(type: 'SMS', name: string, config: any): SmsProviderInterface;
  getProvider(type: 'PAYMENT', name: string, config: any): PaymentProviderInterface;
  
  // Actual Implementation
  getProvider(type: string, name: string, config: any): any {
    switch (type) {
      case 'EMAIL':
        if (name === 'SMTP') return new SmtpProvider(config);
        if (name === 'AWS_SES') return new AwsSesProvider(config);
        if (name === 'SENDGRID') return new SendGridProvider(config);
        break;
      case 'SMS':
        if (name === 'TWILIO') return new TwilioProvider(config);
        if (name === 'FAST2SMS') return new Fast2SmsProvider(config);
        if (name === 'MSG91') return new Msg91Provider(config);
        break;
      case 'PAYMENT':
        if (name === 'STRIPE') return new StripeProvider(config);
        if (name === 'RAZORPAY') return new RazorpayProvider(config);
        if (name === 'PHONEPE') return new PhonepeProvider(config);
        if (name === 'PAYU') return new PayuProvider(config);
        break;
    }

    throw new BadRequestException(`Provider ${name} of type ${type} is not supported.`);
  }
}