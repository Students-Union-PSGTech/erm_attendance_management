


import type { AnyBulkWriteOperation } from 'mongoose';
import { connectDb, disconnectDb } from '../config/db';
import { Member } from '../models/Member';
import { chunkedBulkWrite } from '../utils/batch';
import { normalizeRole, normalizeRollNo, normalizeTeam, normalizeYear } from '../utils/normalize';

const RULES: Record<string, (v: string) => string | undefined> = {
  rollNo: normalizeRollNo,
  role: normalizeRole,
  team: normalizeTeam,
  year: normalizeYear,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDb();
  try {
    const members = await Member.find().lean();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: AnyBulkWriteOperation<any>[] = [];
    const rollOwners = new Map<string, string[]>();

    for (const m of members) {
      const set: Record<string, string> = {};
      const unset: Record<string, ''> = {};

      for (const [field, fn] of Object.entries(RULES)) {
        const before = (m as Record<string, unknown>)[field];
        if (typeof before !== 'string') continue;
        const after = before.trim() ? fn(before) : undefined;
        if (after === before) continue;
        if (after === undefined || after === '') unset[field] = '';
        else set[field] = after;
        console.log(`  ${m._id}  ${field}: ${JSON.stringify(before)} -> ${JSON.stringify(after ?? null)}`);
      }

      const roll = set.rollNo ?? m.rollNo;
      if (roll) rollOwners.set(roll, [...(rollOwners.get(roll) ?? []), set.name ?? m.name]);

      if (Object.keys(set).length || Object.keys(unset).length) {
        const update: Record<string, unknown> = {};
        if (Object.keys(set).length) update.$set = set;
        if (Object.keys(unset).length) update.$unset = unset;
        // Raw update: values are already normalized, so skip Mongoose casting/setters
        ops.push({ updateOne: { filter: { _id: m._id }, update } });
      }
    }

    console.log(`\n${members.length} members checked, ${ops.length} need changes.`);

    const dupes = [...rollOwners].filter(([, names]) => names.length > 1);
    for (const [roll, names] of dupes) console.warn(`  duplicate roll no ${roll}: ${names.join(', ')}`);
    if (dupes.length) console.warn(`${dupes.length} roll number(s) are shared by more than one member — check them.`);

    if (dryRun) {
      console.log('Dry run: nothing was written.');
    } else if (ops.length) {
      await chunkedBulkWrite(Member, ops);
      console.log(`Updated ${ops.length} members.`);
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});