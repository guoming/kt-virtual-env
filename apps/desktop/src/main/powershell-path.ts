import fs from 'node:fs';
import path from 'node:path';

// [AI-GEN] scope:resolvePowershellPath, model:auto, reviewed:false
function powershellCandidates(): string[] {
  const candidates: string[] = [];
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (systemRoot) {
    candidates.push(
      path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    );
    candidates.push(
      path.join(systemRoot, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    );
  }
  candidates.push('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');

  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  candidates.push(path.join(programFiles, 'PowerShell', '7', 'pwsh.exe'));
  candidates.push(path.join(programFiles, 'PowerShell', '6', 'pwsh.exe'));

  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  candidates.push(path.join(programFilesX86, 'PowerShell', '7', 'pwsh.exe'));

  return candidates;
}

export function resolvePowershellPath(): string {
  if (process.platform !== 'win32') {
    throw new Error('resolvePowershellPath 仅适用于 Windows');
  }

  for (const candidate of powershellCandidates()) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore invalid path
    }
  }

  throw new Error('未找到 PowerShell，请确认已安装 Windows PowerShell');
}
// [/AI-GEN]
