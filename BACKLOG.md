# Backlog (Test env, Feb 2026)

Legend: 🔴 Kriitiline, 🟡 Keskmine, 🟢 Low  
Staatus: ☐ Open, ⏳ In Progress, ✅ Done  
Reegel: arendus ainult TEST keskkonnas (test.putikunn.ee). Prod jääb puutumata.  

## 🔴 Kriitiline
1. ☐ Treeneri süsteem *päriselt tööle* (praegu ainult nupud)
   - Treeneril võib olla mitu gruppi, igal grupil püsiv PIN.
   - Kasutaja Home’is “Liitu trenniga” → sisestab PIN → lisatakse gruppi.
   - Kui kasutaja on grupis, Home tile näitab grupi nime (nt “Henari trenn – Reede”).
   - Treener näeb liikmeid ja saab eemaldada; liitumine on automaatne (no approval).
   - Admin/Superadmin näeb kõiki treeneri gruppe.
   - Vajalikud andmemudelid + permissions + UI flow.

2. ☐ Firestore read‑quota: päringud 100× liiga suured
   - Audit: mis lehed/polling/subscribe teevad kõige rohkem loendeid.
   - Vähem “live” query’d, rohkem cache (staleTime), limitid, batch, lazy‑load.
   - Eesmärk: drastiline read‑mahukuse langus (praegu 1 user → 100k+ reads).

## 🟡 Keskmine
3. ☐ Profiil: näita ainult SOLO mänge
   - Hostitud mängud on Manage Games all.
   - Erand: kui kasutaja osales hostitud mängus, siis see peab profiilis olema.
   - Host, kes ise ei osalenud, ei näe seda mängu profiilis.

4. ☐ Sõbraduell (SOLO): sisestus ei tohi sõltuda vastase sisestusest
   - Igaüks sisestab kohe (progress liigub kohe).
   - Undo lubatud mõlemale (ka siis kui vastane juba sisestas).

5. ☐ Rekordite tabel: ATW “Naised” filter ei tööta (naised ei ilmu)
   - Sugu peab filtreerima õigesti (N = naised, muidu üldtabel).

6. ☐ Max skoor “potentsiaalne” (tagasi, aga kiire lahendus)
   - Kuvada ilma performance‑lagita, ei tohi tekitada lisapäringuid.

7. ☐ My Profile: “Languse põhjus” tekst → pehmem sõnastus
   - Nt “Väljakutse kaugus” / “Raskem distants”.

## 🟢 Low
8. ☐ Putting Records: dublikaadid (sama mäng + sama kasutaja mitmes reas)
   - Dedup loogika / unique key.

## ✅ Done (viimati tehtud)
- DG.ee tab → Classic/Short alamvaade (segmented toggle).
- Dark mode (test‑only), IOS‑like Home/Host/Solo stiil.
- Treeneri projektorivaate UI (test‑only) – vajab nüüd päris andmeid.
- Streak “Lõpeta treening” nupp fix.
- ATW progressbar 3. segment värv.
- Mõned profiili/mängude kuvamise bugid (vajadusel re‑test).
