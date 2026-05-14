import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Returns multer disk-storage options scoped to a given subfolder under `./uploads/`.
 * Files are renamed to a UUID so original filenames cannot be used for path traversal.
 */
export function imageUploadOptions(subfolder: string): MulterOptions {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dest = path.join(process.cwd(), 'uploads', subfolder);
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(
          new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed'),
          false,
        );
      }
      cb(null, true);
    },
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
  };
}
