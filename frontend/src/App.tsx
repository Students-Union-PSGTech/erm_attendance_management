import { useState, useEffect, useMemo } from 'react';
import { AuthUser, TeamMember, TeamType, CredentialInfo, ActiveTab, AttendanceSession } from './types';
import { INITIAL_MEMBERS, INITIAL_ATTENDANCE_SESSIONS } from './data/initialData';
import { LoginPage } from './components/LoginPage';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { MemberTable } from './components/MemberTable';
import { MemberModal } from './components/MemberModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { CredentialsModal } from './components/CredentialsModal';
import { DatabaseModal } from './components/DatabaseModal';
import { AttendanceTracker } from './components/AttendanceTracker';
import { exportMembersToCsv } from './utils/csv';
import { getStoredCredentials, saveStoredCredentials, resetStoredCredentials } from './utils/credentialsStorage';
import {
  testConnection,
  fetchMembersFromFirestore,
  saveMemberToFirestore,
  deleteMemberFromFirestore,
  batchSaveMembersToFirestore,
  batchDeleteMembersFromFirestore,
  subscribeToMembers,
  fetchAttendanceSessionsFromFirestore,
  saveAttendanceSessionToFirestore,
  deleteAttendanceSessionFromFirestore,
  batchDeleteAttendanceSessionsFromFirestore,
  clearAllAttendanceFromFirestore,
  clearAllMembersFromFirestore,
  subscribeToAttendance,
} from './firebase';
import { CheckCircle2, Users, Calendar } from 'lucide-react';

const STORAGE_MEMBERS_KEY = 'team_data_members_v4';
const LEGACY_STORAGE_MEMBERS_V3_KEY = 'team_data_members_v3';
const LEGACY_STORAGE_MEMBERS_V2_KEY = 'team_data_members_v2';
const LEGACY_STORAGE_MEMBERS_KEY = 'team_data_members_v1';
const STORAGE_AUTH_SESSION_KEY = 'team_data_auth_session_v1';
const LEGACY_STORAGE_AUTH_KEY = 'team_data_auth_v1';
const STORAGE_AUTO_SYNC_KEY = 'team_data_auto_sync_v1';
const STORAGE_ATTENDANCE_KEY = 'team_data_attendance_v1';

