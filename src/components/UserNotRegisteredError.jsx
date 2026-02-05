import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Ligipääs piiratud</h1>
          <p className="text-slate-600 mb-8">
            Sa ei ole registreeritud selle rakenduse kasutajaks. Palun võta ligipääsu saamiseks ühendust administraatoriga.
          </p>
          <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600">
            <p>Kui arvad, et see on viga, siis:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Kontrolli, et oled sisse logitud õige kontoga</li>
              <li>Võta ligipääsu saamiseks ühendust administraatoriga</li>
              <li>Proovi välja logida ja uuesti sisse logida</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
