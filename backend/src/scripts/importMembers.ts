/**
 * Import members from a CSV file straight into MongoDB.
 *
 *   npm run import:members -- path/to/members.csv --dry-run  # preview, writes nothing
 *   npm run import:members -- path/to/members.csv            # add new members
 *   npm run import:members -- path/to/members.csv --replace  # wipe members first
 *
 * Rules:
 *   - roll no, role, team and year are normalized; other fields are kept as entered
 *   - a roll number seen before (earlier in the file or already in the db) is skipped
 */
import { readFile } from 'node:fs/promises';
import { connectDb, disconnectDb } from '../config/db';
import { importMembers } from '../services/member.service';
import { parseMembersCsv } from '../utils/csv';

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: npm run import:members -- <file.csv> [--replace] [--dry-run]');
    process.exit(1);
  }
  const dryRun = args.includes('--dry-run');
  const replace = args.includes('--replace');

  const { members, errors } = parseMembersCsv(await readFile(file, 'utf8'));
  console.log(`Parsed ${members.length} valid rows, ${errors.length} invalid.`);
  for (const e of errors) console.warn(`  row ${e.row}: ${e.message}`);

  await connectDb();
  try {
    const { inserted, duplicates } = await importMembers(members, { replace, dryRun });

    if (duplicates.length) {
      console.warn(`\nSkipped ${duplicates.length} duplicate roll number(s):`);
      for (const d of duplicates) {
        const where = d.keptIn === 'database' ? 'already in database' : 'earlier in file';
        console.warn(`  ${d.rollNo}  skipped "${d.name}"  (kept "${d.keptName}", ${where})`);
      }
    }

    const verb = dryRun ? 'Would insert' : 'Inserted';
    console.log(`\n${verb} ${inserted} member(s)${replace ? ' after clearing existing members' : ''}.`);
    if (dryRun) console.log('Dry run: nothing was written.');
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
