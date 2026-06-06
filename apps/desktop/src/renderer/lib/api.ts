import type { KtveApi } from './ktve-api';

declare global {
  interface Window {
    ktve?: KtveApi;
  }
}

export function getKtveApi(): KtveApi | undefined {
  return window.ktve;
}

export function requireKtveApi(): KtveApi {
  const api = window.ktve;
  if (!api) {
    throw new Error('preload 未加载：请使用 pnpm dev 启动 Electron，不要直接在浏览器打开 localhost:5173');
  }
  return api;
}

export {};
