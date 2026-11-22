# AgriFlow AI: testing report

Date: 22 November 2026 · Branch: `feat/mobile-api` · All results come from GitHub Actions runs, whose logs are
published as releases. Nothing here was run "by hand" and then written down.

## Backend and website ([`ci-latest`](https://github.com/dev-lusale/Agriflow-AI/releases/tag/ci-latest))

| Check | Result |
|---|---|
| Migrations match the Prisma schema (drift check against a shadow database) | Pass |
| TypeScript typecheck · ESLint | Pass · Pass |
| Vitest unit + integration tests on PostgreSQL 16 | **89 / 89 pass** (10 files) |
| Migrate + seed a fresh database | Pass |
| Production build (Next.js 16) | Pass |
| Playwright end-to-end (website) | 8 pass, 6 skipped (need Grok / live keys) |

The mobile API tests (`tests/integration/mobile-api.test.ts`) cover:
- registration with the 6-digit e-mail code, plus validation and duplicate accounts;
- login, refresh-token rotation, and reuse detection that ends the whole session family;
- logout, including that access tokens stop working immediately;
- tampered tokens and the password reset flow;
- social sign-in status reported honestly;
- role checks, and that one user can never read another user's data;
- the expert second-opinion flow and distributor permissions;
- 404/405 handling and the AI-not-configured reply.

## Production deployment

| Check | Result |
|---|---|
| Deployment `dpl_5hCvbuCyBeg7wijDRAU8jbAziPv7` built with the additive migration and promoted to https://agriflow-ai-wheat.vercel.app | Ready |
| `GET /api/v1/health` | `{"ok":true,"api":"v1"}` |
| `GET /api/v1/auth/config` | Social providers `false`, e-mail `not_configured`, 6 account types |
| Runtime errors in the hour after deploy | None |
| Live wrong-password login from the app on both emulators | Server answered "Incorrect email or password" |

## Flutter Android app ([`flutter-latest`](https://github.com/dev-lusale/Agriflow-AI/releases/tag/flutter-latest))

| Check | Result |
|---|---|
| `flutter analyze` | No issues found |
| Unit + widget tests | **23 / 23 pass** |
| Debug APK | Built |
| Release APK and AAB | Built. **Unsigned**: no signing key in GitHub Secrets yet |

The unit and widget tests cover:
- the auth redirect rules and roles;
- validation, using the same rules as the server;
- API error parsing and offline detection;
- kwacha formatting;
- token refresh: one refresh for parallel requests, a network failure never signs the user out, a rejected refresh ends the session, and login never triggers a refresh;
- the login screen at 320, 390 and 480 dp with no overflow;
- validation and double-tap protection;
- honest social buttons;
- the registration rules.

### Emulator walk-through (installed APK, real taps)

| Step | Pixel 6 · Android 14 | Nexus 4 · Android 11 (small) |
|---|---|---|
| Installs, launches, no crash, no Flutter errors | Pass | Pass |
| Welcome screen and logo accessibility label | Pass | Pass |
| Login screen matches the reference (all fields, social buttons, sign-up) | Pass | Pass |
| Empty login shows field errors | Pass | Pass |
| Google button says sign-in "is not set up yet" | See note | Pass |
| Wrong password against the **live** API | Pass | Pass |
| Register screen: fields, provinces from the live API, Expert and Distributor account types | Pass | Pass |
| Launch with no network: app stays open | Pass | Pass |

Note: on the Pixel 6 the message was on screen (see `pixel6-04-social.png`) but disappeared before the slower
emulator finished reading the screen. The check now reads the screen first. See the latest release for its result.

## Bugs found by testing and fixed

- A wrong return type in the "My listings" menu stopped the app from compiling.
- "Don't have an account? Sign up" and "Already have an account? Log in" overflowed on narrow phones. They now wrap.
- Buttons announced their label twice to screen readers ("Log In, Log In").
- The release build failed because Android's linter needs Java 21; CI now uses Java 21.

## Not tested, because not configured

- Grok answers and photo checks: `XAI_API_KEY` is missing in Vercel.
- E-mailed codes: `RESEND_API_KEY` is not set. Codes are created, and the API reports `not_configured`.
- Push notifications: no Firebase project.
- Social sign-in: no OAuth client IDs.
- Play Store signing: no keystore secrets.
- Screens behind login on a real device: there are no demo accounts in production.
