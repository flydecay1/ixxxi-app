'use client';

import { useState } from 'react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        setResult(`Signed up as ${data.email} (id: ${data.id})`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Network error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 w-full max-w-sm border border-zinc-800 p-6 rounded-xl"
      >
        <h1 className="text-2xl font-semibold mb-2">Sign up to XXXI</h1>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded bg-white text-black font-semibold disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>

        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {result && <p className="text-green-400 text-sm mt-2">{result}</p>}
      </form>
    </div>
  );
}
