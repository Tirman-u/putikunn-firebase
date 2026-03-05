# Figma Missing Tasks (Pixel-Perfect UI, Functionality Preserved)

Status: required before full 1:1 implementation across all routes.
Rule: no flow/logic changes, UI only.

## Global Tasks

1. `DS-001` Brand tokens
- Need: final brand pack for `Wisedisc` (logo lockups, app icon, favicon, splash, mark spacing rules).
- Need: typography scale (font family, sizes, weights, line-height, letter-spacing).
- Need: color tokens for light and dark (semantic + raw palette + elevation/surface layers).

2. `DS-002` Component states
- Need: exact variants and states for:
`Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Tabs`, `Badge`, `Card`, `Table`, `Dialog`, `Toast`, `BottomNav`.
- For each: `default`, `hover`, `focus`, `active`, `disabled`, `error`, `loading`.

3. `DS-003` Layout system
- Need: spacing scale, container widths, grid spec, breakpoints, safe-area behavior (iOS), shadow/elevation spec.
- Need: dark mode rules per component (currently strict `#000` background policy is applied).

4. `DS-004` Icons + illustrations
- Need: authoritative icon set and stroke/size rules.
- Need: per-route icon mapping so old Lucide fallbacks can be replaced 1:1 where required.

## Route-Level Tasks (Missing Screen Designs)

5. `PG-001` Home
- Need Figma frames: `Home Desktop`, `Home Mobile`, `Home Tablet` (if used).
- Need states: role-based variants (`user`, `trainer`, `admin`, `super_admin`), empty/loading/error.

6. `PG-002` Login
- Need frames: `Login Desktop`, `Login Mobile`.
- Need states: email/password error, SSO loading, forgot password.

7. `PG-003` Profile
- Need frames: `Profile View`, `Profile Edit`, `Profile Empty`, `Profile Loading`, desktop+mobile.
- Need sections: stats cards, history tables, duel history blocks, filters/pagination.

8. `PG-004` Manage Games
- Need frames: list view, grouped view, dialogs/modals, table on desktop + cards on mobile.
- Need states: no active games, no completed games, selection mode, bulk action.

9. `PG-005` Trainer
- Routes: `TrainerGroups`, `TrainerGroupDashboard`, `TrainerProjector`, `GroupProjector`.
- Need: all desktop/mobile variants + roster assignment/waitlist/announcements states.

10. `PG-006` Training
- Routes: `JoinTraining`, `TrainingLeague`, `TrainingSeason`, `TrainingSession`.
- Need: slot cards, attendance states, free-spot announce flow states.

11. `PG-007` Duel
- Routes: `DuelHost`, `DuelHostControl`, `DuelJoin`, `DuelSolo`, `DuelReport`, previews.
- Need: lobby/ready/in-game/post-game states in desktop+mobile.

12. `PG-008` Game Result + Group Result
- Need: single game result, grouped result, export/share controls, leaderboard sections.
- Need: loading/empty/error/data states.

13. `PG-009` Putting Components (UI wrappers)
- Routes/components: `HostSetup`, `JoinGame`, `HostView`, `PlayerView`, `AroundTheWorld*`, `TimeLadder*`.
- Need per-mode screens with exact hierarchy and spacing.

14. `PG-010` Admin Users
- Need full tab specs (`overview`, `users`, `system`) for desktop+mobile.
- Need states for each system card and list row actions.

15. `PG-011` Putting King (if feature flag ON)
- Routes: `PuttingKing`, `PuttingKingSetup`, `PuttingKingOverview`, `PuttingKingScoring`.
- Need full screen specs and states for tournament cards and scoring flows.

## Interaction Spec Tasks

16. `IX-001` CTA mapping
- Need table: every visible button/link with destination/behavior.
- Format: `Route > Element Label > Action > Expected Result`.

17. `IX-002` Responsive behavior
- Need explicit mobile behavior per route: sticky bars, scroll areas, collapses, tab behavior.

18. `IX-003` Motion
- Need timing/easing for route transitions, card enters, modal transitions, toasts.

## Delivery Format Needed From Figma

19. `FD-001` Node links
- For each task above, provide direct node links:
`https://www.figma.com/design/<fileKey>/<fileName>?node-id=<id>`

20. `FD-002` Naming standard
- Use frame names as:
`<Route>-<Breakpoint>-<Theme>-<State>`
- Example: `Home-Mobile-Dark-Data`.

