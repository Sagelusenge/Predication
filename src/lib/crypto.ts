import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const createToken = (bytes = 48): string => randomBytes(bytes).toString('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const sha256FileBuffer = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('hex');

export const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
