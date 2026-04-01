// src/modules/cart/cart.controller.ts
import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from '../dto/cart.dto';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';


@UseGuards(AuthGuard('jwt'))
@Controller('cart')                          
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: any) {
    return this.cartService.getCart(user.tenantId, user.userId, user.sessionId);
  }

  @Post('items')
  async addItem(@CurrentUser() user: any, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(user.tenantId, user.userId, user.sessionId, dto);
  }

  @Post('merge')
  async mergeCart(@CurrentUser() user: any) {
    if (!user.userId || !user.sessionId) return { message: 'No merge required' };
    await this.cartService.mergeGuestCart(user.tenantId, user.userId, user.sessionId);
    return { success: true, message: 'Cart merged successfully' };
  }
}