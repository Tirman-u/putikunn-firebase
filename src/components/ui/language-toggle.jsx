import React from 'react';
import { useLanguage } from '@/lib/i18n';

export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();

  const options = [
    { id: 'et', label: '🇪🇪' },
    { id: 'en', label: '🇬🇧' }
  ];

  return (
    <div className="flex items-center rounded-full border border-white/70 bg-white/70 p-1 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setLang(option.id)}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition ${
            lang === option.id
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/5'
          }`}
          aria-label={option.id === 'et' ? t('lang.et', 'Eesti') : t('lang.en', 'English')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
