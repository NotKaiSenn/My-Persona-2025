import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({
    base: './src',
    pattern: 'content/posts/*.md',
    generateId: ({ entry }) => {
      const id = entry.split('/').at(-1)!.replace(/\.md$/, '');
      if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(id)) {
        throw new Error(`Invalid article filename: ${entry}. Use letters, numbers, hyphens or underscores.`);
      }
      return id;
    },
  }),
  schema: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().default(''),
    pubDate: z.union([z.string().trim().min(1), z.date()]).pipe(z.coerce.date()),
    draft: z.boolean().default(true),
  }),
});

export const collections = { posts };
