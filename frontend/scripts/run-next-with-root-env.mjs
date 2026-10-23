import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const commandArgs = process.argv.slice(2);

if (commandArgs.length === 0) {
  console.error('Usage: node scripts/run-next-with-root-env.mjs <next-subcommand> [...args]');
  process.exit(1);
}

for (const envPath of [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
]) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

const child = spawn(process.execPath, [nextBin, ...commandArgs], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
