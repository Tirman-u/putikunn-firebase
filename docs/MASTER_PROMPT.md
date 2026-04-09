# Putikunn Master Prompt

Read this file before making changes, deployments, or release decisions in this repo.

## Core rules

- Treat the remote repository as the source of truth unless the user explicitly says a local-only version is newer.
- Do not assume the current local worktree is the right release base. Check branch, remote state, and worktree cleanliness first.
- If the main worktree is dirty, do release or deploy work from a clean clone or clean worktree.
- State clearly which branch, commit, and working copy you are using.

## Versioning

- Every deploy requires a version bump.
- This applies to both test and live deploys.
- Update both files every time:
  - `package.json`
  - `package-lock.json`
- Do not skip a version bump just because the change is "only UI" or "test only".

## Release flow

Default order unless the user explicitly asks otherwise:

1. Verify the correct base branch and latest remote commit.
2. Bump the version.
3. Run the relevant checks.
4. Build.
5. Deploy to test.
6. Verify the test URL.
7. Deploy to live.
8. Verify the live URL and the custom domains.

## Deploy communication

- Before deploying, say exactly which environment you are deploying to.
- If only test is being updated, say that live is not being touched.
- After deploying, report:
  - version
  - environment
  - working URLs
  - broken URLs
  - checks that were run

## Domain and hosting checks

For Putikunn, treat these as separate endpoints that must be checked individually:

- `https://putikunn.ee`
- `https://www.putikunn.ee`
- `https://test.putikunn.ee`
- `https://putikunn-migration.web.app`
- `https://putikunn-test.web.app`

If one of them fails, do not report the release as fully healthy.

When domain issues appear, check:

- DNS records
- Firebase Hosting custom domain state
- TLS certificate state
- HTTP vs HTTPS behavior
- apex vs `www`

If the problem is infra or DNS, state the exact broken record or hosting state instead of describing it vaguely.

## UI rules for mobile

- Primary actions must be easy to tap on a phone.
- Do not use tiny text links for primary actions.
- For mobile CTAs, target at least roughly 44px touch height.
- If the user says a button is too small, adjust the full interaction target:
  - height
  - padding
  - font size
  - layout

## Bug-fixing rules

- Fix the actual data-flow or state cause when possible, not only the visible crash.
- If root cause is still unclear, improve logging so the next failure is diagnosable.
- When fixing a production issue, always report:
  - root cause
  - files changed
  - whether old errors remain in history
  - whether the fix only takes effect after deploy

## Backlog rules

- If the user says "put it in backlog", write it into `BACKLOG.md`.
- Each backlog item should include:
  - symptom
  - impact
  - likely technical cause, if known

## Worktree hygiene

- Do not mix unrelated local changes into release work.
- Do not deploy from a dirty worktree unless the user explicitly wants that exact worktree.
- If you use a separate clone or worktree, tell the user where it is.

## Final answer requirements for deploys

Every deploy summary must say:

- what version was deployed
- whether test was updated
- whether live was updated
- which URLs respond correctly
- which URLs still fail
- whether the failure is app-level or infra-level
