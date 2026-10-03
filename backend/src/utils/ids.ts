import { randomBytes } from 'node:crypto';

/** custom-{timestamp}-{random} (FR-2.4); sessions use the "session" prefix. */
export function newId(prefix: 'custom' | 'session' = 'custom'): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}
