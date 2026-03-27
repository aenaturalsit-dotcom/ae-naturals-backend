//src/profile/profile.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Profile
  @Get('users/me')
  getProfile(@Request() req) {
    return this.profileService.getProfile(req.user.sub);
  }

  @Patch('users/update')
  updateProfile(@CurrentUser('userId') userId: string, @Body() data: any) {
    return this.profileService.updateProfile(userId, data);
  }

  // Addresses
  @Get('addresses')
  getAddresses(@Request() req) {
    return this.profileService.getAddresses(req.user.sub);
  }

  @Post('addresses')
  addAddress(@Request() req, @Body() data: any) {
    return this.profileService.addAddress(req.user.sub, data);
  }

  @Patch('addresses/:id')
  updateAddress(@Request() req, @Param('id') id: string, @Body() data: any) {
    return this.profileService.updateAddress(req.user.sub, id, data);
  }

  @Delete('addresses/:id')
  deleteAddress(@Request() req, @Param('id') id: string) {
    return this.profileService.deleteAddress(req.user.sub, id);
  }

  // Wishlist
  @Get('wishlist')
  getWishlist(@Request() req) {
    return this.profileService.getWishlist(req.user.sub);
  }

  @Post('wishlist/:productId')
  toggleWishlist(@Request() req, @Param('productId') productId: string) {
    return this.profileService.toggleWishlist(req.user.sub, productId);
  }

  // Reviews
  @Get('reviews/my')
  getMyReviews(@Request() req) {
    return this.profileService.getMyReviews(req.user.sub);
  }

  @Post('reviews')
  addReview(@Request() req, @Body() data: any) {
    return this.profileService.addReview(req.user.sub, data);
  }

  @Delete('reviews/:id')
  deleteReview(@Request() req, @Param('id') id: string) {
    return this.profileService.deleteReview(req.user.sub, id);
  }
}