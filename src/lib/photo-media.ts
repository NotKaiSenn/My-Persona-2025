import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageMetadata } from 'astro/assets/utils';
import type { Photo } from './collections';

export async function resolvePhotoDimensions(photos: readonly Photo[], publicDir: URL): Promise<Photo[]> {
  const uploadsDir = resolve(fileURLToPath(publicDir), 'uploads');
  const dimensions = new Map<string, Promise<Pick<Photo, 'width' | 'height'>>>();

  return Promise.all(photos.map(async photo => {
    if (!photo.src.startsWith('/uploads/')) return photo;

    const imagePath = resolve(uploadsDir, decodeURIComponent(photo.src.slice('/uploads/'.length)));
    const relativePath = relative(uploadsDir, imagePath);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new Error(`Photo ${photo.id} must point to a file within /uploads/.`);
    }

    let metadata = dimensions.get(imagePath);
    if (!metadata) {
      metadata = readFile(imagePath).then(data => imageMetadata(data, photo.src));
      dimensions.set(imagePath, metadata);
    }
    try {
      const { width, height } = await metadata;
      return { ...photo, width, height };
    } catch (cause) {
      throw new Error(`Unable to read local photo ${photo.src}.`, { cause });
    }
  }));
}
