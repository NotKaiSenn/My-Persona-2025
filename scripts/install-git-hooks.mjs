import { execFileSync, spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (!process.env.CI && existsSync(resolve(root, '.git'))) {
  const configured = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' });
  if (configured.status !== 0 && configured.status !== 1) throw new Error('无法读取 Git hooks 配置。');
  const hooksPath = configured.stdout.trim();
  const defaultHooks = resolve(root, git('rev-parse', '--git-path', 'hooks'));
  const existingHooks = existsSync(defaultHooks) && readdirSync(defaultHooks).some(name => {
    if (name.endsWith('.sample')) return false;
    try {
      accessSync(resolve(defaultHooks, name), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
  if (hooksPath && resolve(root, hooksPath) !== resolve(root, '.githooks')) {
    throw new Error('检测到已有 Git hooks 配置，请先合并现有 hooks；未覆盖原配置。');
  }
  if (!hooksPath && existingHooks) {
    throw new Error('检测到已有 Git hooks，请先合并现有 hooks；未覆盖原配置。');
  }
  git('config', '--local', 'core.hooksPath', '.githooks');
  console.log('已启用本地 CMS 内容推送保护。');
}
