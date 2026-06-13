import { describe, expect, it } from 'vitest';
import {
  appleScriptQuote,
  buildLaunchDaemonPlist,
  buildMacInstallScript,
  HELPER_INSTALL_PATH,
  HELPER_LABEL,
  LAUNCHD_PLIST_PATH,
} from './helper-launchd.js';

describe('buildLaunchDaemonPlist', () => {
  it('includes KeepAlive and program arguments', () => {
    const plist = buildLaunchDaemonPlist({
      helperBinary: HELPER_INSTALL_PATH,
      socketPath: '/tmp/kt-virtual-env-helper-501.sock',
      logPath: '/Users/dev/.kt-virtual-env/helper.log',
    });
    expect(plist).toContain(`<string>${HELPER_LABEL}</string>`);
    expect(plist).toContain(`<string>${HELPER_INSTALL_PATH}</string>`);
    expect(plist).toContain('<string>-socket=/tmp/kt-virtual-env-helper-501.sock</string>');
    expect(plist).toContain('<key>KeepAlive</key>');
    expect(plist).toContain('<key>SuccessfulExit</key>');
    expect(plist).toContain('<false/>');
    expect(plist).toContain('<key>RunAtLoad</key>');
  });
});

describe('buildMacInstallScript', () => {
  it('installs helper and bootstraps launchd', () => {
    const script = buildMacInstallScript(
      '/Applications/kt-virtual-env.app/Contents/Resources/helper/helper-darwin-arm64',
      '/Users/dev/.kt-virtual-env/com.kt.virtualenv.helper.plist',
    );
    expect(script).toContain(`install -m 755 -o root -g wheel`);
    expect(script).toContain(HELPER_INSTALL_PATH);
    expect(script).toContain(LAUNCHD_PLIST_PATH);
    expect(script).toContain(`launchctl bootstrap system`);
    expect(script).toContain(`launchctl kickstart -k system/${HELPER_LABEL}`);
  });
});

describe('appleScriptQuote', () => {
  it('uses double quotes for AppleScript strings', () => {
    expect(appleScriptQuote('/bin/bash /tmp/install.sh')).toBe(
      '"/bin/bash /tmp/install.sh"',
    );
  });

  it('escapes embedded double quotes and backslashes', () => {
    expect(appleScriptQuote(String.raw`/tmp\a "b"`)).toBe('"/tmp\\\\a \\"b\\""');
  });
});
