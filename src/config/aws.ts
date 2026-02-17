/**
 * AWS S3 configuration for package photo uploads
 */

import { S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'eu-west-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

export const S3_BUCKET = process.env.AWS_S3_BUCKET || 'eco-relais-uploads';

export const s3Client =
  accessKeyId && secretAccessKey
    ? new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    : (null as unknown as S3Client);

export function isS3Configured(): boolean {
  return Boolean(accessKeyId && secretAccessKey);
}
