// src/types/global.d.ts
declare global {
  namespace Express {
    interface Multer {
      File: Multer.File;
    }
  }
}

// Cette exportation est nécessaire pour que le fichier soit considéré comme un module
export {};
