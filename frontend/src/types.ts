export type Role = 'admin' | 'team';

export interface User {
  username: string;
  role: Role;
  team?: string;
}
