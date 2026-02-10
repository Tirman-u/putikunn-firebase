import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createPageUrl } from '@/utils';

const providerMap = {
  google: {
    label: 'Google',
    provider: new GoogleAuthProvider()
  }
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate(createPageUrl('Home'));
    } catch (error) {
      setMessage(error?.message || 'Autentimine ebaonnestus');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderLogin = async (providerKey) => {
    setLoading(true);
    setMessage('');
    try {
      const provider = providerMap[providerKey]?.provider;
      if (!provider) throw new Error('Tundmatu provider');
      await signInWithPopup(auth, provider);
      navigate(createPageUrl('Home'));
    } catch (error) {
      setMessage(error?.message || 'Sisselogimine ebaonnestus');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setMessage('Sisesta email, et parooli lähtestada.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Parooli lähtestamise kiri saadetud.');
    } catch (error) {
      setMessage(error?.message || 'Parooli lähtestamine ebaonnestus');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-slate-800">Putikunn</h1>
          <p className="text-sm text-slate-500">
            {mode === 'signup' ? 'Loo uus konto' : 'Logi sisse'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAuth}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="name@email.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Parool</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 text-white py-2 font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {mode === 'signup' ? 'Loo konto' : 'Logi sisse'}
          </button>
        </form>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <button
            type="button"
            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
            className="hover:text-slate-700"
          >
            {mode === 'signup' ? 'Mul on konto' : 'Mul pole kontot'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="hover:text-slate-700"
          >
            Unustasid parooli?
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-400 text-center">Või logi sisse teenusega</p>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(providerMap).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleProviderLogin(key)}
                disabled={loading}
                className="rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 border border-slate-200">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
