import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI'),
  mongoDbName: process.env.MONGODB_DB ?? 'erm_attendance',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin@erm',
  defaultTeamPasswordSuffix: process.env.DEFAULT_TEAM_PASSWORD_SUFFIX ?? '@erm',
};
