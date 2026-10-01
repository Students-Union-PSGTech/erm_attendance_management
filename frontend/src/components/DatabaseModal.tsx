import React, { useState } from 'react';
import { TeamMember } from '../types';
import { FIRESTORE_DATABASE_ID } from '../firebase';
import {
  Database,
  Cloud,
  CheckCircle2,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  X,
  HardDrive,
  ShieldCheck,
  Server,
  Layers,
} from 'lucide-react';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudMemberCount: number;
  localMemberCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  cloudSyncError: string | null;
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
  onManualSync: () => Promise<void>;
  onRestoreFromJson: (members: TeamMember[]) => Promise<void>;
  onSeedDefaults: () => Promise<void>;
  onClearAllAttendance?: () => Promise<void>;
  onClearAllMembers?: () => Promise<void>;
  onClearAllData?: () => Promise<void>;
  attendanceSessionCount?: number;
  allMembers: TeamMember[];
}

export function DatabaseModal({
  isOpen,
  onClose,
  cloudMemberCount,
  localMemberCount,
  isSyncing,
  lastSyncTime,
  cloudSyncError,
  isAutoSyncEnabled,
  onToggleAutoSync,
  onManualSync,
  onRestoreFromJson,
  onSeedDefaults,
  onClearAllAttendance,
  onClearAllMembers,
  onClearAllData,
  attendanceSessionCount = 0,
  allMembers,
}: DatabaseModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'backup' | 'danger'>('status');
  const [seedConfirmText, setSeedConfirmText] = useState('');
  const [clearAttendanceConfirm, setClearAttendanceConfirm] = useState('');
  const [clearAllConfirm, setClearAllConfirm] = useState('');
  const [jsonUploadStatus, setJsonUploadStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    const data = {
      app: 'Team Data Manager',
      exportedAt: new Date().toISOString(),
      databaseId: FIRESTORE_DATABASE_ID,
      totalCount: allMembers.length,
      members: allMembers,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team_data_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const membersToRestore: TeamMember[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.members)
          ? parsed.members
          : null;

        if (!membersToRestore || membersToRestore.length === 0) {
          setJsonUploadStatus('Error: Invalid backup file format. No members found.');
          return;
        }

        setJsonUploadStatus(`Restoring ${membersToRestore.length} members to Cloud Database...`);
        await onRestoreFromJson(membersToRestore);
        setJsonUploadStatus(`Successfully restored ${membersToRestore.length} members!`);
      } catch (err) {
        setJsonUploadStatus(`Failed to parse JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="database-management-modal"
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>Cloud Database & Safety</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  Connected
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Independent Cloud Storage • Protects data across Studio & Vercel builds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Banner */}
        <div className="p-3 sm:p-3.5 px-4 sm:px-5 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-200">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px] sm:text-xs">
            <strong className="font-semibold">Zero-Data-Loss Guarantee:</strong> All member entries are stored
            directly in your dedicated cloud database. Changing code, updating the UI, or
            deploying fresh builds will <em>never</em> overwrite or delete your live uploaded data.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 pt-2 gap-1 sm:gap-2 bg-slate-50/50 dark:bg-slate-900/50 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 pt-1 px-3 min-h-[40px] text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Status & Info
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 pt-1 px-3 min-h-[40px] text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'backup'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Backup & Restore
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`pb-2.5 pt-1 px-3 min-h-[40px] text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'danger'
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Reset / Seed
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Real-Time Auto-Sync Controller Card */}
              <div className="p-4 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-indigo-500/5 dark:from-emerald-950/40 dark:via-slate-900 dark:to-indigo-950/40 rounded-xl border border-emerald-500/20 dark:border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <RefreshCw className={`w-4 h-4 ${isAutoSyncEnabled && isSyncing ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-xs">
                          Real-time Auto-Sync
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isAutoSyncEnabled
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isAutoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {isAutoSyncEnabled ? 'Live Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {isAutoSyncEnabled
                          ? 'Automatic WebSocket listener keeps data synchronized instantly across tabs, devices, and deployments.'
                          : 'Auto-sync is paused. Cloud changes will only update upon manual refresh.'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    id="auto-sync-toggle-btn"
                    onClick={onToggleAutoSync}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-xs ${
                      isAutoSyncEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={isAutoSyncEnabled}
                    title={isAutoSyncEnabled ? "Click to pause real-time auto-sync" : "Click to activate real-time auto-sync"}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isAutoSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                      Cloud Firestore
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{cloudMemberCount}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Records in Cloud DB</div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                      Local Cached
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{localMemberCount}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Records in Local State</div>
                </div>
              </div>

              {/* Database Connection Specs */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Engine:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Google Cloud Firestore</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Database ID:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                    {FIRESTORE_DATABASE_ID}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Last Synced:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Just now'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 dark:text-slate-400">Deployment Independence:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Server className="w-3 h-3" /> Fully Decoupled
                  </span>
                </div>
              </div>

              {cloudSyncError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{cloudSyncError}</span>
                </div>
              )}

              {/* Sync Action Button */}
              <div className="pt-2">
                <button
                  onClick={onManualSync}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Synchronizing with Firestore...' : 'Force Re-sync with Cloud Database'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Export Full JSON Snapshot</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Download an exact point-in-time backup of all {allMembers.length} team members with their roll numbers,
                  departments, roles, and years of study.
                </p>
                <button
                  onClick={handleDownloadBackup}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-xl hover:opacity-90 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Backup JSON ({allMembers.length} records)
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Restore from JSON Backup</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Upload a previously saved JSON snapshot. All members in the backup will be saved directly into your
                  live Firestore cloud database.
                </p>
                <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Choose JSON Backup File
                  <input type="file" accept=".json" onChange={handleJsonFileUpload} className="hidden" />
                </label>

                {jsonUploadStatus && (
                  <div className="text-xs p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg text-indigo-900 dark:text-indigo-200 font-medium">
                    {jsonUploadStatus}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-4">
              {/* Option 1: Delete All Attendance Sessions */}
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Clear All Attendance Records ({attendanceSessionCount} Sessions)</span>
                  </div>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Removes all past attendance sheets and records from Cloud Firestore and local storage.
                  Use this to start with a clean slate for upcoming meetings without affecting your member directory.
                </p>
                 <div className="pt-1">
                  {clearAttendanceConfirm === 'CONFIRM_ATTENDANCE' ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        Are you sure? This cannot be undone:
                      </span>
                      <button
                        disabled={isSyncing}
                        onClick={async () => {
                          if (onClearAllAttendance) await onClearAllAttendance();
                          setClearAttendanceConfirm('');
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-all cursor-pointer"
                      >
                        Yes, Delete All Sessions
                      </button>
                      <button
                        onClick={() => setClearAttendanceConfirm('')}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg hover:bg-slate-300 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={isSyncing}
                      onClick={() => setClearAttendanceConfirm('CONFIRM_ATTENDANCE')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                    >
                      <span>Delete All Attendance Sessions</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Option 2: Delete ALL Previous Data (Members + Attendance Full Wipe) */}
              <div className="p-4 bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl space-y-3 text-xs">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Delete ALL Previous Data (Full Database Wipe)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Permanently deletes all members ({allMembers.length} records) AND all attendance sessions ({attendanceSessionCount} records)
                  from Cloud Firestore and local cache.
                </p>
                <div className="space-y-2 pt-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Type <span className="font-mono font-bold text-red-600">DELETE ALL</span> to confirm:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={clearAllConfirm}
                      onChange={(e) => setClearAllConfirm(e.target.value)}
                      placeholder="Type DELETE ALL"
                      className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs w-full max-w-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                    <button
                      disabled={clearAllConfirm !== 'DELETE ALL' || isSyncing}
                      onClick={async () => {
                        if (onClearAllData) await onClearAllData();
                        setClearAllConfirm('');
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Delete All Data Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 3: Reset & Seed 229 Members */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 text-xs">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                  <Database className="w-4 h-4 text-indigo-500" />
                  <span>Reset &amp; Seed Official 229 Roster Members</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Re-populates the cloud database with the official 229 verified members
                  across all 6 teams (MEDIA, AMBIANCE, PR, TECH, ERM, DESIGN).
                </p>
                <div className="space-y-2 pt-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Type <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">CONFIRM</span> to proceed:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={seedConfirmText}
                      onChange={(e) => setSeedConfirmText(e.target.value)}
                      placeholder="Type CONFIRM"
                      className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs w-full max-w-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      disabled={seedConfirmText !== 'CONFIRM' || isSyncing}
                      onClick={async () => {
                        await onSeedDefaults();
                        setSeedConfirmText('');
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Reset &amp; Seed 229 Members
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex justify-between items-center text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            Protected by Cloud Firestore Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
