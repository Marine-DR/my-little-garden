const { spawn } = require('node:child_process');

const electronBinary = require('electron');
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
if (process.argv.includes('--demo')) environment.MY_LITTLE_GARDEN_DEMO = '1';

const electron = spawn(electronBinary, ['.'], {
  env: environment,
  stdio: 'inherit',
});

electron.on('error', (error) => {
  console.error('Impossible de démarrer Electron:', error);
  process.exitCode = 1;
});

electron.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
