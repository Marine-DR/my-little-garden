import { join } from 'node:path';
import type { App } from 'electron';
import { BrowserWindow } from 'electron';

function resolveRendererEntry(app: App): {
  type: 'file' | 'url';
  path?: string;
  url?: string;
} {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    return { type: 'url', url: devServerUrl };
  }

  return {
    type: 'file',
    path: join(app.getAppPath(), 'dist', 'renderer', 'index.html'),
  };
}

export async function createMainWindow(app: App): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#f8faf7',
    icon: join(
      app.getAppPath(),
      'apps',
      'desktop',
      'src',
      'renderer',
      'assets',
      'app-icon.png',
    ),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(app.getAppPath(), 'dist', 'main', 'preload', 'preload.js'),
    },
  });
  window.setMenu(null);

  const entry = resolveRendererEntry(app);

  if (entry.type === 'url' && entry.url) {
    await window.loadURL(entry.url);
  } else if (entry.path) {
    await window.loadFile(entry.path);
  }
}
