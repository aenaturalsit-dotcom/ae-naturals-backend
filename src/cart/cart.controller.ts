// src/cart/cart.controller.ts
import { Controller, Post, Get, Body, Headers, BadRequestException, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from '../dto/cart.dto';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Hybrid Identifier Extraction (Supports Guests & Logged-in Users)
   */
  private extractIdentifiers(user: any, guestSessionId?: string) {
    const tenantId = user?.tenantId || 'default-store';
    const userId = user?.sub || user?.userId; // Mapped from new JWT payload
    const sessionId = user?.sid || guestSessionId; 

    if (!userId && !sessionId) {
      throw new BadRequestException('Cannot interact with cart: Missing User ID or Guest Session ID');
    }

    return { tenantId, userId, sessionId };
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard) // 🔥 Allows both Guests and Users
  async getCart(
    @CurrentUser() user: any,
    @Headers('x-session-id') guestSessionId: string,
  ) {
    const { tenantId, userId, sessionId } = this.extractIdentifiers(user, guestSessionId);
    return this.cartService.getCart(tenantId, userId, sessionId);
  }

  @Post('items')
  @UseGuards(OptionalJwtAuthGuard)
  async addItem(
    @CurrentUser() user: any,
    @Headers('x-session-id') guestSessionId: string,
    @Body() dto: AddToCartDto,
  ) {
    const { tenantId, userId, sessionId } = this.extractIdentifiers(user, guestSessionId);
    return this.cartService.addToCart(tenantId, userId, sessionId, dto);
  }

  @Post('merge')
  @UseGuards(OptionalJwtAuthGuard) // Need guard to get user.sub
  async mergeCart(
    @CurrentUser() user: any,
    @Headers('x-session-id') guestSessionId: string,
  ) {
    const { tenantId, userId } = this.extractIdentifiers(user, guestSessionId);

    // Merge strictly requires BOTH a logged-in user and a guest session
    if (!userId || !guestSessionId) {
      return { success: false, message: 'No merge required (missing user or guest session)' };
    }

    await this.cartService.mergeGuestCart(tenantId, userId, guestSessionId);
    return { success: true, message: 'Cart merged successfully' };
  }
}