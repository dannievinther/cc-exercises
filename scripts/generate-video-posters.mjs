import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// Run after changing an exercise video. Posters preserve the first-frame preview
// while below-fold videos use preload=none. Requires local ffmpeg.
for (const entry of await readdir('src/exercises', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const collection = entry.name;
  for (const file of await readdir(join('src/exercises', collection))) {
    if (!/^[^_].*\.md$/.test(file)) continue;
    const markdown = await readFile(join('src/exercises', collection, file), 'utf8');
    const video = markdown.match(/^video:\s*(\/assets\/[^\r\n]+)/m)?.[1];
    if (!video) continue;
    const input = join('public', video);
    const output = input.replace(/\.(mp4|webm)$/, '.poster.webp');
    if (output === input) throw new Error(`Unsupported video: ${video}`);
    if (!process.argv.includes('--force')) {
      try { await access(output); continue; } catch {}
    }
    const result = spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', '0.001', '-i', input, '-frames:v', '1', '-vf', 'scale=min(1048\\,iw):-1', '-quality', '80', output], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`Poster failed: ${video}`);
    console.log(output);
  }
}
