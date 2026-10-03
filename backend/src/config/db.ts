import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { dbName: env.mongoDbName });
  console.log(`[db] connected to ${env.mongoDbName}`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

// FR-4.2: connectivity check used by GET /api/health
export async function pingDb(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
