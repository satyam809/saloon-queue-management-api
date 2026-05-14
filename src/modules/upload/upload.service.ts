import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  /**
   * Deletes a previously uploaded file from disk given its public URL path
   * (e.g. `/uploads/salons/logos/abc.jpg`). No-ops if the file does not exist.
   */
  deleteFile(urlPath: string): void {
    if (!urlPath) return;
    const relative = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    const absPath = path.join(process.cwd(), relative);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  }
}
