import { CredentialInfo } from '../types';
import { CREDENTIALS } from '../data/initialData';

export const STORAGE_CREDENTIALS_KEY = 'team_data_credentials_v2';
const LEGACY_CREDENTIALS_KEY = 'team_data_credentials_v1';

export function getStoredCredentials(): CredentialInfo[] {
  try {
    if (localStorage.getItem(LEGACY_CREDENTIALS_KEY)) {
      localStorage.removeItem(LEGACY_CREDENTIALS_KEY);
    }
    const saved = localStorage.getItem(STORAGE_CREDENTIALS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure all required fields exist
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read credentials from localStorage', e);
  }
  return CREDENTIALS;
}

export function saveStoredCredentials(credentials: CredentialInfo[]): void {
  try {
    localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(credentials));
  } catch (e) {
    console.error('Failed to save credentials to localStorage', e);
  }
}

export function resetStoredCredentials(): CredentialInfo[] {
  try {
    localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(CREDENTIALS));
  } catch (e) {
    console.error('Failed to reset credentials', e);
  }
  return CREDENTIALS;
}
