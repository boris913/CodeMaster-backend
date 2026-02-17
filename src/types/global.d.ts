// src/types/global.d.ts
import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
    interface Multer {
      File: Multer.File;
    }
  }
}

export {};
