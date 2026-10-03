import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../credentials/firebase-applet-config.json';
import { TeamMember, AttendanceSession } from './types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Initialize Firestore with specific database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection to verify Firestore readiness
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline. Retrying with local cache.');
    }
    // A missing doc is expected, as long as it didn't fail network config
    return true;
  }
}

// Firestore Member CRUD operations
const MEMBERS_COLLECTION = 'members';

export async function fetchMembersFromFirestore(): Promise<TeamMember[]> {
  try {
    const querySnapshot = await getDocs(collection(db, MEMBERS_COLLECTION));
    const list: TeamMember[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        name: data.name,
        role: data.role,
        team: data.team,
        rollNo: data.rollNo || undefined,
        department: data.department || undefined,
        year: data.year || undefined,
        phone: data.phone || undefined,
        updatedAt: data.updatedAt || undefined,
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, MEMBERS_COLLECTION);
  }
}

export async function saveMemberToFirestore(member: TeamMember): Promise<void> {
  const path = `${MEMBERS_COLLECTION}/${member.id}`;
  try {
    const payload: Record<string, unknown> = {
      name: member.name,
      role: member.role,
      team: member.team,
      updatedAt: member.updatedAt || new Date().toISOString(),
    };
    if (member.rollNo) payload.rollNo = member.rollNo;
    if (member.department) payload.department = member.department;
    if (member.year) payload.year = member.year;
    if (member.phone) payload.phone = member.phone;

    await setDoc(doc(db, MEMBERS_COLLECTION, member.id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMemberFromFirestore(id: string): Promise<void> {
  const path = `${MEMBERS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, MEMBERS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Real-Time Auto-Sync Subscription (Listens for instant cloud updates)
export function subscribeToMembers(
  onData: (members: TeamMember[]) => void,
  onError: (error: unknown) => void
): () => void {
  try {
    const unsubscribe = onSnapshot(
      collection(db, MEMBERS_COLLECTION),
      (querySnapshot) => {
        const list: TeamMember[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            name: data.name,
            role: data.role,
            team: data.team,
            rollNo: data.rollNo || undefined,
            department: data.department || undefined,
            year: data.year || undefined,
            phone: data.phone || undefined,
            updatedAt: data.updatedAt || undefined,
          });
        });
        onData(list);
      },
      (error) => {
        console.error('Real-time Auto-Sync error from Firestore:', error);
        onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Failed to initialize Auto-Sync listener:', error);
    onError(error);
    return () => {};
  }
}

export async function batchSaveMembersToFirestore(membersList: TeamMember[]): Promise<void> {
  try {
    // Firestore batch supports up to 500 operations
    const CHUNK_SIZE = 400;
    for (let i = 0; i < membersList.length; i += CHUNK_SIZE) {
      const chunk = membersList.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const m of chunk) {
        const docRef = doc(db, MEMBERS_COLLECTION, m.id);
        const payload: Record<string, unknown> = {
          name: m.name,
          role: m.role,
          team: m.team,
          updatedAt: m.updatedAt || new Date().toISOString(),
        };
        if (m.rollNo) payload.rollNo = m.rollNo;
        if (m.department) payload.department = m.department;
        if (m.year) payload.year = m.year;
        if (m.phone) payload.phone = m.phone;

        batch.set(docRef, payload, { merge: true });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, MEMBERS_COLLECTION);
  }
}

export async function batchDeleteMembersFromFirestore(ids: string[]): Promise<void> {
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.delete(doc(db, MEMBERS_COLLECTION, id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, MEMBERS_COLLECTION);
  }
}

// Attendance Collections and Operations
const ATTENDANCE_COLLECTION = 'attendance';

export async function fetchAttendanceSessionsFromFirestore(): Promise<AttendanceSession[]> {
  try {
    const querySnapshot = await getDocs(collection(db, ATTENDANCE_COLLECTION));
    const list: AttendanceSession[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        date: data.date,
        sessionSlot: data.sessionSlot || 'FN',
        title: data.title,
        team: data.team,
        records: data.records || {},
        notes: data.notes || undefined,
        createdBy: data.createdBy || undefined,
        createdAt: data.createdAt || undefined,
        updatedAt: data.updatedAt || undefined,
      });
    });
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ATTENDANCE_COLLECTION);
  }
}

export async function saveAttendanceSessionToFirestore(session: AttendanceSession): Promise<void> {
  const path = `${ATTENDANCE_COLLECTION}/${session.id}`;
  try {
    const sanitizedRecords: Record<string, Record<string, string>> = {};
    if (session.records) {
      for (const [memberId, entry] of Object.entries(session.records)) {
        if (!entry) continue;
        const cleanEntry: Record<string, string> = {
          status: entry.status,
        };
        if (entry.notes !== undefined && entry.notes !== '') {
          cleanEntry.notes = entry.notes;
        }
        if (entry.markedAt !== undefined && entry.markedAt !== '') {
          cleanEntry.markedAt = entry.markedAt;
        }
        sanitizedRecords[memberId] = cleanEntry;
      }
    }

    const payload: Record<string, unknown> = {
      date: session.date,
      sessionSlot: session.sessionSlot || 'FN',
      title: session.title,
      team: session.team,
      records: sanitizedRecords,
      updatedAt: session.updatedAt || new Date().toISOString(),
    };
    if (session.notes) payload.notes = session.notes;
    if (session.createdBy) payload.createdBy = session.createdBy;
    if (session.createdAt) payload.createdAt = session.createdAt;

    await setDoc(doc(db, ATTENDANCE_COLLECTION, session.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAttendanceSessionFromFirestore(id: string): Promise<void> {
  const path = `${ATTENDANCE_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, ATTENDANCE_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchDeleteAttendanceSessionsFromFirestore(ids: string[]): Promise<void> {
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.delete(doc(db, ATTENDANCE_COLLECTION, id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, ATTENDANCE_COLLECTION);
  }
}

export async function clearAllAttendanceFromFirestore(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, ATTENDANCE_COLLECTION));
    const ids = querySnapshot.docs.map((d) => d.id);
    if (ids.length > 0) {
      await batchDeleteAttendanceSessionsFromFirestore(ids);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, ATTENDANCE_COLLECTION);
  }
}

export async function clearAllMembersFromFirestore(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, MEMBERS_COLLECTION));
    const ids = querySnapshot.docs.map((d) => d.id);
    if (ids.length > 0) {
      await batchDeleteMembersFromFirestore(ids);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, MEMBERS_COLLECTION);
  }
}

export function subscribeToAttendance(
  onData: (sessions: AttendanceSession[]) => void,
  onError: (error: unknown) => void
): () => void {
  try {
    const unsubscribe = onSnapshot(
      collection(db, ATTENDANCE_COLLECTION),
      (querySnapshot) => {
        const list: AttendanceSession[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            date: data.date,
            sessionSlot: data.sessionSlot || 'FN',
            title: data.title,
            team: data.team,
            records: data.records || {},
            notes: data.notes || undefined,
            createdBy: data.createdBy || undefined,
            createdAt: data.createdAt || undefined,
            updatedAt: data.updatedAt || undefined,
          });
        });
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        onData(list);
      },
      (error) => {
        console.error('Real-time Attendance Auto-Sync error:', error);
        onError(error);
      }
    );
    return unsubscribe;
  } catch (error) {
    console.error('Failed to initialize Attendance Auto-Sync listener:', error);
    onError(error);
    return () => {};
  }
}

