import { env } from './config/env';
import { connectDb, disconnectDb } from './config/db';
import { createApp } from './app';
import { ensureDefaultCredentials } from './services/credentials.service';
import { removeLegacyMembers } from './services/member.service';

async function main() {
  await connectDb();
  await ensureDefaultCredentials();
  await removeLegacyMembers(); // FR-4.9

  const server = createApp().listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}/api`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
