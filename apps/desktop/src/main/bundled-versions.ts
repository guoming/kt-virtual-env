import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface BundledVersions {
  ktctl: { version: string };
  kubectl: { version: string };
}

const FALLBACK: BundledVersions = {
  ktctl: { version: '0.3.7' },
  kubectl: { version: '1.28.15' },
};

export function loadBundledVersions(): BundledVersions {
  const candidates = [
    path.join(app.getAppPath(), '../../resources/versions.json'),
    path.join(process.cwd(), '../../resources/versions.json'),
    path.join(process.cwd(), 'resources/versions.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as BundledVersions;
    } catch {
      // try next candidate
    }
  }
  return FALLBACK;
}