export default function App() {
  // Authentication State - uses sessionStorage so closing the tab/window automatically logs out
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      // Clear any legacy persistent login and old member cache from localStorage
      localStorage.removeItem(LEGACY_STORAGE_AUTH_KEY);
      localStorage.removeItem(LEGACY_STORAGE_MEMBERS_KEY);
      localStorage.removeItem(LEGACY_STORAGE_MEMBERS_V2_KEY);
      localStorage.removeItem(LEGACY_STORAGE_MEMBERS_V3_KEY);

      const saved = sessionStorage.getItem(STORAGE_AUTH_SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Team Members State (Defaults to 229 PDF roster members, synchronizes with Firestore Cloud DB)
  const [members, setMembers] = useState<TeamMember[]>(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_MEMBERS_V2_KEY);
      localStorage.removeItem(LEGACY_STORAGE_MEMBERS_V3_KEY);
      const saved = localStorage.getItem(STORAGE_MEMBERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((m: TeamMember) => !m.id?.startsWith('mem-'));
        }
      }
    } catch (e) {
      console.error('Failed to load saved members', e);
    }
    return INITIAL_MEMBERS;
  });

  // Cloud Database & Auto-Sync State
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [cloudMemberCount, setCloudMemberCount] = useState<number>(() => members.length);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUTO_SYNC_KEY);
      return saved !== 'false'; // Defaults to true (Auto-Sync ON)
    } catch {
      return true;
    }
  });

  // Navigation Tab: 'members' | 'attendance'
  const [activeTab, setActiveTab] = useState<ActiveTab>('members');

  // Attendance Sessions State
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ATTENDANCE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load saved attendance sessions', e);
    }
    return INITIAL_ATTENDANCE_SESSIONS;
  });

  // Initialize and Synchronize with Firestore Cloud Database (Real-Time Auto-Sync)
  useEffect(() => {
    let isMounted = true;
    let unsubscribeMembers: (() => void) | null = null;
    let unsubscribeAttendance: (() => void) | null = null;

    async function initAndSubscribe() {
      setIsSyncing(true);
      setCloudSyncError(null);
      try {
        await testConnection();
        const [initialMembers, initialSessions] = await Promise.all([
          fetchMembersFromFirestore(),
          fetchAttendanceSessionsFromFirestore(),
        ]);

        if (!isMounted) return;

        let activeMembers = initialMembers || [];
        const legacyMemberIds = activeMembers.filter((m) => m.id.startsWith('mem-')).map((m) => m.id);
        if (legacyMemberIds.length > 0) {
          await batchDeleteMembersFromFirestore(legacyMemberIds);
          activeMembers = activeMembers.filter((m) => !m.id.startsWith('mem-'));
        }

        if (!isMounted) return;

        const hasRosterMembers = activeMembers.some((m) => m.id.startsWith('roster-'));
        if (!hasRosterMembers && INITIAL_MEMBERS.length > 0) {
          await batchSaveMembersToFirestore(INITIAL_MEMBERS);
          const customMembers = activeMembers.filter((m) => !m.id.startsWith('roster-'));
          activeMembers = [...INITIAL_MEMBERS, ...customMembers];
        }

        if (isMounted) {
          setMembers(activeMembers);
          setCloudMemberCount(activeMembers.length);
          setLastSyncTime(new Date());
          try {
            localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(activeMembers));
          } catch {}
        }

        if (initialSessions && initialSessions.length > 0) {
          setAttendanceSessions(initialSessions);
          try {
            localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify(initialSessions));
          } catch {}
        } else {
          // Empty attendance list
          setAttendanceSessions([]);
          try {
            localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify([]));
          } catch {}
        }

        // Attach Real-Time Auto-Sync listeners if auto-sync is enabled
        if (isAutoSyncEnabled) {
          unsubscribeMembers = subscribeToMembers(
            (liveMembers) => {
              if (!isMounted) return;
              if (liveMembers) {
                const cleaned = liveMembers.filter((m) => !m.id.startsWith('mem-'));
                setMembers(cleaned);
                setCloudMemberCount(cleaned.length);
                setLastSyncTime(new Date());
                setCloudSyncError(null);
                try {
                  localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(cleaned));
                } catch {}
              }
            },
            (error) => {
              if (!isMounted) return;
              console.error('Real-time Auto-Sync stream error:', error);
              setCloudSyncError(error instanceof Error ? error.message : 'Live sync connection interrupted');
            }
          );

          unsubscribeAttendance = subscribeToAttendance(
            (liveSessions) => {
              if (!isMounted) return;
              setAttendanceSessions(liveSessions);
              try {
                localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify(liveSessions));
              } catch {}
            },
            (error) => {
              console.error('Real-time Attendance Auto-Sync error:', error);
            }
          );
        }
      } catch (err) {
        console.error('Failed to initialize Firestore Auto-Sync:', err);
        if (isMounted) {
          setCloudSyncError(err instanceof Error ? err.message : 'Database sync connection issue');
        }
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    }

    initAndSubscribe();

    // Auto-resync when reconnecting to internet
    const handleOnline = () => {
      if (navigator.onLine && isAutoSyncEnabled) {
        Promise.all([fetchMembersFromFirestore(), fetchAttendanceSessionsFromFirestore()])
          .then(([freshMembers, freshSessions]) => {
            if (!isMounted) return;
            if (freshMembers && freshMembers.length > 0) {
              setMembers(freshMembers);
              setCloudMemberCount(freshMembers.length);
              setLastSyncTime(new Date());
            }
            if (freshSessions) {
              setAttendanceSessions(freshSessions);
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      if (unsubscribeMembers) unsubscribeMembers();
      if (unsubscribeAttendance) unsubscribeAttendance();
      window.removeEventListener('online', handleOnline);
    };
  }, [isAutoSyncEnabled]);

  // Save members to local cache whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
    } catch (e) {
      console.error('Failed to persist members to localStorage', e);
    }
  }, [members]);

  // Save auth user to sessionStorage (active tab session only)
  useEffect(() => {
    try {
      if (currentUser) {
        sessionStorage.setItem(STORAGE_AUTH_SESSION_KEY, JSON.stringify(currentUser));
      } else {
        sessionStorage.removeItem(STORAGE_AUTH_SESSION_KEY);
      }
    } catch (e) {
      console.error('Failed to persist session auth state', e);
    }
  }, [currentUser]);

  // Admin selected team filter ('ALL' or specific team)
  const [selectedTeam, setSelectedTeam] = useState<TeamType | 'ALL'>('ALL');

  // Credentials State (Persistent)
  const [credentials, setCredentials] = useState<CredentialInfo[]>(() => getStoredCredentials());

  // Modals state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  const handleUpdateCredential = (updated: CredentialInfo, oldUsername: string) => {
    setCredentials((prev) => {
      const next = prev.map((c) => (c.username === oldUsername ? updated : c));
      saveStoredCredentials(next);
      return next;
    });

    if (currentUser && currentUser.username === oldUsername) {
      setCurrentUser((prev) => (prev ? { ...prev, username: updated.username } : null));
    }

    showToast(`Updated credentials for ${updated.label} (${updated.username}).`);
  };

  const handleResetCredentials = () => {
    const defaults = resetStoredCredentials();
    setCredentials(defaults);
    showToast('All credentials reset to factory defaults.');
  };

  // Filter members strictly based on access rules
  const visibleMembers = useMemo(() => {
    if (!currentUser) return [];

    // If Team User: STRICT ISOLATION -> ONLY their team
    if (currentUser.role === 'team' && currentUser.team) {
      return members.filter((m) => m.team === currentUser.team);
    }

    // If Admin: Can see all or filter by selected team
    if (currentUser.role === 'admin') {
      if (selectedTeam === 'ALL') {
        return members;
      }
      return members.filter((m) => m.team === selectedTeam);
    }

    return [];
  }, [members, currentUser, selectedTeam]);

  // Handlers
  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    if (user.role === 'team' && user.team) {
      setSelectedTeam(user.team);
    } else {
      setSelectedTeam('ALL');
    }
    showToast(`Welcome, ${user.name}! Logged in successfully.`);
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(STORAGE_AUTH_SESSION_KEY);
      localStorage.removeItem(LEGACY_STORAGE_AUTH_KEY);
    } catch (e) {
      console.error('Failed to clear session on logout', e);
    }
    setCurrentUser(null);
    setSelectedTeam('ALL');
    showToast('You have been logged out.');
  };

  const handleSaveMember = async (data: Omit<TeamMember, 'id'>, id?: string) => {
    if (id) {
      // Edit
      const updated: TeamMember = {
        id,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
      showToast(`Updated member "${data.name}" successfully.`);

      try {
        await saveMemberToFirestore(updated);
        setLastSyncTime(new Date());
      } catch (e) {
        console.error('Failed to save member to Firestore', e);
        showToast('Saved locally; cloud sync pending.');
      }
    } else {
      // Add
      const newMember: TeamMember = {
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      setMembers((prev) => [newMember, ...prev]);
      setCloudMemberCount((prev) => prev + 1);
      showToast(`Added new member "${data.name}" to ${data.team} team.`);

      try {
        await saveMemberToFirestore(newMember);
        setLastSyncTime(new Date());
      } catch (e) {
        console.error('Failed to add member to Firestore', e);
        showToast('Saved locally; cloud sync pending.');
      }
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    const targetId = deletingMember.id;
    const targetName = deletingMember.name;
    const targetTeam = deletingMember.team;
    setMembers((prev) => prev.filter((m) => m.id !== targetId));
    setCloudMemberCount((prev) => Math.max(0, prev - 1));
    showToast(`Removed "${targetName}" from ${targetTeam} team.`);
    setDeletingMember(null);

    try {
      await deleteMemberFromFirestore(targetId);
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to delete member from Firestore', e);
      showToast('Deleted locally; cloud sync pending.');
    }
  };

  const handleImportCsv = async (importedMembers: TeamMember[]) => {
    setIsSyncing(true);
    try {
      await batchSaveMembersToFirestore(importedMembers);
      setMembers((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const filtered = importedMembers.filter((m) => !existingIds.has(m.id));
        return [...filtered, ...prev];
      });
      setCloudMemberCount((prev) => prev + importedMembers.length);
      setLastSyncTime(new Date());
      showToast(`Successfully uploaded ${importedMembers.length} members to Cloud Database!`);
    } catch (err) {
      console.error('Failed to upload imported members to Firestore', err);
      showToast('Error uploading members to Cloud Database.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setCloudSyncError(null);
    try {
      const cloudMembers = await fetchMembersFromFirestore();
      setMembers(cloudMembers);
      setCloudMemberCount(cloudMembers.length);
      setLastSyncTime(new Date());
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(cloudMembers));
      showToast(`Cloud database synced: ${cloudMembers.length} total records.`);
    } catch (err) {
      setCloudSyncError(err instanceof Error ? err.message : 'Sync failed');
      showToast('Failed to synchronize with Cloud Database.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromJson = async (restored: TeamMember[]) => {
    setIsSyncing(true);
    try {
      await batchSaveMembersToFirestore(restored);
      setMembers(restored);
      setCloudMemberCount(restored.length);
      setLastSyncTime(new Date());
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(restored));
      showToast(`Database restored with ${restored.length} members!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to restore database from backup.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedDefaults = async () => {
    setIsSyncing(true);
    try {
      const currentList = await fetchMembersFromFirestore();
      const ids = currentList.map((m) => m.id);
      if (ids.length > 0) {
        await batchDeleteMembersFromFirestore(ids);
      }
      await batchSaveMembersToFirestore(INITIAL_MEMBERS);
      setMembers(INITIAL_MEMBERS);
      setCloudMemberCount(INITIAL_MEMBERS.length);
      setLastSyncTime(new Date());
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(INITIAL_MEMBERS));
      showToast(`Cloud database reset and seeded with ${INITIAL_MEMBERS.length} verified members.`);
    } catch (err) {
      console.error(err);
      showToast('Failed to seed default members.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoSync = () => {
    setIsAutoSyncEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_AUTO_SYNC_KEY, String(next));
      } catch {}
      if (next) {
        showToast('Real-time Auto-Sync is now ACTIVE.');
      } else {
        showToast('Auto-Sync paused. You can still manually sync anytime.');
      }
      return next;
    });
  };

  const handleExportCsv = (customList?: TeamMember[], customFilename?: string) => {
    const listToExport = customList || visibleMembers;
    if (listToExport.length === 0) {
      showToast('No records available to export.');
      return;
    }

    let defaultFilename = '';
    if (currentUser?.role === 'admin') {
      defaultFilename = selectedTeam === 'ALL' ? 'all_teams_roster' : `${selectedTeam.toLowerCase()}_team_roster`;
    } else {
      defaultFilename = `${currentUser?.team?.toLowerCase()}_team_roster`;
    }

    const filename = customFilename || `${defaultFilename}_${new Date().toISOString().slice(0, 10)}.csv`;
    exportMembersToCsv(listToExport, filename);
    showToast(`Exported ${listToExport.length} members to ${filename}`);
  };

  // Attendance Handlers
  const handleSaveAttendanceSession = async (session: AttendanceSession) => {
    setAttendanceSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id);
      let next: AttendanceSession[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = session;
      } else {
        next = [session, ...prev];
      }
      try {
        localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await saveAttendanceSessionToFirestore(session);
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to save attendance session to Firestore', e);
      showToast('Saved session locally; cloud sync pending.');
    }
  };

  const handleDeleteAttendanceSession = async (sessionId: string) => {
    setAttendanceSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      try {
        localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await deleteAttendanceSessionFromFirestore(sessionId);
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to delete attendance session from Firestore', e);
      showToast('Deleted session locally; cloud sync pending.');
    }
  };

  const handleClearAllAttendanceData = async () => {
    setIsSyncing(true);
    try {
      await clearAllAttendanceFromFirestore();
      setAttendanceSessions([]);
      localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify([]));
      localStorage.removeItem('psg_tech_club_attendance_sessions_v1');
      showToast('Deleted all attendance sessions from Cloud Database and local storage.');
    } catch (err) {
      console.error(err);
      showToast('Failed to clear attendance data.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAllMemberData = async () => {
    setIsSyncing(true);
    try {
      await clearAllMembersFromFirestore();
      setMembers([]);
      setCloudMemberCount(0);
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify([]));
      showToast('Deleted all member records from Cloud Database and local storage.');
    } catch (err) {
      console.error(err);
      showToast('Failed to clear member data.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAllData = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([clearAllAttendanceFromFirestore(), clearAllMembersFromFirestore()]);
      setMembers([]);
      setAttendanceSessions([]);
      setCloudMemberCount(0);
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify([]));
      localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify([]));
      localStorage.removeItem('psg_tech_club_attendance_sessions_v1');
      showToast('Successfully deleted all previous data (Members & Attendance) from Cloud and Local storage.');
    } catch (err) {
      console.error(err);
      showToast('Failed to clear all data.');
    } finally {
      setIsSyncing(false);
    }
  };

  // If not logged in, render LoginPage
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onOpenCredentials={() => setIsCredentialsModalOpen(true)}
        onExportCsv={() => handleExportCsv()}
        onOpenDatabase={() => setIsDatabaseModalOpen(true)}
        cloudMemberCount={cloudMemberCount}
        isSyncing={isSyncing}
        isAutoSyncEnabled={isAutoSyncEnabled}
        selectedTeam={selectedTeam}
        onSelectTeam={setSelectedTeam}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        attendanceSessionCount={attendanceSessions.length}
      />

      {/* Mobile / Tablet Tab Switcher */}
      <div className="md:hidden max-w-7xl w-full mx-auto px-2.5 sm:px-3 pt-2.5 sm:pt-3">
        <div className="grid grid-cols-2 p-1 bg-slate-200/90 dark:bg-slate-800/90 rounded-xl border border-slate-300/80 dark:border-slate-700/80 shadow-2xs">
          <button
            id="mobile-tab-members"
            onClick={() => setActiveTab('members')}
            className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
              activeTab === 'members'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">Members ({visibleMembers.length})</span>
          </button>
          <button
            id="mobile-tab-attendance"
            onClick={() => setActiveTab('attendance')}
            className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
              activeTab === 'attendance'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">Attendance ({attendanceSessions.length})</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-8 space-y-3 sm:space-y-6 pb-12 sm:pb-8">
        {activeTab === 'members' ? (
          <>
            {/* Top Summary / Role Breakdown */}
            <StatsCards
              user={currentUser}
              members={visibleMembers}
              allMembers={members}
              selectedTeam={selectedTeam}
              onSelectTeam={setSelectedTeam}
              onOpenCredentials={() => setIsCredentialsModalOpen(true)}
            />

            {/* Member Table View */}
            <MemberTable
              members={visibleMembers}
              allMembers={members}
              user={currentUser}
              onAddMember={() => {
                setEditingMember(null);
                setIsMemberModalOpen(true);
              }}
              onEditMember={(member) => {
                setEditingMember(member);
                setIsMemberModalOpen(true);
              }}
              onDeleteMember={(member) => {
                setDeletingMember(member);
                setIsDeleteModalOpen(true);
              }}
              onExportCsv={handleExportCsv}
              onImportCsv={handleImportCsv}
              selectedTeam={selectedTeam}
              onSelectTeam={setSelectedTeam}
              attendanceSessions={attendanceSessions}
            />
          </>
        ) : (
          <AttendanceTracker
            user={currentUser}
            members={visibleMembers}
            allMembers={members}
            sessions={attendanceSessions}
            onSaveSession={handleSaveAttendanceSession}
            onDeleteSession={handleDeleteAttendanceSession}
            selectedTeam={selectedTeam}
            onSelectTeam={setSelectedTeam}
            showToast={showToast}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-center justify-center sm:justify-start gap-2 px-4 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl shadow-xl text-xs sm:text-sm font-medium animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
        editingMember={editingMember}
        currentUser={currentUser}
        defaultTeam={selectedTeam !== 'ALL' ? selectedTeam : undefined}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingMember(null);
        }}
        onConfirm={handleDeleteMember}
        member={deletingMember}
      />

      {currentUser.role === 'admin' && (
        <CredentialsModal
          isOpen={isCredentialsModalOpen}
          onClose={() => setIsCredentialsModalOpen(false)}
          isAdmin={true}
          credentials={credentials}
          onUpdateCredential={handleUpdateCredential}
          onResetCredentials={handleResetCredentials}
        />
      )}

      {/* Database Management & Persistence Modal */}
      <DatabaseModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        cloudMemberCount={cloudMemberCount}
        localMemberCount={members.length}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        cloudSyncError={cloudSyncError}
        isAutoSyncEnabled={isAutoSyncEnabled}
        onToggleAutoSync={handleToggleAutoSync}
        onManualSync={handleManualSync}
        onRestoreFromJson={handleRestoreFromJson}
        onSeedDefaults={handleSeedDefaults}
        onClearAllAttendance={handleClearAllAttendanceData}
        onClearAllMembers={handleClearAllMemberData}
        onClearAllData={handleClearAllData}
        attendanceSessionCount={attendanceSessions.length}
        allMembers={members}
      />
    </div>
  );
}
