/**
 * Multer config for in-memory upload (then we send to S3 in controller)
 */

import multer from 'multer';
import { uploadLimits, uploadFilter } from '../services/uploadService';

const storage = multer.memoryStorage();

export const uploadPackagePhoto = multer({
  storage,
  limits: uploadLimits,
  fileFilter: uploadFilter,
}).single('package_photo');
