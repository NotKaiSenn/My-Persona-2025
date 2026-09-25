import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolveWorkDimensions } from '../src/lib/work-media.ts';
import { writeTransparentPng } from './helpers/image-fixture.mjs';

const work = { title: '测试作品', url: '/project/', width: 1, height: 1 };

test('work images use real dimensions and prefer a legacy cover over its icon', async t => {
  const root = mkdtempSync(join(tmpdir(), 'blog-work-media-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'uploads'));
  writeTransparentPng(join(root, 'uploads/作品.png'), 12, 7);
  writeTransparentPng(join(root, 'uploads/icon.png'), 3, 8);
  const loaded = await resolveWorkDimensions([
    { ...work, image: '/uploads/作品.png', icon: '/uploads/icon.png', width: 900, height: 1600 },
    { ...work, icon: '/uploads/icon.png' },
    { ...work, image: '/uploads/%E4%BD%9C%E5%93%81.png' },
  ], pathToFileURL(root));
  assert.deepEqual(loaded.map(({ width, height }) => [width, height]), [[12, 7], [3, 8], [12, 7]]);
  assert.deepEqual([work.width, work.height], [1, 1]);
});

test('remote and imageless works keep supplied or fallback geometry without fetching', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Work metadata must not be fetched.'); });
  const remote = { ...work, image: 'https://images.example.com/cover.webp', icon: '/uploads/missing.png', width: 900, height: 1600 };
  const fallback = { ...work, icon: 'https://images.example.com/unknown-size.webp' };
  assert.deepEqual(await resolveWorkDimensions([remote, fallback, work], new URL('file:///missing-public-directory/')), [remote, fallback, work]);
});

test('missing, corrupt and out-of-directory local work images fail clearly', async t => {
  const root = mkdtempSync(join(tmpdir(), 'blog-work-media-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'uploads'));
  writeFileSync(join(root, 'uploads/invalid.png'), 'not an image');
  for (const image of ['/uploads/missing.png', '/uploads/invalid.png']) {
    await assert.rejects(resolveWorkDimensions([{ ...work, image }], pathToFileURL(root)), /Unable to read local work/);
  }
  await assert.rejects(resolveWorkDimensions([{ ...work, icon: '/uploads/%2e%2e/private.png' }], pathToFileURL(root)), /within \/uploads\//);
});
