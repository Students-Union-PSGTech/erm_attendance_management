import type { User } from '../types';
import {
  Users,
  Calendar,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface TeamDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function TeamDashboard({ user, onLogout }: TeamDashboardProps) {
  return (
    <div className="flex h-screen bg-[#F8FAFD] text-[#1F1F1F]">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-[#F8FAFD] py-4 px-2 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 mb-6">
          <div className="flex gap-0.5">
            <span className="font-bold text-xl" style={{ color: '#4285F4' }}>E</span>
            <span className="font-bold text-xl" style={{ color: '#EA4335' }}>R</span>
            <span className="font-bold text-xl" style={{ color: '#FBBC05' }}>M</span>
          </div>
          <span className="text-[#1F1F1F] text-lg font-normal">Drive</span>
        </div>

        {/* Team badge */}
        <div className="mx-3 mb-5 px-3 py-2 rounded-xl bg-[#E8F0FE] border border-[#C5D9F5]">
          <p className="text-xs text-[#444746]">Signed in as</p>
          <p className="text-sm font-medium text-[#1A73E8]">{user.team} Team</p>
        </div>

        {/* Nav */}
        <nav className="space-y-1 flex-1">
          {[
            { icon: Users, label: 'My Team', active: true },
            { icon: Calendar, label: 'Attendance', active: false },
          ].map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#C2E7FF] text-[#001D35]'
                  : 'text-[#444746] hover:bg-[#E1E5EA]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Logout at bottom */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-[#444746] hover:bg-[#E1E5EA] transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-3 bg-[#F8FAFD] gap-4">
          <div className="flex-1 max-w-2xl">
            <div className="flex items-center gap-3 bg-[#E9EEF6] hover:bg-[#DDE3EA] focus-within:bg-white focus-within:shadow-md rounded-full px-5 py-3 transition-all border border-transparent focus-within:border-[#E0E0E0]">
              <Search className="w-5 h-5 text-[#444746] shrink-0" />
              <input
                type="text"
                placeholder="Search your team..."
                className="bg-transparent border-none outline-none w-full text-sm text-[#1F1F1F] placeholder-[#444746]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2.5 rounded-full hover:bg-[#E1E5EA] transition-colors">
              <Bell className="w-5 h-5 text-[#444746]" />
            </button>
            <button
              onClick={onLogout}
              title="Sign out"
              className="flex items-center gap-2 hover:bg-[#E1E5EA] rounded-full px-2 py-1.5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#34A853] flex items-center justify-center text-white text-sm font-medium">
                {user.username[0].toUpperCase()}
              </div>
              <ChevronDown className="w-4 h-4 text-[#444746]" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-white rounded-2xl mx-4 mb-4 border border-[#E3E3E3]">
          <div className="p-8">
            <h2 className="text-2xl font-normal text-[#1F1F1F] mb-1" style={{ fontFamily: "'Google Sans', Roboto, sans-serif" }}>
              {user.team} Team Dashboard
            </h2>
            <p className="text-sm text-[#444746] mb-8">Your team's attendance and members</p>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Team Members', value: '18', icon: Users, color: '#4285F4', bg: '#E8F0FE' },
                { label: 'Present Today', value: '13', icon: CheckCircle, color: '#34A853', bg: '#E6F4EA' },
                { label: 'Absent Today', value: '5', icon: XCircle, color: '#EA4335', bg: '#FCE8E6' },
              ].map((stat) => (
                <div key={stat.label} className="border border-[#E3E3E3] rounded-xl p-5 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: stat.bg }}>
                      <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                    </div>
                    <p className="text-sm text-[#444746]">{stat.label}</p>
                  </div>
                  <p className="text-3xl font-normal" style={{ color: stat.color, fontFamily: "'Google Sans', Roboto, sans-serif" }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Today's attendance */}
            <div className="border border-[#E3E3E3] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E3E3E3] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#444746]" />
                <span className="text-sm font-medium text-[#1F1F1F]">Today's Attendance</span>
                <span className="ml-auto text-xs text-[#444746]">{new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
              </div>
              <div className="divide-y divide-[#F1F3F4]">
                {[
                  { name: 'Alice Johnson', status: 'present' },
                  { name: 'Bob Smith', status: 'absent' },
                  { name: 'Carol White', status: 'present' },
                  { name: 'David Lee', status: 'present' },
                  { name: 'Eve Brown', status: 'absent' },
                ].map((m) => (
                  <div key={m.name} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFD] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center text-sm font-medium">
                      {m.name[0]}
                    </div>
                    <p className="text-sm text-[#1F1F1F]">{m.name}</p>
                    <span
                      className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium ${
                        m.status === 'present'
                          ? 'bg-[#E6F4EA] text-[#137333]'
                          : 'bg-[#FCE8E6] text-[#B3261E]'
                      }`}
                    >
                      {m.status === 'present' ? 'Present' : 'Absent'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
