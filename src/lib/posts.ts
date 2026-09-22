import { getCollection } from 'astro:content';
import { publishedPosts } from './post-data';

export async function getPosts() {
  return publishedPosts(await getCollection('posts'));
}
