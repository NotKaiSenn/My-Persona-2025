import workData from '../data/works.json';
import { parseWorks } from './collections';

export const works = parseWorks(workData);
