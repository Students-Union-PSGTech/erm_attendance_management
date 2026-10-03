import { useState } from 'react';
import type { User } from '../types';
import { ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
}


export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ username: username.trim(), password })
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
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col items-center justify-center px-4">

      {/* Brand */}
      <div className="flex flex-col items-center mb-6">
        <img
          src="https://ugc.production.linktr.ee/16e3a388-5f1c-4ebc-a943-a064b81991c3_243269363-3078323169067077-7607043015283444723-n.jpeg?io=true&size=avatar-v3_0"
          alt="PSG Tech Students Union Logo"
          className="w-16 h-16 rounded-2xl object-cover mb-3 shadow-md"
        />
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Students Union</h1>
        <p className="text-xs text-slate-500 mt-1">Attendance Management Portal</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
        <h2 className="text-base font-semibold text-slate-800 mb-5">Sign in to continue</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              required
              placeholder="Enter your username"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              required
              placeholder="Enter your password"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 mt-1 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 cursor-pointer"
            style={{
              background: loading
                ? '#94A3B8'
                : 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(29,78,216,0.28)',
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Signing in...
              </span>
            ) : (
              <>Sign in <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-5 text-[11px] text-slate-400">
        {new Date().getFullYear()} Students Union
      </p>
    </div>
  );
}
