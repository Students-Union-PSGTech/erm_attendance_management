import type { AnyBulkWriteOperation, Model } from 'mongoose';
import { BATCH_CHUNK_SIZE } from '../config/constants';

export function chunk<T>(items: T[], size = BATCH_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** FR-4.8: run bulk writes in chunks of 400. Returns the number of affected docs. */
export async function chunkedBulkWrite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ops: AnyBulkWriteOperation<any>[],
): Promise<number> {
  let affected = 0;
  for (const part of chunk(ops)) {
    const res = await model.bulkWrite(part, { ordered: false });
    affected += res.insertedCount + res.upsertedCount + res.modifiedCount + res.deletedCount;
  }
  return affected;
}
