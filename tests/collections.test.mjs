import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/collections.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
const collectionModule = {};
new Function('exports', 'require', compiled.outputText)(collectionModule, createRequire(fileURLToPath(sourceUrl)));
const { parsePhotos, parseFriends, parseWorks } = collectionModule;

const photo = { id: 'window', title: '窗边', date: '2026-09-21', src: '/uploads/window.webp', alt: '窗外的树', width: 1600, height: 900 };

test('photo data rejects duplicate routes, invalid calendar dates and missing image sources', () => {
  assert.throws(() => parsePhotos({ items: [photo, { ...photo, title: '另一个标题' }] }), /Duplicate photo id/);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', 'not-a-date']) {
    assert.throws(() => parsePhotos({ items: [{ ...photo, date }] }), /valid date/);
  }
  assert.throws(() => parsePhotos({ items: [{ ...photo, id: '../window' }] }), /\.id/);
  assert.throws(() => parsePhotos({ items: [{ ...photo, src: '' }] }), /\.src/);
  assert.throws(() => parsePhotos({ items: [{ ...photo, width: -1 }] }), /dimension/);
  assert.throws(() => parsePhotos({ items: [{ ...photo, height: '900' }] }), /dimension/);
  assert.equal(parsePhotos({ items: [{ ...photo, date: '2024-02-29' }] })[0].date, '2024-02-29');
});

test('media paths stay within uploads and remote links use HTTPS without credentials', () => {
  for (const src of ['/uploads/../private.webp', '/uploads/%2e%2e/private.webp', '/uploads/%5cprivate.webp', '/uploads/', '//example.com/photo.webp', 'javascript:alert(1)', 'http://example.com/photo.webp', 'https://user:password@example.com/photo.webp']) {
    assert.throws(() => parsePhotos({ items: [{ ...photo, src }] }), undefined, src);
    assert.throws(() => parseFriends({ items: [{ name: '朋友', url: 'https://example.com/', avatar: src }] }), undefined, src);
  }
  const remote = parsePhotos({ items: [{ ...photo, src: '', externalSrc: 'https://cdn.example.com/photo.webp?version=2' }] });
  assert.equal(remote[0].src, 'https://cdn.example.com/photo.webp?version=2');
  assert.throws(() => parsePhotos({ items: [{ ...photo, externalSrc: 'http://cdn.example.com/photo.webp' }] }), /HTTPS/);
  for (const url of ['http://example.com', 'javascript:alert(1)', 'https://user:password@example.com']) {
    assert.throws(() => parseFriends({ items: [{ name: '朋友', url }] }), /HTTPS/);
  }
});

test('friend avatars accept uploads and give HTTPS external overrides priority', () => {
  const friend = { name: '测试友链', url: 'https://example.com/', avatar: '/uploads/avatar.webp' };
  assert.equal(parseFriends({ items: [friend] })[0].avatar, '/uploads/avatar.webp');
  assert.equal(parseFriends({ items: [{ ...friend, avatarUrl: 'https://cdn.example.com/avatar.webp' }] })[0].avatar, 'https://cdn.example.com/avatar.webp');
  assert.equal(parseFriends({ items: [{ ...friend, avatar: '', avatarUrl: 'https://cdn.example.com/avatar.webp' }] })[0].avatar, 'https://cdn.example.com/avatar.webp');
  assert.equal(parseFriends({ items: [{ ...friend, avatarUrl: '' }] })[0].avatar, '/uploads/avatar.webp');
  for (const avatarUrl of ['/uploads/avatar.webp', 'http://example.com/avatar.webp', 'https://user:password@example.com/avatar.webp']) {
    assert.throws(() => parseFriends({ items: [{ ...friend, avatarUrl }] }), /HTTPS/);
  }
});

test('CMS works keep configured order, accept optional uploaded covers and prioritize external covers', () => {
  const work = { id: 'first', title: '第一个作品', url: '/lab/', description: '作品说明', image: '/uploads/work.png' };
  const works = parseWorks({ items: [
    work,
    { id: 'second', title: '第二个作品', url: 'https://example.com/' },
    { ...work, id: 'third', imageUrl: 'https://cdn.example.com/work.png' },
  ] });
  assert.deepEqual(works.map(work => work.id), ['first', 'second', 'third']);
  assert.deepEqual(works.map(work => work.image), ['/uploads/work.png', undefined, 'https://cdn.example.com/work.png']);
  assert.equal(works[0].description, '作品说明');
  assert.deepEqual(parseWorks({ items: [] }), []);
});

test('works reject duplicate identifiers, unsafe destinations and invalid cover paths', () => {
  const work = { id: 'example', title: '作品', url: '/lab/' };
  assert.throws(() => parseWorks({ items: [work, work] }), /Duplicate work id/);
  assert.throws(() => parseWorks({ items: [{ ...work, id: '../example' }] }), /\.id/);
  for (const url of ['//example.com/', '/%2fexample.com/', '/\\example.com/', 'javascript:alert(1)', 'http://example.com/', 'https://user:password@example.com/']) {
    assert.throws(() => parseWorks({ items: [{ ...work, url }] }), undefined, url);
  }
  for (const image of ['/uploads/../private.png', '/uploads/%2e%2e/private.png', '/uploads/', '//example.com/photo.png', 'http://example.com/photo.png']) {
    assert.throws(() => parseWorks({ items: [{ ...work, image }] }), undefined, image);
  }
});
