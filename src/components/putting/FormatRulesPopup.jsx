import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const FORMAT_RULES = {
  classic: {
    title: 'Classic reeglid',
    range: '5m - 10m',
    start: '10m',
    rules: [
      'Alusta 10m pealt, viska 5 ketast',
      'Sees puttide põhjal järgmine distants:',
      '0 sees → 5m',
      '1 sees → 6m',
      '2 sees → 7m',
      '3 sees → 8m',
      '4 sees → 9m',
      '5 sees → 10m',
      'Punktid = distants × sees',
      'Mängi 20 ringi (kokku 100 putti)'
    ]
  },
  mini_league: {
    title: 'Mini Liiga reeglid',
    range: '5m - 10m',
    start: '10m',
    rules: [
      'Classic formaat, aga 10 ringi (50 putti)',
      'Alusta 10m pealt, viska 5 ketast',
      'Järgmine distants sõltub sissevisetest (0→5m … 5→10m)',
      'Punktid = distants × sees'
    ]
  },
  short: {
    title: 'Short reeglid',
    range: '3m - 8m',
    start: '8m',
    rules: [
      'Alusta 8m pealt, viska 5 ketast',
      'Sees puttide põhjal järgmine distants:',
      '0 sees → 3m',
      '1 sees → 4m',
      '2 sees → 5m',
      '3 sees → 6m',
      '4 sees → 7m',
      '5 sees → 8m',
      'Punktid = distants × sees',
      'Mängi 20 ringi (kokku 100 putti)'
    ]
  },
  long: {
    title: 'Long reeglid',
    range: '10m - 15m',
    start: '15m',
    rules: [
      'Alusta 15m pealt, viska 5 ketast',
      'Sees puttide põhjal järgmine distants:',
      '0 sees → 10m',
      '1 sees → 11m',
      '2 sees → 12m',
      '3 sees → 13m',
      '4 sees → 14m',
      '5 sees → 15m',
      'Punktid = distants × sees',
      'Mängi 20 ringi (kokku 100 putti)'
    ]
  },
  back_and_forth: {
    title: 'Back & Forth reeglid',
    range: '5m - 10m',
    start: '5m',
    rules: [
      'Alusta 5m pealt, viska 1 ketas korraga',
      'Sees → distants +1m',
      'Mööda → distants -1m',
      'Distants jääb 5–10m vahele',
      'Iga sees putt annab oma distantsi punktid',
      'Näide: 7m pealt sees = 7 punkti',
      'Mängi 20 ringi (kokku 100 putti)'
    ]
  },
  duel: {
    title: 'Sõbraduell reeglid',
    range: '5m - 10m',
    start: '5m',
    rules: [
      'Duell 1 vs 1, liitutakse PIN-iga',
      'Host valib ketaste arvu (1/3/5)',
      'Mõlemad sisestavad tulemuse paralleelselt',
      'Võitja liigub distantsil +1m, kaotaja jääb',
      'Viigi korral mängitakse sama distants uuesti',
      '10m võit lõpetab duelli antud jaamas'
    ]
  },
  streak_challenge: {
    title: 'Streak reeglid',
    range: '3m - 15m',
    start: 'Vali distants',
    rules: [
      'Vali distants ja viska 1 ketas korraga',
      'Sees → seeria +1, Mööda → seeria 0',
      'Tulemus = parim seeria',
      'Lõpetad ise'
    ]
  },
  random_distance: {
    title: 'Random reeglid',
    range: '3m - 10m',
    start: 'Juhuslik',
    rules: [
      'Iga ringi distants loosib (3–10m)',
      'Viska 5 ketast, 20 ringi (100 putti)',
      'Punktid = distants × sees'
    ]
  },
  time_ladder: {
    title: 'Aja väljakutse reeglid',
    range: '5m - 10m',
    start: '5m',
    rules: [
      'Alusta 5m pealt',
      '5 järjest sees → distants +1m (füüsiline arvestus)',
      'Mööda → seeria nulli',
      'Appis ainult stopper: Start alguses, Stop finišis',
      'Tulemus = aeg (väiksem on parem)'
    ]
  },
  around_the_world: {
    title: 'Around the World reeglid',
    range: '5m - 10m',
    start: '5m',
    rules: [
      'Liigud 5m → 10m → 5m, täisring = 1 lap',
      'Raskus = ketaste arv + edasi‑liikumise lävend',
      '3+ ketast: 2+ mööda või 0 sees → tagasi 5m',
      'Punktid = distants × sees (parim katse distantsil loeb)'
    ]
  }
};

export default function FormatRulesPopup({ format }) {
  const rules = FORMAT_RULES[format] || FORMAT_RULES.classic;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
          <HelpCircle className="w-5 h-5 text-slate-400 hover:text-slate-600" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{rules.title}</DialogTitle>
          <div className="text-sm text-slate-500">
            Vahemik: {rules.range} • Algus: {rules.start}
          </div>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-slate-700 mt-4">
          {rules.rules.map((rule, idx) => (
            <li key={idx} className={rule.includes('→') ? 'ml-4' : ''}>
              {rule.includes('→') ? '• ' : '• '}{rule}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
