import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { TEAMS } from '../config/constants';
import { User } from '../models/User';

/** Factory-default logins: admin + one per team, e.g. tech / tech@erm. */
export function defaultLogins() {
  return [
    { username: 'admin', role: 'admin' as const, team: undefined, password: env.defaultAdminPassword },
    ...TEAMS.map((team) => ({
      username: team.toLowerCase(),
      role: 'team' as const,
      team,
      password: `${team.toLowerCase()}${env.defaultTeamPasswordSuffix}`,
    })),
  ];
}

/** FR-1.7: wipe all logins and recreate the defaults. Invalidates every issued token. */
export async function resetAllCredentials(): Promise<number> {
  const logins = defaultLogins();
  const docs = await Promise.all(
    logins.map(async ({ password, ...rest }) => ({
      ...rest,
      passwordHash: await bcrypt.hash(password, 10),
      tokenVersion: 0,
    })),
  );
  await User.deleteMany({});
  await User.insertMany(docs);
  return docs.length;
}

/** Creates the default logins on first start (empty users collection). */
export async function ensureDefaultCredentials(): Promise<void> {
  if ((await User.estimatedDocumentCount()) === 0) {
    const n = await resetAllCredentials();
    console.log(`[auth] created ${n} default logins (admin + ${TEAMS.length} teams)`);
  }
}
