/**
 * Reset all logins to factory defaults (same as the admin "reset credentials" action).
 *   npm run reset:credentials
 */
import { connectDb, disconnectDb } from '../config/db';
import { defaultLogins, resetAllCredentials } from '../services/credentials.service';

async function main() {
  await connectDb();
  try {
    await resetAllCredentials();
    console.log('Credentials reset. Default logins:');
    for (const l of defaultLogins()) console.log(`  ${l.username.padEnd(10)} ${l.password}`);
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
