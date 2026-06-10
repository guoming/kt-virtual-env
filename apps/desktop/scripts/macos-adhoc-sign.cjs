'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

// [AI-GEN] scope:macos-adhoc-sign, model:auto, reviewed:false
/** 无 Apple 开发者证书时，在打包完成后对 .app 及内嵌二进制做 adhoc 深签名 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
};
// [/AI-GEN]
