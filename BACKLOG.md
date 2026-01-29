# Backlog

Legend: 🔴 Kriitiline, 🟡 Keskmine, 🟢 Low.  
Done = ✅, Osaline = ⏳, Open = ☐

## 🔴 Kriitiline
- ✅ ATW multi‑player race fix (client‑side merge + per‑player seq guard)
- ☐ ATW “Made/Undo/Retry” konfliktide lukustus (200–300ms action lock) — *rejected, tekitas LAGi*
- ✅ ATW anomaalia: mäng jääb 5m peale (mitme mängija ajal)
- ⏳ ATW rapid UNDO: harv “stuck” (player jääb 5m peale) — *soft lock undo 200ms*
- ✅ Laps loogika: 1 ring = 5→10 + 10→5 (praegu vale)

## 🟡 Keskmine
- ☐ Leaderboard pagination + limit 50
- ☐ Leaderboard server‑filter (gender + month)
- ☐ ATW/Player round‑commit batch (DB write ainult roundi lõpus)
- ⏳ ErrorBoundary prod‑log + user‑friendly retry
- ☐ Ühtne realtime hook (subscribe + throttle + cleanup + retry)
- ☐ Putting Records: osad tulemused ei ilmu (nt Sigmar)
- ☐ Leaderboard ATW skoori klikk crash + peaks avama hostitud mängu
- ☐ My Profile: ATW mängud ei tule välja
- ☐ Missed = auto‑restart + eraldi karika/exit nupud
- ☐ Unikaalne mängu URL (pin vms) jagamiseks
- ☐ 3+ raskus: UI “täpikeste” järgi per‑disc sisestus
- ☐ 3+ raskus: 1 miss ei reseti, rohkem miss = reset

## 🟢 Low
- ☐ ATW tabelis eemaldada Accuracy + Putts (jätta Score)
- ☐ ATW stats: Accuracy → Attempts (restart count)
- ☐ Loading/skeleton unify (standard loading/empty states)
- ☐ ATW/PlayerView split (state hook + UI components)
- ☐ Score/transition utils (shared gameRules)
- ☐ Tests (gameRules unit + ATW integration)
- ☐ Observability (error logs + sync latency metrics)
