import fs from 'fs';
import { ALL_DEPARTMENTS } from '../../frontend/src/data/departments';
import { TeamMember, RoleType, TeamType } from '../../frontend/src/types';

const csvPath = fs.existsSync('./credentials/new_members.csv')
  ? './credentials/new_members.csv'
  : './src/data/new_members.csv';
const rawCsv = fs.readFileSync(csvPath, 'utf-8');
const lines = rawCsv.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Header: Timestamp,Name,   Roll number  ,  Phone number  ,  Year  ,   Team  ,Role,   Department  
const header = lines[0];
const dataLines = lines.slice(1);

function normalizeRollNo(raw: string): string {
  let s = raw.trim();
  // Check scientific notation like 2.50E+166, 2.30E+133
  // 2.50E+166 => 25E166
  // 2.30E+133 => 23E133
  // 2.50E+232 => 25E232
  const sciMatch = s.match(/^(\d)\.(\d+)E\+(\d+)$/i);
  if (sciMatch) {
    const d1 = sciMatch[1]; // '2'
    const d2 = sciMatch[2]; // '50' or '30'
    const exp = sciMatch[3]; // '166', '133', '232'
    const yearPrefix = d1 + d2[0]; // '25' or '23'
    // E is the department code (Electrical & Electronics)
    return `${yearPrefix}E${exp}`.toUpperCase();
  }
  return s.toUpperCase().replace(/\s+/g, '');
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9+]/g, '').trim();
}

function normalizeYear(raw: string): string {
  const clean = raw.trim();
  if (clean === '1') return '1st Year';
  if (clean === '2') return '2nd Year';
  if (clean === '3') return '3rd Year';
  if (clean === '4') return '4th Year';
  if (clean === '5') return '5th Year';
  if (clean.toLowerCase().includes('1')) return '1st Year';
  if (clean.toLowerCase().includes('2')) return '2nd Year';
  if (clean.toLowerCase().includes('3')) return '3rd Year';
  if (clean.toLowerCase().includes('4')) return '4th Year';
  if (clean.toLowerCase().includes('5')) return '5th Year';
  return clean;
}

function normalizeDept(raw: string): string {
  const q = raw.trim().replace(/\s+/g, ' ');
  // Direct match
  const direct = ALL_DEPARTMENTS.find(d => d.name.toLowerCase() === q.toLowerCase());
  if (direct) return direct.name;

  // Replace B.Tech. with B.Tech, B.E. with B.E., & with and
  const simplified = q
    .replace(/B\.Tech\./gi, 'B.Tech')
    .replace(/B\.Sc\./gi, 'B.Sc')
    .replace(/M\.Sc\./gi, 'M.Sc')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim();

  const match = ALL_DEPARTMENTS.find(d => {
    const dSimplified = d.name.replace(/&/g, 'and').replace(/\s+/g, ' ').toLowerCase();
    return dSimplified === simplified.toLowerCase() || dSimplified.includes(simplified.toLowerCase()) || simplified.toLowerCase().includes(dSimplified);
  });

  if (match) return match.name;

  // Fallback map
  if (/Information Technology/i.test(q)) return 'B.Tech Information Technology';
  if (/Biotechnology/i.test(q)) return 'B.Tech Biotechnology';
  if (/Fashion Technology/i.test(q)) return 'B.Tech Fashion Technology';
  if (/Textile Technology/i.test(q)) return 'B.Tech Textile Technology';
  if (/Applied Science/i.test(q)) return 'B.Sc Applied Science';
  if (/Computer Systems/i.test(q)) return 'B.Sc Computer Systems & Design';
  if (/Robotics/i.test(q)) return 'B.E. Robotics and Automation';
  if (/Automobile/i.test(q)) return 'B.E. Automobile Engineering';
  if (/Biomedical/i.test(q)) return 'B.E. Biomedical Engineering';
  if (/Civil/i.test(q)) return 'B.E. Civil Engineering';
  if (/AI & ML|AI and ML/i.test(q)) return 'B.E. Computer Science and Engineering (AI and ML)';
  if (/Computer Science/i.test(q)) return 'B.E. Computer Science and Engineering';
  if (/Electrical.*Sandwich/i.test(q)) return 'B.E. Electrical and Electronics Engineering (Sandwich)';
  if (/Electrical/i.test(q)) return 'B.E. Electrical and Electronics Engineering';
  if (/Electronics/i.test(q)) return 'B.E. Electronics and Communication Engineering';
  if (/Instrumentation/i.test(q)) return 'B.E. Instrumentation and Control Engineering';
  if (/Mechanical.*Sandwich/i.test(q)) return 'B.E. Mechanical Engineering (Sandwich)';
  if (/Mechanical/i.test(q)) return 'B.E. Mechanical Engineering';
  if (/Metallurgical/i.test(q)) return 'B.E. Metallurgical Engineering';
  if (/Production.*Sandwich/i.test(q)) return 'B.E. Production Engineering (Sandwich)';
  if (/Production/i.test(q)) return 'B.E. Production Engineering';
  if (/Data Science/i.test(q)) return 'M.Sc Data Science';
  if (/Cyber Security/i.test(q)) return 'M.Sc Cyber Security';
  if (/Fashion Design/i.test(q)) return 'M.Sc Fashion Design & Merchandising';
  if (/Software Systems/i.test(q)) return 'M.Sc Software Systems';

  return q;
}

