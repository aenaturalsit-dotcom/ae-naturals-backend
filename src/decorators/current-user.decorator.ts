import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Support both 'sub' and 'userId' to be bulletproof
    const userId = user?.sub || user?.userId || user?.id;

    return data ? user?.[data] : { ...user, userId };
  },
);