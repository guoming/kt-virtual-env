'use strict';

const path = require('node:path');

function hasArg(flag) {
  return process.argv.includes(flag);
}

function detectResourcePlatform() {
  if (process.env.KTVE_RESOURCE_PLATFORM) {
    return process.env.KTVE_RESOURCE_PLATFORM;
  }
  if (hasArg('--win')) {
    return 'windows-amd64';
  }
  if (hasArg('--mac') || hasArg('-m')) {
    if (hasArg('--arm64')) return 'darwin-arm64';
    if (hasArg('--x64')) return 'darwin-amd64';
    return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64';
  }
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64';
  }
  if (process.platform === 'win32') {
    return 'windows-amd64';
  }
  throw new Error(
    '无法推断打包平台，请设置 KTVE_RESOURCE_PLATFORM 或使用 --mac / --win 参数',
  );
}

// [AI-GEN] scope:electron-builder.config, model:auto, reviewed:false
const resourcePlatform = detectResourcePlatform();
const repoRoot = path.join(__dirname, '../..');

/** @type {import('electron-builder').Configuration} */
module.exports = {
  extends: 'electron-builder.yml',
  extraResources: [
    {
      from: path.join(repoRoot, 'resources/bin', resourcePlatform),
      to: path.join('bin', resourcePlatform),
    },
    {
      from: path.join(__dirname, 'resources/helper'),
      to: 'helper',
    },
    {
      from: path.join(__dirname, 'resources/tray.png'),
      to: 'tray.png',
    },
  ],
};
// [/AI-GEN]
