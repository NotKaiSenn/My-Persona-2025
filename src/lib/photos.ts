import { publicDir } from 'astro:config/server';
import { photos as photoEntries } from './collections';
import { resolvePhotoDimensions } from './photo-media';

export const photos = await resolvePhotoDimensions(photoEntries, new URL(publicDir));
