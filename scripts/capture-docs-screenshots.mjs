#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const desktopDir = path.join(root, 'apps/desktop');
const outputDir = path.join(root, 'docs/images');
const baseUrl = 'http://localhost:5199';

const VIEWPORT = { width: 1280, height: 800 };

const SHOTS = [
  { file: 'overview.png', page: 'settings' },
  { file: 'settings.png', page: 'settings' },
  { file: 'connect.png', page: 'connect' },
  { file: 'mesh.png', page: 'home' },
  {
    file: 'forward.png',
    page: 'forward',
    before: async (page) => {
      await page.getByRole('button', { name: /^进行中/ }).click();
    },
  },
  { file: 'stain.png', page: 'stain' },
  {
    file: 'session-panel.png',
    page: 'settings',
    clip: { x: 960, y: 56, width: 320, height: 744 },
  },
];

async function waitForHttpReady(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('docs dev server 启动超时');
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const server = spawn(
    'pnpm',
    ['exec', 'vite', '--config', 'vite.docs.config.ts'],
    { cwd: desktopDir, stdio: 'ignore' },
  );

  try {
    await waitForHttpReady(`${baseUrl}/`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });

    for (const shot of SHOTS) {
      await page.goto(`${baseUrl}/?page=${shot.page}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      if (shot.before) {
        await shot.before(page);
        await page.waitForTimeout(400);
      }
      await page.screenshot({
        path: path.join(outputDir, shot.file),
        clip: shot.clip,
      });
      console.log(`✓ ${shot.file}`);
    }

    await browser.close();
  } finally {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
