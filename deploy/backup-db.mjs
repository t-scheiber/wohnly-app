import { mkdirSync, chmodSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
const directory = '/var/backups/wohnly';
mkdirSync(directory, { recursive: true, mode: 0o700 });
const file = `${directory}/before-deploy-${new Date().toISOString().replaceAll(':', '-')}.dump`;
const result = spawnSync('pg_dump', ['--format=custom', '--file', file], {
  env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)) },
  stdio: ['ignore', 'ignore', 'pipe'],
});
if (result.status !== 0) throw new Error('Database backup failed; deployment stopped');
chmodSync(file, 0o600);
if (statSync(file).size === 0) throw new Error('Database backup is empty; deployment stopped');
console.log('Database backup saved:', file);
