import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';
import { Request } from 'express';

// Créons une interface pour étendre la requête avec l'utilisateur
interface RequestWithUser extends Request {
  user: User;
}

export const CurrentUser = createParamDecorator(
  <K extends keyof User>(
    data: K | undefined,
    ctx: ExecutionContext,
  ): User[K] | User => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new Error('User not found in request');
    }

    return data ? user[data] : user;
  },
);
