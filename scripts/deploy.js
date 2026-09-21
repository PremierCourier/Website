// Build + audit, then force-push dist/ to a Pages branch.
//
//   node scripts/deploy.js preview      → DEPLOY_REMOTE (this repo), branch gh-pages — before launch
//   node scripts/deploy.js production   → DEPLOY_REMOTE (this repo), branch gh-pages; requires APPROVED=1
//
// DEPLOY_REMOTE is a full git URL (CI passes one with a token). The deploy commit carries
// only the repo identity.

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.js';
import { audit } from './audit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const IDENTITY = ['-c', 'user.name=Premier Courier', '-c', 'user.email=support@premiercourieraz.com'];

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!['preview', 'production'].includes(target)) die('usage: node scripts/deploy.js preview|production');
if (target === 'production' && process.env.APPROVED !== '1') {
  die('Refusing to deploy production: set APPROVED=1 only after Alanna approves the preview in writing.');
}
const remote = process.env.DEPLOY_REMOTE;
if (!remote) die('DEPLOY_REMOTE is not set (git URL of the Pages repo).');

try {
  await build(target);
} catch (e) {
  die(e.message);
}
const { failures } = await audit();
if (failures.length) die(`Audit failed — not deploying:\n${failures.map((f) => `  ${f}`).join('\n')}`);

const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
const tmp = await mkdtemp(path.join(os.tmpdir(), 'pcaz-deploy-'));
try {
  await cp(path.join(ROOT, 'dist'), tmp, { recursive: true });
  const git = (...args) => execFileSync('git', [...IDENTITY, ...args], { cwd: tmp, stdio: 'inherit' });
  git('init', '-q', '-b', 'gh-pages');
  git('add', '-A');
  git('commit', '-q', '-m', `Deploy ${target} ${sha}`);
  git('push', '-q', '--force', remote, 'gh-pages');
  console.log(`Deployed ${target} (${sha}).`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
