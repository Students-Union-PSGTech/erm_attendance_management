export type Role = 'admin' | 'team';

export interface User {
  username: string;
  role: Role;
  team?: string;
}

export const DEPARTMENTS = [
  "AUTO - B.E. Automobile Engineering",
  "BME - B.E. Biomedical Engineering",
  "CIVIL - B.E. Civil Engineering",
  "CSE - B.E. Computer Science and Engineering",
  "CSE (AI & ML) - B.E. Computer Science and Engineering (AI and ML)",
  "EEE - B.E. Electrical and Electronics Engineering",
  "ECE - B.E. Electronics and Communication Engineering",
  "ICE - B.E. Instrumentation and Control Engineering",
  "MECH - B.E. Mechanical Engineering",
  "META - B.E. Metallurgical Engineering",
  "PROD - B.E. Production Engineering",
  "RA - B.E. Robotics and Automation",
  "BIO-TECH - B.Tech Biotechnology",
  "FT - B.Tech Fashion Technology",
  "IT - B.Tech Information Technology",
  "TT - B.Tech Textile Technology",
  "EEE (SW) - B.E. Electrical and Electronics Engineering (Sandwich)",
  "MECH (SW) - B.E. Mechanical Engineering (Sandwich)",
  "PROD (SW) - B.E. Production Engineering (Sandwich)",
  "B.Sc AS - B.Sc Applied Science",
  "B.Sc CSD - B.Sc Computer Systems & Design",
  "M.Sc SS - M.Sc Software Systems",
  "M.Sc TCS - M.Sc Theoretical Computer Science",
  "M.Sc DS - M.Sc Data Science",
  "M.Sc CS - M.Sc Cyber Security",
  "M.Sc CF - M.Sc Computational Finance",
  "M.Sc FDM - M.Sc Fashion Design & Merchandising"
];
