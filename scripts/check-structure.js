import { existsSync } from 'node:fs';

const required = [
  'package.json',
  'progress-report.html',
  'app/index.html',
  'app/styles.css',
  'app/app.js',
  'app/session-model.js',
  'app/session-service.js',
  'app/renderers.js',
  'app/widget-renderers.js',
  'data/mock-session.json',
  'server/dev-server.js'
];

const missing = required.filter((file) => !existsSync(new URL(`../${file}`, import.meta.url)));

if (missing.length) {
  console.error('Missing required project files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Structure check passed.');
