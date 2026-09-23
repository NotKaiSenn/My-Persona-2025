import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CONTENT_PATHS } from '../scripts/check-content-boundary.mjs';

const script = fileURLToPath(new URL('../scripts/check-content-boundary.mjs', import.meta.url));
const zero = '0'.repeat(40);
const codePath = 'src/components/Example.astro';
const contentFiles = CONTENT_PATHS.map(path => path.endsWith('.json') ? path : `${path}/example.txt`);
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };

function repository(t) {
  const root = mkdtempSync(join(tmpdir(), 'blog-content-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'work');
  const remote = join(root, 'origin.git');
  mkdirSync(cwd);
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--bare', remote);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Content boundary test');
  git('config', 'user.email', 'content-boundary@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.autocrlf', 'false');
  git('remote', 'add', 'origin', remote);
  const write = (path, value) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), value);
  };
  const commit = (message, paths = []) => {
    if (paths.length) git('add', '--', ...paths);
    git('commit', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  write(codePath, '<p>Template</p>\n');
  contentFiles.forEach(path => write(path, path.endsWith('.json') ? '{"items":[]}\n' : 'Initial content\n'));
  const base = commit('Initial site', [codePath, ...contentFiles]);
  git('push', '-u', 'origin', 'main');
  const run = (args, input) => spawnSync(process.execPath, [script, ...args], { cwd, env, input, encoding: 'utf8' });
  return {
    cwd, remote, git, write, commit, base,
    check(head = 'HEAD', baseRef = 'origin/main') { return run(['--base', baseRef, '--head', head]); },
    push(lines) { return run(['--pre-push', 'origin', remote], `${lines.join('\n')}\n`); },
  };
}

function allowed(result) {
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

function blocked(result, paths = []) {
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  for (const path of paths) assert.ok((result.stdout + result.stderr).includes(path), `the rejection identifies ${path}`);
}

function pushLine(branch, local, remote = zero) {
  return `refs/heads/${branch} ${local} refs/heads/${branch} ${remote}`;
}

test('content boundaries match every Pages CMS content and media location', () => {
  const cms = parse(readFileSync(new URL('../.pages.yml', import.meta.url), 'utf8'));
  const managed = [...cms.content.map(entry => entry.path), ...cms.media.map(entry => entry.input)];
  assert.deepEqual([...CONTENT_PATHS].sort(), managed.sort());
});

test('importing the guard does not run a check or require a Git repository', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'blog-content-import-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const url = new URL('../scripts/check-content-boundary.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)}); process.stdout.write('imported');`], { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'imported');
  assert.equal(result.stderr, '');
});

test('framework changes pass while modifications to each managed location are rejected', t => {
  const repo = repository(t);
  repo.write(codePath, '<p>Updated template</p>\n');
  const framework = repo.commit('Update template', [codePath]);
  allowed(repo.check());
  for (const path of contentFiles) {
    repo.git('switch', '--detach', framework);
    repo.write(path, 'Changed outside CMS\n');
    repo.commit('Change content', [path]);
    blocked(repo.check(), [path]);
  }
});

test('content additions, deletions and renames across the boundary are rejected', t => {
  const repo = repository(t);
  const added = 'src/content/posts/带 空格的笔记.md';
  repo.write(added, 'New note\n');
  repo.commit('Add content', [added]);
  blocked(repo.check(), [added]);

  repo.git('switch', '--detach', repo.base);
  const deleted = 'src/data/friends.json';
  repo.git('rm', '--', deleted);
  repo.commit('Delete content');
  blocked(repo.check(), [deleted]);

  repo.git('switch', '--detach', repo.base);
  const renamed = 'src/content/posts/example.txt';
  repo.git('mv', '--', renamed, 'src/components/moved-content.txt');
  repo.commit('Move content out');
  blocked(repo.check(), [renamed]);

  repo.git('switch', '--detach', repo.base);
  const movedIn = 'public/uploads/moved-framework.txt';
  repo.git('mv', '--', codePath, movedIn);
  repo.commit('Move framework into content');
  blocked(repo.check(), [movedIn]);
});

test('reverting content later does not hide the content commit being pushed', t => {
  const repo = repository(t);
  const path = 'src/data/photos.json';
  repo.write(path, '{"items":[{"id":"accidental"}]}\n');
  const accidental = repo.commit('Change content', [path]);
  repo.git('revert', '--no-edit', accidental);
  assert.equal(repo.git('diff', '--name-only', repo.base, 'HEAD'), '');
  blocked(repo.check(), [path]);
});

test('an old dev branch and a normal merge from CMS main preserve the content boundary', t => {
  const repo = repository(t);
  repo.git('branch', 'dev');
  const path = 'src/data/site.json';
  repo.write(path, '{"name":"CMS profile"}\n');
  repo.commit('CMS update', [path]);
  repo.git('push', 'origin', 'main');
  repo.git('switch', 'dev');
  repo.write(codePath, '<p>New development</p>\n');
  repo.commit('Update framework', [codePath]);
  allowed(repo.check());
  assert.ok(repo.git('diff', '--name-only', 'origin/main', 'HEAD').includes(path), 'the old snapshot differs, but is not a developer edit');

  repo.git('merge', '--no-edit', 'main');
  allowed(repo.check());
  allowed(repo.push([pushLine('dev', repo.git('rev-parse', 'HEAD'))]));
});

test('extra content changes recorded in a merge commit are still rejected', t => {
  const repo = repository(t);
  repo.git('branch', 'dev');
  repo.write('src/data/site.json', '{"name":"CMS profile"}\n');
  repo.commit('CMS update', ['src/data/site.json']);
  repo.git('push', 'origin', 'main');
  repo.git('switch', 'dev');
  repo.write(codePath, '<p>New development</p>\n');
  repo.commit('Update framework', [codePath]);
  repo.git('merge', '--no-commit', '--no-ff', 'main');
  const path = 'src/data/photos.json';
  repo.write(path, '{"items":[{"id":"merge-edit"}]}\n');
  repo.commit('Merge with extra content edit', [path]);
  assert.equal(repo.git('show', '-s', '--format=%P', 'HEAD').split(' ').length, 2);
  blocked(repo.check(), [path]);
});

test('pre-push checks every new ref and rejects content already present on an existing dev branch', t => {
  const repo = repository(t);
  repo.git('switch', '-c', 'clean');
  repo.write(codePath, '<p>Clean branch</p>\n');
  const clean = repo.commit('Update framework', [codePath]);
  allowed(repo.push([pushLine('clean', clean)]));

  repo.git('switch', '-c', 'dev');
  const path = 'src/data/works.json';
  repo.write(path, '{"items":[{"title":"Unreviewed content"}]}\n');
  const content = repo.commit('Change work entry', [path]);
  blocked(repo.push([pushLine('clean', clean), pushLine('dev', content)]), [path]);
  repo.git('update-ref', 'refs/remotes/origin/dev', content);
  repo.write(codePath, '<p>Later code-only update</p>\n');
  const later = repo.commit('Update only framework', [codePath]);
  blocked(repo.push([pushLine('dev', later, content)]), [path]);
  allowed(repo.push([pushLine('dev', zero, later)]));
});

test('direct main code updates pass, content updates and backward main pushes fail', t => {
  const repo = repository(t);
  repo.write(codePath, '<p>Small fix</p>\n');
  const code = repo.commit('Small framework fix', [codePath]);
  allowed(repo.push([pushLine('main', code, repo.base)]));
  blocked(repo.push([pushLine('main', repo.base, code)]));

  const path = 'src/data/photos.json';
  repo.write(path, '{"items":[{"id":"local-edit"}]}\n');
  const content = repo.commit('Local content update', [path]);
  blocked(repo.push([pushLine('main', content, code)]), [path]);
});

test('missing main bases, unknown objects and malformed push input fail closed', t => {
  const repo = repository(t);
  const unknown = 'f'.repeat(40);
  blocked(repo.check('HEAD', unknown));
  blocked(repo.check(unknown));
  blocked(repo.push([pushLine('main', repo.base, unknown)]));
  blocked(repo.push([pushLine('dev', unknown)]));
  blocked(repo.push([pushLine('main', repo.base)]));
  blocked(repo.push(['not a pre-push record']));

  repo.git('update-ref', '-d', 'refs/remotes/origin/main');
  blocked(repo.push([pushLine('dev', repo.base)]));
});

test('the installed pre-push hook blocks a real content push before the remote branch is created', t => {
  const repo = repository(t);
  repo.write('scripts/check-content-boundary.mjs', readFileSync(script, 'utf8'));
  repo.write('.githooks/pre-push', readFileSync(new URL('../.githooks/pre-push', import.meta.url), 'utf8'));
  chmodSync(join(repo.cwd, '.githooks/pre-push'), 0o755);
  repo.git('config', 'core.hooksPath', '.githooks');
  repo.git('switch', '-c', 'dev');
  repo.write(codePath, '<p>Permitted framework update</p>\n');
  const code = repo.commit('Update framework', [codePath]);
  repo.git('push', 'origin', 'dev');
  assert.equal(repo.git('ls-remote', 'origin', 'refs/heads/dev').split(/\s+/)[0], code);

  repo.git('switch', '-c', 'content-edit');
  const path = 'src/data/friends.json';
  repo.write(path, '{"items":[{"name":"Local edit"}]}\n');
  repo.commit('Change content locally', [path]);
  const result = spawnSync('git', ['push', 'origin', 'content-edit'], { cwd: repo.cwd, env, encoding: 'utf8' });
  blocked(result, [path]);
  assert.equal(repo.git('ls-remote', 'origin', 'refs/heads/content-edit'), '', 'the rejected branch never reaches the remote');
  assert.equal(repo.git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0], repo.base);
});
