import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolvePhotoDimensions } from '../src/lib/photo-media.ts';
import { writeTinyPng } from './helpers/image-fixture.mjs';

const photo = { id: 'test', title: '测试照片', date: '2026-09-21', src: '/uploads/照片.png', alt: '测试', width: 4, height: 3 };

test('uploaded photos use real dimensions, including encoded filenames and stale manual values', async t => {
  const root = mkdtempSync(join(tmpdir(), 'blog-photo-media-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'uploads'));
  writeTinyPng(join(root, 'uploads/照片.png'));
  const loaded = await resolvePhotoDimensions([
    photo,
    { ...photo, id: 'encoded', src: '/uploads/%E7%85%A7%E7%89%87.png', width: 300, height: 400 },
  ], pathToFileURL(root));
  assert.deepEqual(loaded.map(({ width, height }) => [width, height]), [[1, 1], [1, 1]]);
  assert.deepEqual([photo.width, photo.height], [4, 3]);
});

test('remote photos keep their supplied dimensions without making a network request', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Remote photo metadata must not be fetched.'); });
  const remote = { ...photo, src: 'https://images.example.com/unavailable.webp', width: 900, height: 1600 };
  const fallback = { ...photo, id: 'fallback', src: 'https://images.example.com/no-size.webp' };
  assert.deepEqual(await resolvePhotoDimensions([remote, fallback], new URL('file:///missing-public-directory/')), [remote, fallback]);
});

test('missing, invalid and out-of-directory local photos fail with an actionable error', async t => {
  const root = mkdtempSync(join(tmpdir(), 'blog-photo-media-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'uploads'));
  writeFileSync(join(root, 'uploads/invalid.webp'), 'not an image');
  for (const src of ['/uploads/missing.webp', '/uploads/invalid.webp']) {
    await assert.rejects(resolvePhotoDimensions([{ ...photo, src }], pathToFileURL(root)), new RegExp(`Unable to read local photo ${src}`));
  }
  await assert.rejects(resolvePhotoDimensions([{ ...photo, src: '/uploads/%2e%2e/private.webp' }], pathToFileURL(root)), /within \/uploads\//);
});
