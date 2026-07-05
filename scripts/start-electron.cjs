const { spawn } = require('node:child_process');
const path = require('node:path');

const electronBinary = require('electron');

async function startDevServer() {
  if (!process.argv.includes('--demo')) {
    return null;
  }

  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.resolve(__dirname, '..', 'vite.config.ts'),
    root: path.resolve(__dirname, '..', 'apps', 'desktop'),
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
  });

  await server.listen();
  return server;
}

(async () => {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  if (process.argv.includes('--demo')) environment.MY_LITTLE_GARDEN_DEMO = '1';

  const devServer = await startDevServer();
  if (devServer) {
    environment.VITE_DEV_SERVER_URL = `http://127.0.0.1:${devServer.config.server.port}/`;
  }

  const electron = spawn(electronBinary, ['.'], {
    env: environment,
    stdio: 'inherit',
  });

  electron.on('error', (error) => {
    console.error('Impossible de démarrer Electron:', error);
    process.exitCode = 1;
  });

  electron.on('exit', async (code, signal) => {
    if (devServer) {
      await devServer.close();
    }
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
})();
