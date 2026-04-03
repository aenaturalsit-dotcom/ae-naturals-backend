// src/orders/orders.controller.ts
import { Controller, Get, Post, Body, Req, UseGuards, Logger, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private ordersService: OrdersService,) {}

  @Post('create')
  async create(@Req() req, @Body('storeId') storeId: string) {
    // DEBUG: Logs to verify data arrival before service call
    this.logger.log(`Incoming Order Request | User: ${req.user?.userId} | Store: ${storeId}`);
    
    return this.ordersService.createOrder(req.user.userId, storeId);
  }

  @Get('my-orders')
  async list(@Req() req) {
    return this.ordersService.getMyOrders(req.user.userId);
  }

  // src/orders/orders.controller.ts
@Get(':id/status')
async getOrderStatus(@Param('id') id: string, @CurrentUser() user: any) {
   return this.ordersService.getOrderStatus(user.id, id);
}

// ✅ NEW: Endpoint for the frontend to fetch summary
  @Get(':id')
  async getOrderById(@Param('id') id: string, @Req() req: any) {
    // Extract userId safely based on your JWT strategy
    const userId = req.user?.id || req.user?.userId; 
    return this.ordersService.getOrderByIdForSuccessPage(id, userId);
  }
}