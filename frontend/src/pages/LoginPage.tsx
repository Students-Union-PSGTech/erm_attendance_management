import { useState } from 'react';
import type { User } from '../types';
import { ArrowRight, Lock, User as UserIcon, Eye, EyeOff, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import TopographyBackground from '../components/TopographyBackground';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Body was empty or not valid JSON
      }

      if (!res.ok) {
        if (!data && (res.status === 502 || res.status === 504 || res.status === 500 || res.status === 404)) {
          throw new Error('Unable to connect to backend server. Please make sure the backend is running.');
        }
        throw new Error(data?.error || data?.message || 'Incorrect credentials. Please try again.');
      }

      if (!data?.token) {
        throw new Error('Invalid response from server.');
      }

      localStorage.setItem('token', data.token);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 select-none overflow-hidden bg-[#050B14]">
      {/* React Bits Living Topography Background */}
      <TopographyBackground />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-6 text-center"
        >
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-lg p-0.5 bg-gradient-to-tr from-sky-600 via-cyan-400 to-blue-500 shadow-[0_0_30px_rgba(14,165,233,0.5)]">
              <img
                src="https://ugc.production.linktr.ee/16e3a388-5f1c-4ebc-a943-a064b81991c3_243269363-3078323169067077-7607043015283444723-n.jpeg?io=true&size=avatar-v3_0"
                alt="Students Union"
                className="w-full h-full object-cover rounded-[6px]"
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Students Union
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-medium">
            Attendance Tracking & Analytics System
          </p>
        </motion.div>

        {/* Rectangular Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full rect-card-elevated p-6 sm:p-8"
        >
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/[0.08]">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Portal Authentication</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">Enter your credentials to access</p>
            </div>
            <div className="w-8 h-8 rounded-md bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-[11px] font-semibold text-[#9490A6] uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  required
                  placeholder="admin or team name"
                  className="rect-input w-full pl-9 pr-4 py-2.5 text-sm"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-[#9490A6] uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                  placeholder="Enter password"
                  className="rect-input w-full pl-9 pr-10 py-2.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs text-rose-300 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Submit Button (React Bits Glowing Sky) */}
            <button
              type="submit"
              disabled={loading}
              className="btn-sky-glow w-full flex items-center justify-center gap-2 py-2.5 mt-2 text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <p className="mt-6 text-[11px] text-[#646079] tracking-wide">
          © {new Date().getFullYear()} Students Union • PSG College of Technology
        </p>
      </div>
    </div>
  );
}