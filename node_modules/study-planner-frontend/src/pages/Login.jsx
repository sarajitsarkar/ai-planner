import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(form);
    if (res.success) navigate('/');
    else setError(res.message);
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <div className="mb-8 text-center">
        <span className="text-4xl">📚</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Log in to continue your study plan</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label !mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-primary-600 dark:text-primary-400">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-primary-600 dark:text-primary-400">
          Sign up
        </Link>
      </p>
    </div>
  );
}
