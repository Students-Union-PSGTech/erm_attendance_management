# Frontend Architecture

This folder contains the complete user-facing React application:

| Path | Description |
| :--- | :--- |
| `src/App.tsx` | Main application view, routing, role-based access, and tab switching |
| `src/main.tsx` | Entrypoint mounting the React DOM tree |
| `src/components/` | Reusable React UI components (Attendance Tracker, Member Tables, Modals, Drawers) |
| `src/data/` | Fallback roster data and department schemas |
| `src/utils/` | Local storage handlers and CSV export helpers |
| `src/firebase.ts` | Real-time Firebase Firestore client integration with live listeners |
| `src/types.ts` | TypeScript interface definitions for members, attendance, and users |

### Running the Frontend
Start the local Vite development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```
