import { SmsProviderInterface, SmsPayload } from '../../interfaces/provider.interfaces';
import axios from 'axios';

export class Msg91Provider implements SmsProviderInterface {
  constructor(private config: any) {}

  async send(phone: string, message: string, payload?: SmsPayload): Promise<boolean> {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

    try {
      // 1. 🔥 DYNAMIC TEMPLATE FLOW (Order & Payment Events)
      if (payload && payload.templateKey) {
        // Map 'OTP' strictly to the default templateId, else look up the specific event template
        let templateId = payload.templateKey === 'OTP' 
          ? this.config.templateId 
          : this.config[`template_${payload.templateKey.toLowerCase()}`];

        if (!templateId) {
          throw new Error(`Missing MSG91 template ID for event: ${payload.templateKey}`);
        }

        await axios.post(
          'https://control.msg91.com/api/v5/flow/',
          {
            template_id: templateId,
            short_url: '0', 
            recipients: [{ mobiles: cleanPhone, ...payload.variables }],
          },
          { headers: { authkey: this.config.authKey, 'content-type': 'application/json' } },
        );
        return true;
      }

      // 2. 🛡️ LEGACY OTP FLOW (Backward Compatibility if no payload is passed)
      const otpCode = message.match(/\d{4,6}/)?.[0] || message;
      
      await axios.post(
        'https://control.msg91.com/api/v5/flow/',
        {
          template_id: this.config.templateId,
          short_url: '0',
          recipients: [{ mobiles: cleanPhone, OTP: otpCode }],
        },
        { headers: { authkey: this.config.authKey, 'content-type': 'application/json' } },
      );
      return true;

    } catch (error) {
      // Throwing error automatically triggers the fallback to Twilio/Fast2SMS in SmsService
      throw new Error(`MSG91 Error: ${error?.response?.data?.message || error.message}`);
    }
  }
}