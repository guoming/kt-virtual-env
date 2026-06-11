import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());
const findBundledBinaryMock = vi.hoisted(() => vi.fn());
const findHelperPathMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('electron', () => ({
  app: { getVersion: () => '0.1.23' },
}));

vi.mock('./binary-resolver.js', () => ({
  findBundledBinary: findBundledBinaryMock,
  findHelperPath: findHelperPathMock,
}));

vi.mock('./app-release-check.js', () => ({
  fetchLatestAppVersion: async () => undefined,
}));

vi.mock('./bundled-versions.js', () => ({
  loadBundledVersions: () => ({
    ktctl: { version: '0.3.7' },
    kubectl: { version: '1.28.15' },
  }),
}));

vi.mock('./helper-launcher.js', () => ({
  isHelperRunning: async () => true,
}));

import { checkEnvironment } from './environment-check.js';

describe('checkEnvironment', () => {
  const tmpFiles: string[] = [];
  let platformSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    vi.clearAllMocks();
    platformSpy?.mockRestore();
    for (const file of tmpFiles) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
    tmpFiles.length = 0;
  });

  function mockExecVersion(versionLine: string): void {
    execFileMock.mockImplementation(
      (
        _bin: string,
        _args: string[],
        _opts: unknown,
        cb: (err: null, result: { stdout: string }) => void,
      ) => {
        cb(null, { stdout: `${versionLine}\n` });
      },
    );
  }

  it('detects missing wintun.dll on Windows without throwing', async () => {
    platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    const binDir = path.join(os.tmpdir(), `ktve-env-check-${process.pid}`);
    fs.mkdirSync(binDir, { recursive: true });
    const ktctlPath = path.join(binDir, 'ktctl.exe');
    fs.writeFileSync(ktctlPath, 'fake');
    tmpFiles.push(ktctlPath);

    const helperPath = path.join(binDir, 'helper.exe');
    fs.writeFileSync(helperPath, 'fake');
    tmpFiles.push(helperPath);

    const kubectlPath = path.join(binDir, 'kubectl.exe');
    fs.writeFileSync(kubectlPath, 'fake');
    tmpFiles.push(kubectlPath);

    findBundledBinaryMock.mockImplementation((tool: string) => {
      if (tool === 'ktctl') return ktctlPath;
      if (tool === 'kubectl') return kubectlPath;
      return null;
    });
    findHelperPathMock.mockReturnValue(helperPath);
    mockExecVersion('ktctl version 0.3.7');

    const status = await checkEnvironment();

    expect(status.ktctl.ok).toBe(false);
    expect(status.ktctl.message).toBe('wintun.dll 缺失');
    expect(status.kubectl.ok).toBe(true);
  });
});
