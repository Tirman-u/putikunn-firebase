# Backlog (Test env, Feb 2026)

## Master prompt (tööreeglid)
- Arendus ainult TEST keskkonnas (`test.putikunn.ee`). PROD/LIVE keskkonda ei muudeta.
- Deploy vajadusel ainult `hosting:test`.
- Iga deployga uuenda versioon (`package.json` + `package-lock.json`).
- LIVE deploy on lubatud ainult kasutaja eraldi, selge käsuga.
- Vaikimisi töövoog: deploy testi + git push.
- Uute UI flow’de puhul küsi enne disaini/flow kinnituse.
- Dark mode: taust peab olema puhas `#000`, halle kaarte ei kasuta; kõik `bg-*` taustad peavad jääma tumedaks.
- iOS-like visuaalne stiil kehtib terves rakenduses (mitte ainult Home/SOLO/HOST).
- Olemasolevaid mänge ei muudeta/lammutata ilma eraldi palveta.
- Kui nõue on ebaselge, küsi täpsustusi ja paku parem tehniline alternatiiv, kui see on olemas.

## 🟡 Open
- Putting King: flow + loogika review, parandused, et mäng tööle saada.

## ✅ Done (viimati tehtud)
- Admin paneel v2:
  - KPI-d: kasutajad kokku, aktiivsed täna, online viimased 15 min, aktiivsed mängud/duellid, 30p aktiivsus.
  - Kiirtegevused: force close seisnud/kõik aktiivsed mängud ja duellid.
  - Rekordite parandus trigger (time ladder fix) otse administ.
  - Audit log: admin tegevused talletuvad ja on paneelis nähtavad.
  - Health/debug: errorid 60m/24h, stale mängud, build/env info.
- Aktiivsuse tracking:
  - Heartbeat tracker navigeerimisel + perioodiliselt, et "täna" ja "15 min" aktiivsus oleks sisuline.
  - 30 päeva aktiivsus jäi alles trendivaateks.
- Treeningu liigapunktid (rank + HC): astmeline 70% boonus töötab korrektselt (`6. koht +0.3`, iga koht üles +0.3); varasemad salvestatud tulemused ja hooaja punktid backfillitud.
- Uus SOLO mäng: Aja väljakutse (5m → 10m, 5 järjest sees = +1m, ajapõhine edetabel, kettavalik 3/5/7).
- Treeneri süsteem päriselt tööle (grupid/PIN/UI/permissions).
- Firestore read‑quota: audit + päringute vähendused.
- Profiil: näita ainult SOLO mänge (hostitud Manage Games all, osalemise erand).
- Sõbraduell (SOLO) sisestus sõltumatu + undo mõlemale.
- Rekordite tabel: ATW “Naised” filter töötab.
- Max skoor “potentsiaalne” tagasi (kiire lahendus, ilma lisapäringuta).
- My Profile: “Languse põhjus” tekst pehmemaks.
- Putting Records: dublikaatide dedup.
- Treeningu liigatabel: treeningu lõpu mäng(ud) + offline mäng → punktid; hooaja tabel (putikuningas) + “paranda oma parimat” boonus.
- Treeningu liiga (HC): grupp + kellaaeg; hooaeg start/end + “trenni jäänud”; osalus 1p + HC boonus; ATW/Classic/Short kõik HC; offline punktid käsitsi.
