import type { ZtveApi } from '../preload/index';

declare global {
  interface Window {
    ztve: ZtveApi;
  }
}

export {};
