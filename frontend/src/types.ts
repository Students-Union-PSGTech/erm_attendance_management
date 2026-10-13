export type Role = 'admin' | 'team';

export interface User {
  username: string;
  role: Role;
  team?: string;
}

export const DEPARTMENTS = [
  "B.E. Automobile Engineering",
  "B.E. Biomedical Engineering",
  "B.E. Civil Engineering",
  "B.E. Computer Science and Engineering",
  "B.E. Computer Science and Engineering (AI and ML)",
  "B.E. Electrical and Electronics Engineering",
  "B.E. Electronics and Communication Engineering",
  "B.E. Instrumentation and Control Engineering",
  "B.E. Mechanical Engineering",
  "B.E. Metallurgical Engineering",
  "B.E. Production Engineering",
  "B.E. Robotics and Automation",
  "B.Tech Biotechnology",
  "B.Tech Fashion Technology",
  "B.Tech Information Technology",
  "B.Tech Textile Technology",
  "B.E. Electrical and Electronics Engineering (Sandwich)",
  "B.E. Mechanical Engineering (Sandwich)",
  "B.E. Production Engineering (Sandwich)",
  "B.Sc Applied Science",
  "B.Sc Computer Systems & Design",
  "M.Sc Software Systems",
  "M.Sc Theoretical Computer Science",
  "M.Sc Data Science",
  "M.Sc Cyber Security",
  "M.Sc Computational Finance",
  "M.Sc Fashion Design & Merchandising"
];
