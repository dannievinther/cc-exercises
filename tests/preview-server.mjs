import { preview } from 'astro';

// The CLI may daemonize in agent environments. Playwright needs a foreground
// process it owns and can stop, so use Astro's public programmatic API.
const server = await preview({
  root: process.cwd(),
  server: { host: '127.0.0.1', port: 8128 },
  vite: { preview: { strictPort: true } },
});
const stop = async () => { await server.stop(); process.exit(0); };
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