interface RawEntry {
  timestamp: string;
  name: string;
  rollNo: string;
  phone: string;
  year: string;
  team: TeamType;
  role: RoleType;
  department: string;
}

const entries: RawEntry[] = [];

for (const line of dataLines) {
  // Simple CSV split (none of our values have internal commas in quotes except maybe check)
  const parts = line.split(',').map(p => p.trim());
  if (parts.length < 8) continue;
  const [timestamp, rawName, rawRoll, rawPhone, rawYear, rawTeam, rawRole, rawDept] = parts;

  const rollNo = normalizeRollNo(rawRoll);
  const phone = normalizePhone(rawPhone);
  const year = normalizeYear(rawYear);
  const team = rawTeam.toUpperCase() as TeamType;
  const role = rawRole.toUpperCase() as RoleType;
  const department = normalizeDept(rawDept);

  entries.push({
    timestamp,
    name: rawName.trim(),
    rollNo,
    phone,
    year,
    team,
    role,
    department
  });
}

console.log(`Total raw entries parsed: ${entries.length}`);

// Let's check duplicates by rollNo (if rollNo exists) or name + team
const uniqueMap = new Map<string, RawEntry>();
for (const entry of entries) {
  const key = entry.rollNo ? entry.rollNo : `${entry.name.toLowerCase()}_${entry.team}`;
  // Later timestamp updates earlier
  uniqueMap.set(key, entry);
}

console.log(`Unique entries after deduplication: ${uniqueMap.size}`);

// Print stats by team
const teamCounts: Record<string, number> = {};
for (const entry of uniqueMap.values()) {
  teamCounts[entry.team] = (teamCounts[entry.team] || 0) + 1;
}
console.log('Counts by team:', teamCounts);

// Generate formatted members array with IDs
const members: TeamMember[] = [];
let idCounter = 1;
for (const entry of uniqueMap.values()) {
  const id = `mem-${entry.team.toLowerCase()}-${String(idCounter++).padStart(3, '0')}`;
  members.push({
    id,
    name: entry.name,
    role: entry.role,
    team: entry.team,
    rollNo: entry.rollNo,
    department: entry.department,
    year: entry.year,
    phone: entry.phone,
    updatedAt: new Date().toISOString()
  });
}

const targetOut = fs.existsSync('./frontend/src/data')
  ? './frontend/src/data/parsed_members.json'
  : './src/data/parsed_members.json';
fs.writeFileSync(targetOut, JSON.stringify(members, null, 2));
if (fs.existsSync('./src/data') && targetOut !== './src/data/parsed_members.json') {
  fs.writeFileSync('./src/data/parsed_members.json', JSON.stringify(members, null, 2));
}
console.log(`Saved parsed members to ${targetOut}`);
