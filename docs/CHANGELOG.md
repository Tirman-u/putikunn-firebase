# Release Log

This file is the lightweight release history for Putikunn.

## Rules

- Bump `package.json` and `package-lock.json` on every deployable build.
- Add one short entry here for every released or test-only build.
- Mark clearly where the build went: `test`, `prod`, or `test + prod`.
- If the build is part of an incident or rollback chain, link the incident note.
- Version numbers may skip when an emergency build was rolled back or never kept.

## 0.1.107 - 2026-04-08 - test

- Unified ATW hosted-game display logic for `Parim tulemus` and `Katseid` across host, player and leaderboard views.
- Added recovery sync so a newer local ATW state is pushed back to Firestore when the device reopens the game.
- Added persistent repo notes for release history and incidents.
- Related incident: [2026-04-08 stability + ATW incident](./incidents/2026-04-08-stability-and-atw.md)

## 0.1.106 - 2026-04-08 - test

- Added realtime ATW sync in player view so host and player do not drift apart during hosted ATW games.
- Related incident: [2026-04-08 stability + ATW incident](./incidents/2026-04-08-stability-and-atw.md)

## 0.1.105 - 2026-04-08 - test

- ATW active game updates now keep `best_score`, `best_laps` and `best_accuracy` in sync during the run, not only on retry/exit/complete.
- Related incident: [2026-04-08 stability + ATW incident](./incidents/2026-04-08-stability-and-atw.md)

## 0.1.104 - 2026-04-08 - test + prod

- Added legacy service-worker cleanup and reset flow to reduce white-screen issues on stale mobile browsers.
- Hardened hosting responses for worker files.
- Related incident: [2026-04-08 stability + ATW incident](./incidents/2026-04-08-stability-and-atw.md)

## 0.1.102 - 2026-04-08 - test + prod

- Fixed broken Firebase config fallback in the production bundle.
- Hardened legacy asset aliasing so old cached bundle names still resolve to real JS.
- Related incident: [2026-04-08 stability + ATW incident](./incidents/2026-04-08-stability-and-atw.md)

## 0.1.101 - 2026-04-08 - test + prod

- Fixed hosted classic state loss after score entry so leaderboard/player metadata stays intact.
- Prevented `/assets/**` misses from being served as HTML.
- Related incident: [2026-04-08 stability + ATW incident](./incidents/2026-04-08-stability-and-atw.md)

## 0.1.100 - 2026-04-08 - test + prod

- Fixed hosted classic crash after the second score entry.
- Tightened hosting cache headers to reduce stale-bundle issues on phones.
- Related incident: [2026-04-08 stability + ATW incident](./incidents/2026-04-08-stability-and-atw.md)

## 0.1.97 - 2026-04-08 - test + prod

- Initial emergency stabilization release for April 8 incident window.
- Added broader guard rails around missing `players` / partial game data and improved client-side error reporting.
- Related incident: [2026-04-08 stability + ATW incident](./incidents/2026-04-08-stability-and-atw.md)
