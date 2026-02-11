import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n';

export default function FormatRulesPopup({ format }) {
  const { t } = useLanguage();
  const FORMAT_RULES = {
    classic: {
      title: t('rules.classic.title', 'Classic reeglid'),
      range: t('rules.classic.range', '5m - 10m'),
      start: t('rules.classic.start', '10m'),
      rules: [
        t('rules.classic.1', 'Alusta 10m pealt, viska 5 ketast'),
        t('rules.classic.2', 'Sees puttide põhjal järgmine distants:'),
        t('rules.classic.3', '0 sees → 5m'),
        t('rules.classic.4', '1 sees → 6m'),
        t('rules.classic.5', '2 sees → 7m'),
        t('rules.classic.6', '3 sees → 8m'),
        t('rules.classic.7', '4 sees → 9m'),
        t('rules.classic.8', '5 sees → 10m'),
        t('rules.classic.9', 'Punktid = distants × sees'),
        t('rules.classic.10', 'Mängi 20 ringi (kokku 100 putti)')
      ]
    },
    mini_league: {
      title: t('rules.mini_league.title', 'Mini Liiga reeglid'),
      range: t('rules.mini_league.range', '5m - 10m'),
      start: t('rules.mini_league.start', '10m'),
      rules: [
        t('rules.mini_league.1', 'Classic formaat, aga 10 ringi (50 putti)'),
        t('rules.mini_league.2', 'Alusta 10m pealt, viska 5 ketast'),
        t('rules.mini_league.3', 'Järgmine distants sõltub sissevisetest (0→5m … 5→10m)'),
        t('rules.mini_league.4', 'Punktid = distants × sees')
      ]
    },
    short: {
      title: t('rules.short.title', 'Short reeglid'),
      range: t('rules.short.range', '3m - 8m'),
      start: t('rules.short.start', '8m'),
      rules: [
        t('rules.short.1', 'Alusta 8m pealt, viska 5 ketast'),
        t('rules.short.2', 'Sees puttide põhjal järgmine distants:'),
        t('rules.short.3', '0 sees → 3m'),
        t('rules.short.4', '1 sees → 4m'),
        t('rules.short.5', '2 sees → 5m'),
        t('rules.short.6', '3 sees → 6m'),
        t('rules.short.7', '4 sees → 7m'),
        t('rules.short.8', '5 sees → 8m'),
        t('rules.short.9', 'Punktid = distants × sees'),
        t('rules.short.10', 'Mängi 20 ringi (kokku 100 putti)')
      ]
    },
    long: {
      title: t('rules.long.title', 'Long reeglid'),
      range: t('rules.long.range', '10m - 15m'),
      start: t('rules.long.start', '15m'),
      rules: [
        t('rules.long.1', 'Alusta 15m pealt, viska 5 ketast'),
        t('rules.long.2', 'Sees puttide põhjal järgmine distants:'),
        t('rules.long.3', '0 sees → 10m'),
        t('rules.long.4', '1 sees → 11m'),
        t('rules.long.5', '2 sees → 12m'),
        t('rules.long.6', '3 sees → 13m'),
        t('rules.long.7', '4 sees → 14m'),
        t('rules.long.8', '5 sees → 15m'),
        t('rules.long.9', 'Punktid = distants × sees'),
        t('rules.long.10', 'Mängi 20 ringi (kokku 100 putti)')
      ]
    },
    back_and_forth: {
      title: t('rules.back_and_forth.title', 'Back & Forth reeglid'),
      range: t('rules.back_and_forth.range', '5m - 10m'),
      start: t('rules.back_and_forth.start', '5m'),
      rules: [
        t('rules.back_and_forth.1', 'Alusta 5m pealt, viska 1 ketas korraga'),
        t('rules.back_and_forth.2', 'Sees → distants +1m'),
        t('rules.back_and_forth.3', 'Mööda → distants -1m'),
        t('rules.back_and_forth.4', 'Distants jääb 5–10m vahele'),
        t('rules.back_and_forth.5', 'Iga sees putt annab oma distantsi punktid'),
        t('rules.back_and_forth.6', 'Näide: 7m pealt sees = 7 punkti'),
        t('rules.back_and_forth.7', 'Mängi 20 ringi (kokku 100 putti)')
      ]
    },
    duel: {
      title: t('rules.duel.title', 'Sõbraduell reeglid'),
      range: t('rules.duel.range', '5m - 10m'),
      start: t('rules.duel.start', '5m'),
      rules: [
        t('rules.duel.1', 'Duell 1 vs 1, liitutakse PIN-iga'),
        t('rules.duel.2', 'Host valib ketaste arvu (1/3/5)'),
        t('rules.duel.3', 'Mõlemad sisestavad tulemuse paralleelselt'),
        t('rules.duel.4', 'Võitja liigub distantsil +1m, kaotaja jääb'),
        t('rules.duel.5', 'Viigi korral mängitakse sama distants uuesti'),
        t('rules.duel.6', '10m võit lõpetab duelli antud jaamas')
      ]
    },
    streak_challenge: {
      title: t('rules.streak.title', 'Streak reeglid'),
      range: t('rules.streak.range', '3m - 15m'),
      start: t('rules.streak.start', 'Vali distants'),
      rules: [
        t('rules.streak.1', 'Vali distants ja viska 1 ketas korraga'),
        t('rules.streak.2', 'Sees → seeria +1, Mööda → seeria 0'),
        t('rules.streak.3', 'Tulemus = parim seeria'),
        t('rules.streak.4', 'Lõpetad ise')
      ]
    },
    random_distance: {
      title: t('rules.random.title', 'Random reeglid'),
      range: t('rules.random.range', '3m - 10m'),
      start: t('rules.random.start', 'Juhuslik'),
      rules: [
        t('rules.random.1', 'Iga ringi distants loosib (3–10m)'),
        t('rules.random.2', 'Viska 5 ketast, 20 ringi (100 putti)'),
        t('rules.random.3', 'Punktid = distants × sees')
      ]
    },
    time_ladder: {
      title: t('rules.time_ladder.title', 'Aja väljakutse reeglid'),
      range: t('rules.time_ladder.range', '5m - 10m'),
      start: t('rules.time_ladder.start', '5m'),
      rules: [
        t('rules.time_ladder.1', 'Alusta 5m pealt'),
        t('rules.time_ladder.2', '5 järjest sees → distants +1m (füüsiline arvestus)'),
        t('rules.time_ladder.3', 'Mööda → seeria nulli'),
        t('rules.time_ladder.4', 'Appis ainult stopper: Start alguses, Stop finišis'),
        t('rules.time_ladder.5', 'Tulemus = aeg (väiksem on parem)')
      ]
    },
    around_the_world: {
      title: t('rules.atw.title', 'Around the World reeglid'),
      range: t('rules.atw.range', '5m - 10m'),
      start: t('rules.atw.start', '5m'),
      rules: [
        t('rules.atw.1', 'Liigud 5m → 10m → 5m, täisring = 1 lap'),
        t('rules.atw.2', 'Raskus = ketaste arv + edasi‑liikumise lävend'),
        t('rules.atw.3', '3+ ketast: 2+ mööda või 0 sees → tagasi 5m'),
        t('rules.atw.4', 'Punktid = distants × sees (parim katse distantsil loeb)')
      ]
    }
  };
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
            {t('rules.range_label', 'Vahemik')}: {rules.range} • {t('rules.start_label', 'Algus')}: {rules.start}
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
