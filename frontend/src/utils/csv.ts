import { TeamMember, RoleType, TeamType } from '../types';

export function exportMembersToCsv(members: TeamMember[], filename: string) {
  const headers = ['NAME', 'ROLL NO', 'DEPARTMENT', 'YEAR OF STUDY', 'PHONE', 'ROLE', 'TEAM'];
  const rows = members.map((m) => {
    const escapeCsv = (val?: string) => {
      if (!val) return '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    return [
      escapeCsv(m.name),
      escapeCsv(m.rollNo || ''),
      escapeCsv(m.department || ''),
      escapeCsv(m.year || ''),
      escapeCsv(m.phone || ''),
      escapeCsv(m.role),
      escapeCsv(m.team),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseCsvToMembers(csvText: string, defaultTeam?: TeamType): { success: boolean; members: Omit<TeamMember, 'id'>[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { success: false, members: [], errors: ['CSV must have a header row and at least one data row.'] };
  }

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  
  const nameIdx = headers.findIndex((h) => h.includes('name'));
  const rollIdx = headers.findIndex((h) => h.includes('roll'));
  const deptIdx = headers.findIndex((h) => h.includes('dept') || h.includes('department'));
  const yearIdx = headers.findIndex((h) => h.includes('year') || h.includes('yr') || h.includes('studying'));
  const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
  const roleIdx = headers.findIndex((h) => h.includes('role'));
  const teamIdx = headers.findIndex((h) => h.includes('team'));

  if (nameIdx === -1) {
    return { success: false, members: [], errors: ['Could not find a "NAME" column in CSV header.'] };
  }

  const validRoles: RoleType[] = ['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'];
  const validTeams: TeamType[] = ['MEDIA', 'AMBIANCE', 'PR', 'TECH', 'ERM', 'DESIGN'];

  const members: Omit<TeamMember, 'id'>[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    // basic CSV line parser supporting quotes
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
    const values: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(row)) !== null) {
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      let val = match[1] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      values.push(val.trim());
      if (regex.lastIndex >= row.length) break;
    }

    const rawName = values[nameIdx] || '';
    if (!rawName) continue;

    let rawRole = roleIdx !== -1 ? values[roleIdx]?.toUpperCase() : 'CORE';
    if (rawRole.includes('CO-LEAD') || rawRole.includes('COLEAD') || rawRole.includes('CO LEAD')) {
      rawRole = 'CO-LEAD';
    } else if (rawRole.includes('LEAD')) {
      rawRole = 'LEAD';
    } else if (rawRole.includes('COORD')) {
      rawRole = 'COORDINATOR';
    } else {
      rawRole = 'CORE';
    }

    let rawTeam: TeamType = defaultTeam || 'MEDIA';
    if (teamIdx !== -1 && values[teamIdx]) {
      const matchTeam = validTeams.find((t) => t.toLowerCase() === values[teamIdx].trim().toLowerCase());
      if (matchTeam) {
        rawTeam = matchTeam;
      }
    }

    members.push({
      name: rawName,
      role: rawRole as RoleType,
      team: rawTeam,
      rollNo: rollIdx !== -1 ? values[rollIdx] || undefined : undefined,
      department: deptIdx !== -1 ? values[deptIdx] || undefined : undefined,
      year: yearIdx !== -1 ? values[yearIdx] || undefined : undefined,
      phone: phoneIdx !== -1 ? values[phoneIdx] || undefined : undefined,
    });
  }

  return {
    success: members.length > 0,
    members,
    errors,
  };
}
