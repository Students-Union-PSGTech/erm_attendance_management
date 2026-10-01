import React from 'react';
import { TeamMember } from '../types';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  member: TeamMember | null;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  member,
}) => {
  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="delete-confirm-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Member</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Are you sure you want to remove <strong className="text-slate-800 dark:text-slate-200">{member.name}</strong> ({member.role} in {member.team}) from the directory?
        </p>

        <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-btn"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>Delete Member</span>
          </button>
        </div>
      </div>
    </div>
  );
};
