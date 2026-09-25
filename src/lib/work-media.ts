import type { Work } from './collections';
import { localImageDimensions } from './image-dimensions.ts';

export async function resolveWorkDimensions(works: readonly Work[], publicDir: URL): Promise<Work[]> {
  const readDimensions = localImageDimensions(publicDir);
  return Promise.all(works.map(async work => {
    const src = work.image ?? work.icon;
    const dimensions = src && await readDimensions(src, 'work');
    return dimensions ? { ...work, ...dimensions } : work;
  }));
}
