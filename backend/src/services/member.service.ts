import type { AnyBulkWriteOperation } from 'mongoose';
import { LEGACY_MEMBER_PREFIX } from '../config/constants';
import { Member, type MemberDoc } from '../models/Member';
import { AttendanceSession } from '../models/Session';
import { chunkedBulkWrite } from '../utils/batch';
import { newId } from '../utils/ids';
import type { MemberCreateInput } from '../validators/member.validators';

export interface ImportOptions {
  /** Delete every existing member before importing. */
  replace?: boolean;
  /** Work out what would happen without writing anything. */
  dryRun?: boolean;
}

export interface SkippedDuplicate {
  rollNo: string;
  name: string;
  /** Who already has this roll number: an earlier CSV row, or a member already in the database. */
  keptName: string;
  keptIn: 'file' | 'database';
}

export interface ImportResult {
  inserted: number;
  duplicates: SkippedDuplicate[];
}

/**
 * Bulk import members (FR-2.10).
 * Duplicate roll numbers: the first one wins and later ones are skipped,
 * whether the earlier one is in the database or higher up in the same file.
 * Rows without a roll number are always inserted.
 * Writes go out in chunks of 400 (FR-4.8).
 */
export async function importMembers(rows: MemberCreateInput[], opts: ImportOptions = {}): Promise<ImportResult> {
  if (opts.replace && !opts.dryRun) await Member.deleteMany({});

  // Roll numbers are already normalized (uppercase) by the validator.
  const rollNos = rows.map((r) => r.rollNo).filter((r): r is string => !!r);
  const existing =
    rollNos.length && !opts.replace
      ? await Member.find({ rollNo: { $in: rollNos } }, { name: 1, rollNo: 1 }).lean()
      : [];
  const taken = new Map<string, { name: string; keptIn: 'file' | 'database' }>(
    existing.map((m) => [m.rollNo as string, { name: m.name, keptIn: 'database' }]),
  );

  const duplicates: SkippedDuplicate[] = [];
  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: AnyBulkWriteOperation<any>[] = [];

  for (const { id, ...data } of rows) {
    if (data.rollNo) {
      const kept = taken.get(data.rollNo);
      if (kept) {
        duplicates.push({ rollNo: data.rollNo, name: data.name, keptName: kept.name, keptIn: kept.keptIn });
        continue;
      }
      taken.set(data.rollNo, { name: data.name, keptIn: 'file' });
    }
    const _id = id ?? newId('custom');
    ops.push({ insertOne: { document: { _id, ...data, createdAt: now, updatedAt: now } as MemberDoc } });
  }

  if (!opts.dryRun) await chunkedBulkWrite(Member, ops);
  return { inserted: ops.length, duplicates };
}

/** FR-4.9: purge legacy "mem-" members and their attendance entries. */
export async function removeLegacyMembers(): Promise<number> {
  const legacy = await Member.find({ _id: { $regex: `^${LEGACY_MEMBER_PREFIX}` } }, { _id: 1 }).lean();
  if (legacy.length === 0) return 0;
  const ids = legacy.map((m) => String(m._id));
  await Member.deleteMany({ _id: { $in: ids } });
  await removeMembersFromSessions(ids);
  console.log(`[maintenance] removed ${ids.length} legacy members`);
  return ids.length;
}

/** Drop the given members' entries from every session's records map. */
export async function removeMembersFromSessions(memberIds: string[]): Promise<void> {
  if (memberIds.length === 0) return;
  const unset = Object.fromEntries(memberIds.map((id) => [`records.${id}`, '']));
  await AttendanceSession.updateMany({}, { $unset: unset });
}