import React from 'react';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoggingIn(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Check your email and password.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center"
      >
        <img
          src="https://dmarketing.me/wp-content/themes/dmarketing/assets/images/logo.svg"
          alt="DMARKETING Logo"
          className="h-16 mb-8"
          referrerPolicy="no-referrer"
          onError={(event) => {
            (event.target as HTMLImageElement).src = 'https://picsum.photos/seed/dmarketing/200/80';
          }}
        />
        <h1 className="text-3xl font-serif text-gray-900 mb-2">Welcome Back</h1>
        <p className="text-gray-500 mb-8 text-center">Manage your projects, content, and team in one place.</p>

        {error && (
          <div className="w-full p-4 mb-6 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100 italic">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-2xl hover:bg-gray-800 transition-all font-medium text-lg disabled:opacity-50"
          >
            {isLoggingIn ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={24} />
                Sign in
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-[11px] text-gray-400 text-center leading-relaxed">
          Authorized DMARKETING team members and approved clients only.
        </p>
      </motion.div>
    </div>
  );
};
