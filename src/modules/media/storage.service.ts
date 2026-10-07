import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';

export const storageRoot = path.resolve(env.STORAGE_ROOT);
export const temporaryRoot = path.join(storageRoot, '.tmp');

export const ensureStorage = async (): Promise<void> => {
  await Promise.all([
    mkdir(temporaryRoot, { recursive: true }),
    mkdir(path.join(storageRoot, 'audio', 'raw'), { recursive: true }),
    mkdir(path.join(storageRoot, 'audio', 'processed'), { recursive: true }),
    mkdir(path.join(storageRoot, 'images'), { recursive: true }),
  ]);
};

export const storagePath = (storageKey: string): string => {
  const resolved = path.resolve(storageRoot, storageKey);
  if (resolved !== storageRoot && !resolved.startsWith(`${storageRoot}${path.sep}`)) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Chemin de stockage invalide.');
  }
  return resolved;
};

export const buildStorageKey = (folder: string, extension: string): string => {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return path.posix.join(folder, String(year), month, `${randomUUID()}.${extension}`);
};

export const moveFile = async (source: string, storageKey: string): Promise<string> => {
  const destination = storagePath(storageKey);
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await rename(source, destination);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EXDEV') throw error;
    await pipeline(createReadStream(source), createWriteStream(destination, { flags: 'wx' }));
    await rm(source, { force: true });
  }
  return destination;
};

export const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest('hex');
};

export const fileSize = async (filePath: string): Promise<number> => (await stat(filePath)).size;

export const removeFileQuietly = async (filePath: string | undefined): Promise<void> => {
  if (!filePath) return;
  try {
    const resolved = path.resolve(filePath);
    if (resolved.startsWith(`${storageRoot}${path.sep}`)) await rm(resolved, { force: true });
  } catch {
    // Le nettoyage ne doit pas masquer l’erreur métier initiale.
  }
};
