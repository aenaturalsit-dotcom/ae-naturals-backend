import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as crypto from 'crypto'; 
import type { Cache } from 'cache-manager';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { ProviderConfigService } from '../providers/provider-config.service';

export const SMS_EVENTS = [
  'ORDER_PLACED',
  'ORDER_CONFIRMED',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
] as const;

export type SmsEventType = typeof SMS_EVENTS[number] | 'OTP';

// 1. Central Fallback Message Config for Twilio / Fast2SMS
const SMS_FALLBACK_TEMPLATES: Record<SmsEventType, (v: any) => string> = {
  OTP: (v) => `Your Verification Code is ${v.OTP}. It will expire in 5 minutes. Do not share.`,
  ORDER_PLACED: (v) => `Hi ${v.NAME}, your order ${v.ORDER_ID} for Rs.${v.AMOUNT} is placed successfully.`,
  ORDER_CONFIRMED: (v) => `Hi ${v.NAME}, payment received! Your order ${v.ORDER_ID} is confirmed.`,
  ORDER_SHIPPED: (v) => `Hi ${v.NAME}, your order ${v.ORDER_ID} has been shipped! Track here: ${v.TRACKING_LINK}`,
  ORDER_DELIVERED: (v) => `Hi ${v.NAME}, your order ${v.ORDER_ID} has been successfully delivered.`,
  ORDER_CANCELLED: (v) => `Hi ${v.NAME}, your order ${v.ORDER_ID} has been cancelled. Reason: ${v.REASON}`,
  PAYMENT_SUCCESS: (v) => `Hi ${v.NAME}, payment of Rs.${v.AMOUNT} for order ${v.ORDER_ID} was successful.`,
  PAYMENT_FAILED: (v) => `Hi ${v.NAME}, payment for order ${v.ORDER_ID} failed. Please try again.`,
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private emailService: EmailService,
    private smsService: SmsService,
    private providerConfigService: ProviderConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Evaluates if an SMS should be sent based on Admin DB configs.
   * 🔥 STRICT RULE: OTP always sends regardless of configuration.
   */
  async shouldSendSms(eventType: SmsEventType): Promise<boolean> {
    if (eventType === 'OTP') return true; 

    try {
      const configs = await this.providerConfigService.getAllAdminConfigs('SMS');
      const prefConfig = configs.find((c: any) => c.provider === 'EVENT_PREFERENCES');
      
      if (!prefConfig || !prefConfig.isActive) return true; // Default to true if not setup
      
      const settings = prefConfig.config || {};
      return settings[eventType] !== false; // Only skip if explicitly turned off by admin
    } catch (e) {
      return true; // Failsafe: send if we can't read config
    }
  }

  /**
   * The central dispatcher for SMS. Handles fallback routing and payload generation.
   */
  async sendDynamicSms(phone: string, eventType: SmsEventType, variables: Record<string, string>) {
    if (!phone) return;

    const isEnabled = await this.shouldSendSms(eventType);
    if (!isEnabled) {
      this.logger.log(`Skipping SMS for event ${eventType} (Disabled by Admin)`);
      return; 
    }

    // Generate the raw text string for Twilio / Fast2SMS
    const fallbackMessage = SMS_FALLBACK_TEMPLATES[eventType](variables);

    // Dispatch via SmsService with payload mapping for MSG91 templates
    await this.smsService.sendSMS(phone, fallbackMessage, {
      templateKey: eventType,
      variables,
    });
  }

  /**
   * Generates secure 6-digit OTP, saves to Cache with 5m expiry, and routes to Email/SMS
   */
  async sendOtp(identifier: string, isEmail: boolean = true) {
    const rateLimitKey = `rate_limit_${identifier}`;
    const attempts = (await this.cacheManager.get<number>(rateLimitKey)) || 0;

    if (attempts >= 3) {
      throw new BadRequestException('Too many OTP requests. Please wait 5 minutes.');
    }

    // ✅ Generate Cryptographically Secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    await this.cacheManager.set(`otp_${identifier}`, otp, 5 * 60 * 1000);
    await this.cacheManager.set(rateLimitKey, attempts + 1, 5 * 60 * 1000);

    if (isEmail) {
      const message = `Your Verification Code is ${otp}. It will expire in 5 minutes.`;
      await this.emailService.sendEmail(
        identifier,
        'Your OTP Code',
        `<h2>${message}</h2>`,
      );
    } else {
      // 🔥 Route through the new dynamic SMS pipeline using the strict OTP flag
      await this.sendDynamicSms(identifier, 'OTP', { OTP: otp });
    }
    return { success: true, message: 'OTP sent successfully' };
  }

  /**
   * Validates user-submitted OTP against the cache
   */
  async verifyOtp(identifier: string, otp: string) {
    const storedOtp = await this.cacheManager.get<string>(`otp_${identifier}`);
    if (!storedOtp) throw new BadRequestException('OTP expired or invalid');
    if (storedOtp !== otp) throw new BadRequestException('Incorrect OTP');

    await this.cacheManager.del(`otp_${identifier}`);
    await this.cacheManager.del(`rate_limit_${identifier}`);

    return { success: true, message: 'OTP verified successfully' };
  }

  /**
   * Dispatches dual notifications (Email + SMS) when an order is placed/confirmed
   */
  async sendOrderConfirmation(
    user: { email: string; phone: string; name: string },
    order: { id: string; amount: number | string },
  ) {
    const emailHtml = `
      <h1>Thank you for your order, ${user.name}!</h1>
      <p>Your order ID is <strong>${order.id}</strong> for the amount of ₹${order.amount}.</p>
    `;

    // 1. Fire and forget email notification
    if (user.email) {
      this.emailService.sendEmail(user.email, 'Order Confirmation', emailHtml).catch(e => {
        this.logger.error(`Failed to send order email: ${e.message}`);
      });
    }

    // 2. Route SMS through the configurable dynamic pipeline
    if (user.phone) {
      await this.sendDynamicSms(user.phone, 'ORDER_CONFIRMED', {
        NAME: user.name || 'Customer',
        ORDER_ID: order.id,
        AMOUNT: order.amount?.toString() || '0',
      });
    }
  }
}