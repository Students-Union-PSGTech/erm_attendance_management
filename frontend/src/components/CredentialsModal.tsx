import React, { useState } from 'react';
import { CredentialInfo, TeamType } from '../types';
import { TEAM_COLORS } from '../data/initialData';
import {
  Shield,
  Users,
  Key,
  Copy,
  Check,
  X,
  Edit2,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Search,
} from 'lucide-react';

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  credentials: CredentialInfo[];
  onUpdateCredential: (updated: CredentialInfo, oldUsername: string) => void;
  onResetCredentials: () => void;
}

export const CredentialsModal: React.FC<CredentialsModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  credentials,
  onUpdateCredential,
  onResetCredentials,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ username: string; password: string }>({
    username: '',
    password: '',
  });
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isOpen || !isAdmin) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleShowPassword = (userKey: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [userKey]: !prev[userKey],
    }));
  };

  const handleStartEdit = (cred: CredentialInfo) => {
    setEditingUsername(cred.username);
    setEditForm({
      username: cred.username,
      password: cred.password,
    });
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingUsername(null);
    setEditForm({ username: '', password: '' });
    setEditError(null);
  };

  const generateRandomPassword = (team?: TeamType) => {
    const prefix = team ? team.toLowerCase() : 'admin';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const symbols = ['!', '@', '#', '$', '%'];
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    return `${prefix}${sym}pass${randNum}`;
  };

  const handleSaveEdit = (cred: CredentialInfo) => {
    const trimmedUsername = editForm.username.trim();
    const trimmedPassword = editForm.password.trim();

    if (!trimmedUsername) {
      setEditError('Username cannot be empty.');
      return;
    }
    if (!trimmedPassword) {
      setEditError('Password cannot be empty.');
      return;
    }
    if (trimmedPassword.length < 4) {
      setEditError('Password must be at least 4 characters long.');
      return;
    }

    // Check username collision with other credentials
    const exists = credentials.some(
      (c) => c.username.toLowerCase() === trimmedUsername.toLowerCase() && c.username !== cred.username
    );
    if (exists) {
      setEditError(`The username "${trimmedUsername}" is already taken by another account.`);
      return;
    }

    const updated: CredentialInfo = {
      ...cred,
      username: trimmedUsername,
      password: trimmedPassword,
    };

    onUpdateCredential(updated, cred.username);
    setEditingUsername(null);
    setEditError(null);
  };

  const filteredCredentials = credentials.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.label.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      (c.team && c.team.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="credentials-modal-card"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white text-base sm:text-lg">
                  {isAdmin ? 'Manage Credentials' : 'Credentials'}
                </h3>
                {isAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                {isAdmin
                  ? 'View and modify credentials for each team account'
                  : 'View assigned team credentials for login'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Filter and Info */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team or account..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 text-xs transition-colors shrink-0"
                title="Reset all credentials to factory defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            )}
          </div>

          {showResetConfirm && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Reset all usernames &amp; passwords back to original defaults?</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:underline"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onResetCredentials();
                    setShowResetConfirm(false);
                  }}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Credentials List */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-3 sm:space-y-3.5 flex-1">
          {filteredCredentials.map((cred) => {
            const isAccountAdmin = cred.role === 'admin';
            const teamColor = cred.team ? TEAM_COLORS[cred.team] : null;
            const isEditing = editingUsername === cred.username;
            const isPasswordVisible = !!showPasswordMap[cred.username];

            return (
              <div
                key={cred.username}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                  isEditing
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-md'
                    : isAccountAdmin
                    ? 'bg-slate-900 text-white border-slate-700 dark:bg-slate-950 dark:border-slate-800'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                {/* Card Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        isAccountAdmin
                          ? 'bg-amber-400/20 text-amber-400'
                          : teamColor
                          ? `${teamColor.lightBg} ${teamColor.text}`
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isAccountAdmin ? <Shield className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold text-sm ${
                            isAccountAdmin ? 'text-white' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {cred.label}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            isAccountAdmin
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isAccountAdmin ? 'ADMIN' : `${cred.team} TEAM`}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${
                          isAccountAdmin ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {cred.description}
                      </p>
                    </div>
                  </div>

                  {isAdmin && !isEditing && (
                    <button
                      id={`edit-cred-${cred.username}`}
                      onClick={() => handleStartEdit(cred)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                        isAccountAdmin
                          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                          : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                      }`}
                      title={`Change credentials for ${cred.label}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Change</span>
                    </button>
                  )}
                </div>

                {/* EDIT MODE */}
                {isEditing ? (
                  <div className="mt-3.5 pt-3 border-t border-indigo-200 dark:border-indigo-800/60 space-y-3">
                    {editError && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{editError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Username
                        </label>
                        <input
                          id={`input-username-${cred.username}`}
                          type="text"
                          value={editForm.username}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, username: e.target.value }))
                          }
                          className="w-full px-3 py-2 min-h-[40px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setEditForm((prev) => ({
                                ...prev,
                                password: generateRandomPassword(cred.team),
                              }))
                            }
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            title="Generate a secure random password"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Generate</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            id={`input-password-${cred.username}`}
                            type={isPasswordVisible ? 'text' : 'password'}
                            value={editForm.password}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, password: e.target.value }))
                            }
                            className="w-full pl-3 pr-8 py-2 min-h-[40px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword(cred.username)}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            {isPasswordVisible ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-3.5 py-2 min-h-[40px] text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id={`save-cred-${cred.username}`}
                        onClick={() => handleSaveEdit(cred)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Credentials</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* VIEW MODE */
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Username:</span>
                        <code
                          className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                            isAccountAdmin
                              ? 'bg-slate-800 text-slate-200'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {cred.username}
                        </code>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Password:</span>
                        <div className="flex items-center gap-1">
                          <code
                            className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                              isAccountAdmin
                                ? 'bg-slate-800 text-slate-200'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {isPasswordVisible ? cred.password : '••••••••••••'}
                          </code>
                          <button
                            type="button"
                            onClick={() => toggleShowPassword(cred.username)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title={isPasswordVisible ? 'Hide password' : 'Show password'}
                          >
                            {isPasswordVisible ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        onClick={() =>
                          copyToClipboard(`${cred.username} : ${cred.password}`, cred.username)
                        }
                        className={`flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 min-h-[36px] rounded-lg transition-colors cursor-pointer ${
                          isAccountAdmin
                            ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200'
                        }`}
                        title="Copy username and password pair"
                      >
                        {copiedKey === cred.username ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Pair</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredCredentials.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching credentials found for &quot;{searchQuery}&quot;.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 truncate mr-2">
            {isAdmin
              ? 'Changes take effect immediately.'
              : 'Contact admin for credential changes.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 min-h-[40px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
