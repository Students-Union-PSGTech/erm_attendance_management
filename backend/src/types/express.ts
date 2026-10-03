import type { Team, UserRole } from '../config/constants';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  team?: Team;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
