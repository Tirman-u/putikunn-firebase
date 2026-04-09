# Incident Note - 2026-04-08

## Title

Hosted-game stability incident on April 8, 2026:

- white-screen / stale bundle failures on mobile
- classic hosted-game crash after score entry
- ATW host/player state drift

## Status

- Stabilized in production with `0.1.104`
- Follow-up ATW fixes are in test builds `0.1.105` to `0.1.107`

## Symptoms Seen

- Some phones opened `putikunn.ee` / `www.putikunn.ee` to a white screen after deploys and rollbacks.
- Sentry-style error screenshot showed `undefined is not an object (evaluating 's.players.map')`.
- Hosted classic game could crash after the second frame / second score entry.
- Hosted ATW could show different values on host and player devices for `Parim tulemus`, `Praegu` and `Katseid`.
- Firestore reads were heavier than needed in a couple of views during the same incident window.

## Main Root Causes

### 1. Missing hashed assets after rollback / redeploy

After emergency rollbacks and new deploys, some browsers still had an older cached `index.html` that pointed to an old hashed JS/CSS asset.

Because Hosting rewrites were too permissive, a missing asset request could fall through to `/index.html`.
That meant the browser requested JS, got HTML, refused to execute it, and the app stayed white.

### 2. Partial game documents were not handled defensively enough

Several views assumed `game.players` existed and was always an array.
On older or partially updated game docs that was not always true, which caused `.players.map(...)` crashes.

### 3. Hosted classic local state could lose player metadata

After score entry, local state could keep the score arrays but lose full player metadata.
The next render then hit UI paths that expected complete player info.

### 4. ATW metrics were not persisted consistently during active runs

ATW `best_score`, `best_laps` and `best_accuracy` were not always updated during the active run itself.
Some views also displayed `Katseid` directly from `attempts_count`, even though that field behaved more like "completed restarts before the active run" than the visible attempt number.

### 5. ATW local recovery could outrun Firestore

The player device could recover a newer local ATW state from local storage, but that recovered state was not automatically pushed back to Firestore.
Result: the player device could look newer than the host view, because the host only saw the server copy.

### 6. Firestore load hotspots made debugging harder

Two places were noisier than needed:

- active games query on join flow
- records polling loop

They were not the root cause of the crash, but they increased read pressure and confusion during the incident.

## Fixes Shipped

### Hosting / cache / recovery

- Missing `/assets/**` requests no longer rewrite to `/index.html`
- legacy bundle names are temporarily aliased so stale browsers still get real JS/CSS
- no-cache headers were tightened for HTML and sensitive assets
- legacy service workers are cleaned up
- reset page added for stuck browsers

### Data-shape hardening

- views no longer assume `game.players` is always present
- ATW / classic views fall back to safer derived player lists
- unknown / partial format values fall back more safely

### Classic hosted-game fixes

- score entry now preserves the wider game state instead of replacing it with a partial state
- leaderboard / result / host views guard against missing player arrays

### ATW fixes

- ATW active runs update best metrics continuously
- ATW player view listens to realtime updates
- ATW host / player / leaderboard views use shared metric helpers
- recovered local ATW state is re-synced to Firestore when it is ahead of the server

### Firestore read reductions

- active-games list on join flow was narrowed
- records page polling was reduced / removed where unnecessary

## What To Avoid Next Time

- Do not allow `/assets/**` misses to fall through to `/index.html`
- After any rollback, test both:
  - a fresh tab
  - an old already-open mobile tab
- Keep hosted-game score rendering on shared helpers, not copy-pasted calculations
- If local state recovery exists, it must also include a server re-sync path
- For emergency releases, update [docs/CHANGELOG.md](../CHANGELOG.md) immediately

## Practical Release Checklist

1. Bump version in `package.json` and `package-lock.json`
2. `npm run test:run`
3. `npm run lint`
4. `npm run build`
5. Deploy `test` first
6. Smoke-check:
   - fresh browser
   - previously open browser tab
   - hosted classic
   - hosted ATW
7. Only then deploy `prod`
8. Add release note entry and push git
