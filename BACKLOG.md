# Backlog (uus testitsükkel)

Legend: 🔴 Kriitiline, 🟡 Keskmine, 🟢 Low  
Staatus: ☐ Open, ⏳ In Progress, ✅ Done

## 🔴 Kriitiline
- ✅ Hostitud mäng ei tohi kaduda pärast esimese mängija lõpetamist; mäng peab jääma `Join Game` alla kuni host selle käsitsi sulgeb
- ☐ Putting Records / DG.ee import: kõik mängijad peavad tabelisse jõudma (praegu osad puuduvad)
- ☐ Soo loogika: kirjed ei tohi soo puudumise tõttu kaduda; kui sugu on `N`, märgi naiste arvestusse, muidu üldtabelisse
- ✅ Putting Records identiteet: ära kasuta display name’i; kasuta alati konto registreeritud nime (joinitud mängu hüüdnimi ei tohi rekordit lõhkuda)

## 🟡 Keskmine
- ✅ Lokaliseerimine: kogu rakendus 100% eesti keelde (ilma inglise segudeta)
- ✅ Terminid ühtseks: `Miss` -> `Mööda`, `Made/Make` -> `Sees`
- ✅ Märkimisnuppude UX: uue raami alguses reseti eelmine roheline valik (nupp tagasi neutraalseks)
- ☐ Putting Records paginatsioon: Classic näitab 16 kirjet ja järgmisele lehele ei saa
- ☐ Putting Records sünk: teistes tabelites puuduvad nimed (nt 4. veebr Back & Forth, 24 mängijat, tabelis vähem)
- ☐ DG.ee tab tühi (peab näitama hostitud Classic rekordid)
- ✅ Solo mängu tulemuste vaade: default tulemuste vaade peab olema tabel/host style (mitte “täpikesed” player view)
- ✅ Join Game: aktiivsete mängude list näitab ka suletud mänge (peab näitama ainult aktiivseid)
- ✅ Join Game mobiil: join-kaardi kõrgus/spacing liiga suur, nõuab scrolli (vajab kompaktsemat layouti)
- ✅ Mobiil skoorivaade (mitte-ATW): vähenda meetrite kasti ja “mummude” ploki suurust ~20%, vähenda valget ala
- ⏳ ATW/üldine nav bug: browseri back/Exit järel mäng läheb “segadusse” (state roll-back, punktid maha); mäng peab jätkuma kuni host sulgeb või solo user lõpetab
- ✅ Hostitud mäng: “Submit to Leaderboard” peab olema ainult host/adminile (tava kasutaja ei tohi enne hosti lõppu midagi raporteerida)
- ✅ Hostitud mängu lõppvaates tavakasutaja näeb “Submit to Leaderboard” nuppu (peita, ainult host/admin)
- ✅ ATW reset: Attempts loendur resetib igal restartil (peab näitama kogukatsete arvu)

## 🟢 Low
- ☐

## Märkmed
- Fookus: mitte-ATW mängud (ATW ei muuda, v.a kui eraldi kokku lepime).
