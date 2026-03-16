import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const rootPath = root.pathname;
const skipDirs = new Set(['node_modules', '.git']);
const maxItems = 12;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.openclaw')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      files.push(...await walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const files = await walk(rootPath);
const enriched = await Promise.all(files.map(async (file) => {
  const info = await stat(file);
  return {
    file: relative(rootPath, file),
    mtimeMs: info.mtimeMs,
    time: new Date(info.mtimeMs).toISOString(),
    size: info.size
  };
}));

enriched.sort((a, b) => b.mtimeMs - a.mtimeMs);
const latest = enriched.slice(0, maxItems);

const payload = {
  projectPath: '/home/stduser/.openclaw/workspace/conversation-companion',
  scannedAt: new Date().toISOString(),
  executionState: 'active',
  currentTask: 'Repairing reporting visibility so the dashboard shows real filesystem activity and recent code changes.',
  latestChanges: latest.map((item) => ({
    time: item.time,
    file: item.file,
    summary: `Auto-detected file activity · ${item.size} bytes`
  }))
};

await writeFile(new URL('../data/progress-feed.json', import.meta.url), JSON.stringify(payload, null, 2) + '\n');
console.log(`Generated progress feed with ${latest.length} file entries.`);
