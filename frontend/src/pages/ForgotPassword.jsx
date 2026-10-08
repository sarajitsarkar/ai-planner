import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPassword() {
  const { forgotPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await forgotPassword(email);
    if (res.success) setSent(true);
    else setError(res.message);
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <div className="mb-8 text-center">
        <span className="text-4xl">🔑</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">Reset your password</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <div className="card p-6">
        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-3xl">📬</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              If an account exists for <span className="font-semibold">{email}</span>, a reset
              link has been sent. It expires in 1 hour.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Running locally without email configured? Check the backend server's terminal —
              the reset link is printed there.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Remembered your password?{' '}
        <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400">
          Log in
        </Link>
      </p>
    </div>
  );
}
