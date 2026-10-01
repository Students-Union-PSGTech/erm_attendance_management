import {
  testConnection,
  fetchMembersFromFirestore,
  batchSaveMembersToFirestore,
  batchDeleteMembersFromFirestore,
  db
} from '../../frontend/src/firebase';
import fs from 'fs';
import { TeamMember } from '../../frontend/src/types';

async function run() {
  console.log('Testing Firestore connection...');
  const ok = await testConnection();
  console.log('Connection test result:', ok);

  const existing = await fetchMembersFromFirestore();
  console.log(`Current members in Firestore: ${existing.length}`);

  const parsedPath = fs.existsSync('./frontend/src/data/parsed_members.json')
    ? './frontend/src/data/parsed_members.json'
    : './src/data/parsed_members.json';
  const newMembers: TeamMember[] = JSON.parse(fs.readFileSync(parsedPath, 'utf-8'));
  console.log(`Uploading ${newMembers.length} new members to Firestore...`);

  // Delete existing members if any so we don't have stale/dummy members
  if (existing.length > 0) {
    console.log(`Cleaning up ${existing.length} existing documents...`);
    const oldIds = existing.map(m => m.id);
    await batchDeleteMembersFromFirestore(oldIds);
    console.log('Old members deleted.');
  }

  // Save new members
  await batchSaveMembersToFirestore(newMembers);
  console.log(`Successfully saved ${newMembers.length} members to Firestore!`);

  const verify = await fetchMembersFromFirestore();
  console.log(`Verification: fetched ${verify.length} members from Firestore!`);
}

run()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error during Firestore sync:', err);
    process.exit(1);
  });
