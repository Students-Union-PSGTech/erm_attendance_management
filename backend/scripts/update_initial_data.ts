import fs from 'fs';
import { TeamMember } from '../../frontend/src/types';

const parsedPath = fs.existsSync('./frontend/src/data/parsed_members.json')
  ? './frontend/src/data/parsed_members.json'
  : './src/data/parsed_members.json';
const initialDataPath = fs.existsSync('./frontend/src/data/initialData.ts')
  ? './frontend/src/data/initialData.ts'
  : './src/data/initialData.ts';

const members: TeamMember[] = JSON.parse(fs.readFileSync(parsedPath, 'utf-8'));
const currentInitialData = fs.readFileSync(initialDataPath, 'utf-8');

// Find where export const INITIAL_MEMBERS: TeamMember[] = [ starts
const marker = 'export const INITIAL_MEMBERS: TeamMember[] = [';
const idx = currentInitialData.indexOf(marker);
if (idx === -1) {
  throw new Error('Marker not found');
}

const prefix = currentInitialData.substring(0, idx + marker.length);

const memberLines = members.map(m => {
  return `  {\n    id: ${JSON.stringify(m.id)},\n    name: ${JSON.stringify(m.name)},\n    role: ${JSON.stringify(m.role)},\n    team: ${JSON.stringify(m.team)},\n    rollNo: ${JSON.stringify(m.rollNo)},\n    department: ${JSON.stringify(m.department)},\n    year: ${JSON.stringify(m.year)},\n    phone: ${JSON.stringify(m.phone)},\n    updatedAt: ${JSON.stringify(m.updatedAt)},\n  },`;
}).join('\n');

const newContent = `${prefix}\n${memberLines}\n];\n\nexport const INITIAL_ATTENDANCE_SESSIONS: AttendanceSession[] = [];\n`;

fs.writeFileSync(initialDataPath, newContent, 'utf-8');
if (fs.existsSync('./src/data/initialData.ts') && initialDataPath !== './src/data/initialData.ts') {
  fs.writeFileSync('./src/data/initialData.ts', newContent, 'utf-8');
}
console.log(`Successfully updated ${initialDataPath} with all ${members.length} members!`);
