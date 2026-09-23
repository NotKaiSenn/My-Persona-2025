import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'blog-hooks-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, CI: '', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  mkdirSync(join(root, 'scripts'));
  copyFileSync(new URL('../scripts/install-git-hooks.mjs', import.meta.url), join(root, 'scripts/install-git-hooks.mjs'));
  const install = (extraEnv = {}) => spawnSync(process.execPath, ['scripts/install-git-hooks.mjs'], {
    cwd: root, env: { ...env, ...extraEnv }, encoding: 'utf8',
  });
  return { root, git, install };
}

test('hook installation is local and can be repeated; CI does not install it', t => {
  const { root, git, install } = fixture(t);
  const configBefore = git('config', '--local', '--list');
  assert.equal(install({ CI: 'true' }).status, 0);
  assert.equal(git('config', '--local', '--list'), configBefore);
  const exclude = '# preserved local rules\n/local-notes/\n';
  writeFileSync(join(root, '.git/info/exclude'), exclude);
  assert.equal(install().status, 0);
  assert.equal(install().status, 0);
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), '.githooks');
  assert.equal(git('check-ignore', 'local-notes/example.txt'), 'local-notes/example.txt');
});

test('installation refuses to replace existing hook configuration', t => {
  const { git, install } = fixture(t);
  git('config', '--local', 'core.hooksPath', 'custom hooks');
  const result = install();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /未覆盖原配置/);
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), 'custom hooks');
});

test('installation preserves an existing executable hook in the default directory', t => {
  const { root, git, install } = fixture(t);
  writeFileSync(join(root, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const configBefore = git('config', '--local', '--list');
  assert.notEqual(install().status, 0);
  assert.equal(git('config', '--local', '--list'), configBefore);
});
