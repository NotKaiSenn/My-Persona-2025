import { publicDir } from 'astro:config/server';
import workData from '../data/works.json';
import { parseWorks } from './collections';
import { resolveWorkDimensions } from './work-media';

export const works = await resolveWorkDimensions(parseWorks(workData), new URL(publicDir));
