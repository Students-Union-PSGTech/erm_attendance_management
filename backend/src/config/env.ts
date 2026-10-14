import dotenv from 'dotenv';
import path from 'path';

// Check backend/.env, current directory .env, and root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || required('MONGODB_URI'),
  mongoDbName: process.env.MONGODB_DB ?? 'erm_attendance',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000,https://erm-attendance-management-six.vercel.app,https://erm-attendance-management-iglt.vercel.app')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin@erm',
  defaultTeamPasswordSuffix: process.env.DEFAULT_TEAM_PASSWORD_SUFFIX ?? '@erm',
};
