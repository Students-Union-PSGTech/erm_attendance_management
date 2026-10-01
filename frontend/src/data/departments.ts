export interface DepartmentCourse {
  name: string;
  code?: string;
  degree: 'B.E.' | 'B.Tech' | 'B.Sc' | 'M.Sc' | 'Other';
  category: string;
  duration: string;
}

export interface DepartmentCategory {
  id: string;
  categoryName: string;
  duration: string;
  badge: string;
  courses: DepartmentCourse[];
}

export const DEPARTMENT_CATEGORIES: DepartmentCategory[] = [
  {
    id: 'ug-eng-regular',
    categoryName: 'Undergraduate (UG) Engineering & Technology (Regular)',
    duration: '4 Years (8 Semesters)',
    badge: 'UG Regular (4 yrs)',
    courses: [
      { name: 'B.E. Automobile Engineering', code: 'AUTO', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Biomedical Engineering', code: 'BME', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Civil Engineering', code: 'CIVIL', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Computer Science and Engineering', code: 'CSE', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Computer Science and Engineering (AI and ML)', code: 'CSE (AI & ML)', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Electrical and Electronics Engineering', code: 'EEE', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Electronics and Communication Engineering', code: 'ECE', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Instrumentation and Control Engineering', code: 'ICE', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Mechanical Engineering', code: 'MECH', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Metallurgical Engineering', code: 'META', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Production Engineering', code: 'PROD', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.E. Robotics and Automation', code: 'RA', degree: 'B.E.', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.Tech Biotechnology', code: 'BIO-TECH', degree: 'B.Tech', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.Tech Fashion Technology', code: 'FT', degree: 'B.Tech', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.Tech Information Technology', code: 'IT', degree: 'B.Tech', category: 'UG Regular', duration: '4 Years' },
      { name: 'B.Tech Textile Technology', code: 'TT', degree: 'B.Tech', category: 'UG Regular', duration: '4 Years' },
    ],
  },
  {
    id: 'ug-eng-sandwich',
    categoryName: 'Undergraduate (UG) Engineering (Sandwich)',
    duration: '5 Years (10 Semesters) — Integrated Industrial Internships',
    badge: 'UG Sandwich (5 yrs)',
    courses: [
      { name: 'B.E. Electrical and Electronics Engineering (Sandwich)', code: 'EEE (SW)', degree: 'B.E.', category: 'UG Sandwich', duration: '5 Years' },
      { name: 'B.E. Mechanical Engineering (Sandwich)', code: 'MECH (SW)', degree: 'B.E.', category: 'UG Sandwich', duration: '5 Years' },
      { name: 'B.E. Production Engineering (Sandwich)', code: 'PROD (SW)', degree: 'B.E.', category: 'UG Sandwich', duration: '5 Years' },
    ],
  },
  {
    id: 'ug-science',
    categoryName: 'Undergraduate (UG) Science Courses',
    duration: '3 Years (6 Semesters)',
    badge: 'UG Science (3 yrs)',
    courses: [
      { name: 'B.Sc Applied Science', code: 'B.Sc AS', degree: 'B.Sc', category: 'UG Science', duration: '3 Years' },
      { name: 'B.Sc Computer Systems & Design', code: 'B.Sc CSD', degree: 'B.Sc', category: 'UG Science', duration: '3 Years' },
    ],
  },
  {
    id: 'integrated-science',
    categoryName: 'Integrated UG/PG Science Programmes (M.Sc)',
    duration: '5 Years (10 Semesters) — Direct Master\'s Degree',
    badge: 'Integrated M.Sc (5 yrs)',
    courses: [
      { name: 'M.Sc Software Systems', code: 'M.Sc SS', degree: 'M.Sc', category: 'Integrated PG', duration: '5 Years' },
      { name: 'M.Sc Theoretical Computer Science', code: 'M.Sc TCS', degree: 'M.Sc', category: 'Integrated PG', duration: '5 Years' },
      { name: 'M.Sc Data Science', code: 'M.Sc DS', degree: 'M.Sc', category: 'Integrated PG', duration: '5 Years' },
      { name: 'M.Sc Cyber Security', code: 'M.Sc CS', degree: 'M.Sc', category: 'Integrated PG', duration: '5 Years' },
      { name: 'M.Sc Computational Finance', code: 'M.Sc CF', degree: 'M.Sc', category: 'Integrated PG', duration: '5 Years' },
      { name: 'M.Sc Fashion Design & Merchandising', code: 'M.Sc FDM', degree: 'M.Sc', category: 'Integrated PG', duration: '5 Years' },
    ],
  },
];

// Flat list of all 27 departments
export const ALL_DEPARTMENTS: DepartmentCourse[] = DEPARTMENT_CATEGORIES.flatMap((c) => c.courses);

export interface StudyYearOption {
  value: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const YEARS_OF_STUDY: StudyYearOption[] = [
  { value: '1st Year', label: '1st Year (First Year)', shortLabel: '1st Yr', description: 'Freshman / First Year' },
  { value: '2nd Year', label: '2nd Year (Second Year)', shortLabel: '2nd Yr', description: 'Sophomore / Second Year' },
  { value: '3rd Year', label: '3rd Year (Third Year)', shortLabel: '3rd Yr', description: 'Junior / Third Year (Final Yr for B.Sc)' },
  { value: '4th Year', label: '4th Year (Fourth Year)', shortLabel: '4th Yr', description: 'Senior / Final Year (UG B.E. / B.Tech)' },
  { value: '5th Year', label: '5th Year (Fifth Year)', shortLabel: '5th Yr', description: 'Final Year (Sandwich B.E. & Integrated M.Sc)' },
];

// Search or find course helper
export function findDepartment(nameOrCode: string): DepartmentCourse | undefined {
  const query = nameOrCode.trim().toLowerCase();
  return ALL_DEPARTMENTS.find(
    (d) => d.name.toLowerCase() === query || (d.code && d.code.toLowerCase() === query)
  );
}
