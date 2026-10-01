# Backend Services & Logic

This directory contains the backend logic, data synchronization scripts, and database rules:

| Path | Description |
| :--- | :--- |
| `scripts/sync_firestore.ts` | Uploads and synchronizes parsed roster members with the Cloud Firestore database |
| `scripts/parse_and_sync.ts` | Parses and normalizes incoming CSV data from `credentials/new_members.csv` |
| `scripts/update_initial_data.ts` | Updates initial fallback data structures with parsed members |
| `rules/firestore.rules` | Security rules for Google Cloud Firestore |
| `firebase-blueprint.json` | Architecture schema specification for collections and security |

### Execution
Run any of the backend scripts using `npx tsx`:
```bash
npx tsx backend/scripts/sync_firestore.ts
```
