// [AI-GEN] scope:windows-spawn, model:auto, reviewed:false
/** Windows CREATE_NO_WINDOW — 避免 ktctl 等控制台程序弹出命令行窗口 */
export const WINDOWS_CREATE_NO_WINDOW = 0x08000000;

export type WindowsSpawnOptions = {
  windowsHide: true;
  creationFlags: number;
};

export type WindowsExecOptions = {
  windowsHide: true;
  windowsVerbatimArguments?: boolean;
};

export function getWindowsSpawnOptions(): WindowsSpawnOptions | Record<string, never> {
  if (process.platform !== 'win32') return {};
  return { windowsHide: true, creationFlags: WINDOWS_CREATE_NO_WINDOW };
}

export function getWindowsExecOptions(): WindowsExecOptions | Record<string, never> {
  if (process.platform !== 'win32') return {};
  return { windowsHide: true };
}
// [/AI-GEN]
