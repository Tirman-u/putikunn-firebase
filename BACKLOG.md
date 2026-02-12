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
- EST/EN keele tugi (praegu app ainult eesti keeles).
- Putting King: flow + loogika review, parandused, et mäng tööle saada.
- Treeneri/trennilise vaade: kui trenniline tahab teha 2 trenni järjest, tal on vaba koht olemas ja ta ei ole veel 1x enda kohta vabastanud, siis `Asendan koha` asemel peab nupp olema `Teen teise trenni järjest`.
- Trenniline ei tohi nimekirja tekkida enne, kui treener on kinnitanud. Kui liitutakse PIN-koodiga ja kasutajal on juba aktiivne grupp, rakendus küsib: "Sul on juba aktiivne grupp olemas. Kas soovid teist püsiaega juurde?"
- Dropdown UX: minimize vaates peab sektsiooni saama `maximize` teha kogu kasti ulatuses (mitte ainult noolele vajutades). `Minimize` jääb ainult noole nupu kaudu.
- Host-mänge ei teki: viga avaldub sõbraduelli HOST mängu loomisel.
- Telefonis, kui teha oma sõbraduelli HOST mäng, ei ole võimalik hosti vaates mängu avada (st “minna mängu sisse” / lahti märkida).
- Dark Theme nupp läheb vahepeal teiste nuppude peale (nt `Alusta` nupp mängu loomisel). Parandus: väldi overlap'i ja taga korrektne paigutus kõigis vaadetes.
- Nädala vahetusel peavad `1x` trenni võtmised automaatselt tagasi oma püsikohtadele minema (nt neljapäeval ei tohi eelmise nädala `1x` asendused jääda aktiivseks).
- SOLO sõbraduell peab pärast mängu salvestamist tekkima mõlema mängija profiili alla; hetkel see teisele osapoolele profiilis ei ilmu.

## ✅ Done (viimati tehtud)
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
