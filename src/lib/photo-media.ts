import type { Photo } from './collections';
import { localImageDimensions } from './image-dimensions.ts';

export async function resolvePhotoDimensions(photos: readonly Photo[], publicDir: URL): Promise<Photo[]> {
  const readDimensions = localImageDimensions(publicDir);
  return Promise.all(photos.map(async photo => {
    const dimensions = await readDimensions(photo.src, 'photo');
    return dimensions ? { ...photo, ...dimensions } : photo;
  }));
}
