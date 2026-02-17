/**
 * Multer + AWS S3 – package photo uploads
 */

import { Upload } from '@aws-sdk/lib-storage';
import { s3Client, S3_BUCKET, isS3Configured } from '../config/aws';
import { BadRequestError } from '../utils/errors';
import { generateId } from '../utils/helpers';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

export const uploadLimits = {
  fileSize: MAX_FILE_SIZE,
};

export function uploadFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (err: Error | null, accept?: boolean) => void
): void {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new BadRequestError('Only JPEG, PNG, WebP images are allowed'));
  }
  cb(null, true);
}

export async function uploadToS3(
  buffer: Buffer,
  mimetype: string,
  prefix: string = 'missions'
): Promise<string> {
  if (!isS3Configured() || !s3Client) {
    throw new BadRequestError('File storage is not configured');
  }
  const key = `${prefix}/${generateId()}.${mimetype.split('/')[1] || 'jpg'}`;
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    },
  });
  await upload.done();
  const region = process.env.AWS_REGION || 'eu-west-1';
  const url = `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
  return url;
}
