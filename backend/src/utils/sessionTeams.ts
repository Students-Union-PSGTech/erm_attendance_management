/**
 * A session's `team` is "ALL", one vertical ("TECH"), or several ("DESIGN,TECH").
 * These helpers answer "is this meeting for that vertical?" for every form.
 */

/** "DESIGN, tech" -> ['DESIGN', 'TECH'] */
export const teamsOf = (sessionTeam?: string | null) =>
  String(sessionTeam || 'ALL')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

/** Is the meeting for `team`? True for ALL, the team itself, and combos that include it. */
export const sessionIncludesTeam = (sessionTeam: string | null | undefined, team: string) => {
  const ts = teamsOf(sessionTeam);
  return ts.includes('ALL') || ts.includes(team.toUpperCase());
};

/** MongoDB filter for meetings `team` attends: ALL, its own, and combos like "DESIGN,TECH". */
export function sessionTeamFilter(team: string) {
  const escaped = team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    $or: [
      { team: 'ALL' },
      { team: { $regex: `(^|,)\\s*${escaped}\\s*(,|$)`, $options: 'i' } },
    ],
  };
}