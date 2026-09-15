---
name: eitaa-miniapp-cloudflare
version: 1.1.0
description: Build, debug, and deploy Eitaa Mini Apps/web games as full-stack web applications on Cloudflare Pages with Pages Functions and Cloudflare D1 (SQLite). Use this skill whenever the task mentions Eitaa Mini Apps, Eitaa WebApp/JS SDK, eitaa-web-app.js, initData, start_param, MainButton/BackButton, Eitaa Web, or asks for an Eitaa game/web app with Cloudflare Pages/D1. It also governs UI implementation so the result is product-like and intentional rather than generic AI/vibe-coding.
license: MIT
---

# Eitaa Mini App + Cloudflare Pages/D1

Build the project as a real mobile-first web application that runs inside Eitaa and also degrades gracefully in a normal browser for development. This skill is intentionally opinionated: use only raw HTML, CSS, and JavaScript for the frontend so the result can be deployed directly as a static Cloudflare Pages site without a frontend framework or bundler.

## 0. Non-negotiable architecture

Use this default architecture:

- Frontend: raw HTML + CSS + JavaScript (Vanilla JS). Do not use React, Vue, Svelte, Angular, Next.js, Nuxt, Astro, Vite, Tailwind, Bootstrap, jQuery, or another frontend framework/library unless the user explicitly asks to break this rule.
- Eitaa integration: official Eitaa WebApp SDK loaded from `https://developer.eitaa.com/eitaa-web-app.js` in `<head>` before other scripts.
- Backend: Cloudflare Pages Functions under `/functions` for API/auth/server logic.
- Database: one Cloudflare D1 database using SQLite semantics, bound as `DB`.
- DB schema: versioned SQL migrations in `migrations/`.
- Deployment: Cloudflare Pages, preferably Git integration for automatic builds/previews.
- Local full-stack development: Wrangler + `wrangler pages dev`.

Cloudflare currently recommends Workers for new projects because it is the broader primary platform, but Pages remains a valid choice for this requested architecture. Do not silently migrate the project to Workers unless the user asks. See the official links in `references/official-docs.md`.

## 0.1 Non-negotiable language and direction

The entire user-facing interface must be Persian and right-to-left.

- Set the root HTML element to `lang="fa"` and `dir="rtl"`.
- Default page and component layout direction is RTL.
- All visible labels, buttons, menus, dialogs, onboarding, errors, empty states, loading states, score/status text, help text, and game copy must be written in natural Persian unless the user explicitly requests another language.
- Keep technical identifiers, API paths, JavaScript variable names, SQL identifiers, and code syntax in their normal machine-readable form; this rule is about the product's user-facing language, not renaming code symbols into Persian.
- Prefer Persian-friendly typography and test mixed Persian/Latin/numeric content carefully. Do not assume one font renders every Persian character correctly; choose a robust system/Persian-capable font stack and verify it on the target device.
- Use logical CSS properties such as `margin-inline`, `padding-inline`, `inset-inline`, `border-start-start-radius`, and `text-align: start` where practical instead of hard-coding left/right assumptions.
- Numerals may remain Latin where they are conventional for technical/game values, but ordinary prose should remain Persian. When a number is part of Persian copy, choose a consistent numeral policy for the whole product.
- Never ship placeholder English UI such as `Loading...`, `Submit`, `Settings`, `Error`, or `Coming soon`; translate it to appropriate Persian copy.
- Icons/arrows must be checked in RTL context. Do not blindly mirror symbols whose semantic direction should remain fixed.

## 0.2 Non-negotiable frontend technology

The frontend must be plain web platform code:

- HTML5 for structure.
- CSS3 for layout, responsive design, theming, animation, and safe-area handling.
- Modern browser JavaScript for behavior and Eitaa SDK integration.
- ES modules are allowed with `<script type="module">`.
- Web Components are allowed only when they make the code clearer; do not introduce a framework just to build components.
- Use `fetch()` for APIs and native Web APIs where possible.
- Keep the frontend dependency-free by default. Do not add npm frontend dependencies merely for convenience.
- Do not require a build step for the frontend. Cloudflare Pages should be able to serve the HTML/CSS/JS directly from the chosen output directory.
- Pages Functions may use JavaScript or TypeScript on the server side when useful, but client UI code remains raw HTML/CSS/JS.

Recommended minimal structure:

```text
.
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── base.css
│   │   ├── layout.css
│   │   └── game.css
│   ├── js/
│   │   ├── app.js
│   │   ├── eitaa.js
│   │   ├── api.js
│   │   └── game.js
│   └── assets/
├── functions/
│   └── api/
├── migrations/
├── wrangler.jsonc
└── README.md
```

For a static Pages deployment, set `pages_build_output_dir` to the directory containing the static site (for example `./public`). Avoid adding Vite/Webpack/Rollup solely because the project is a web game; the simplest deployment is preferred.

## 1. Eitaa SDK: load and initialize correctly

The official SDK docs are:

- https://developer.eitaa.com/docs/Develop/JsSDK/
- SDK script: https://developer.eitaa.com/eitaa-web-app.js

Load the SDK directly from Eitaa. Do **not** vendor, download, or copy `eitaa-web-app.js` into the repository; Eitaa explicitly recommends loading the official URL so clients receive compatibility/security updates.

Put this in the HTML `<head>` before application scripts:

```html
<script src="https://developer.eitaa.com/eitaa-web-app.js"></script>
```

The SDK exposes `window.Eitaa.WebApp`.

Create a small typed wrapper/service around `window.Eitaa.WebApp` rather than scattering SDK calls through components. The wrapper should:

1. detect whether the Eitaa bridge exists;
2. expose safe fallbacks for normal-browser development;
3. subscribe/unsubscribe SDK events in one place;
4. centralize theme/safe-area synchronization;
5. centralize MainButton/SecondaryButton/BackButton behavior;
6. never treat client-supplied identity as trusted authentication.

Call `Eitaa.WebApp.ready()` as soon as the essential UI is ready, and usually call `expand()` for a game-like full-height experience when appropriate. Do not assume `viewportHeight` is stable; use `viewportStableHeight` when positioning UI relative to the stable bottom edge.

## 2. Eitaa runtime values you should know

Common `Eitaa.WebApp` values:

- `initData`: raw signed initialization data. This is the server-verification input.
- `initDataUnsafe`: parsed convenience object. Treat it as untrusted client data.
- `version`, `platform`, `colorScheme`, `themeParams`.
- `isExpanded`, `isActive`, `isFullscreen`, `isOrientationLocked`.
- `safeAreaInset`, `contentSafeAreaInset`.
- `viewportHeight`, `viewportStableHeight`.
- `headerColor`, `backgroundColor`, `bottomBarColor`.
- `MainButton`, `SecondaryButton`, `BackButton`, `SettingsButton`.
- `HapticFeedback`, `Accelerometer`, `DeviceOrientation`, `Gyroscope` where supported.

Important security rule: never authorize a player, load private game state, award points, or accept a purchase/action merely because `initDataUnsafe.user` says who the user is. Verify `initData` on the server first, then use only the verified result.

Eitaa's user ID may exceed 32-bit integer range and can contain up to 52 significant bits. In JavaScript it is safe as a `number`, but storing it as a string is often the simplest cross-language/database choice.

## 2.1 Vanilla frontend conventions

Keep the browser side easy to deploy and easy to inspect.

### HTML

- Use semantic HTML elements: `main`, `section`, `nav`, `button`, `header`, `footer`, `dialog`, etc.
- Start with:

```html
<!doctype html>
<html lang="fa" dir="rtl">
```

- Keep content and structure explicit instead of generating the whole page from JavaScript.
- Use `button` for actions and real links for navigation.
- Give every interactive control an accessible Persian label.

### CSS

- Put global direction and typography rules in a base stylesheet.
- Prefer logical properties (`margin-inline`, `padding-block`, `inset-inline-start`, etc.) so RTL behavior is correct by construction.
- Keep responsive breakpoints based on actual layout needs, not device-brand assumptions.
- Use CSS custom properties for theme tokens, spacing, radii, and motion.
- Support light and dark Eitaa themes without duplicating the whole stylesheet.
- Respect `prefers-reduced-motion`.
- Never use layout hacks that only work because the interface happens to be left-to-right.

### JavaScript

- Organize code into small ES modules rather than one giant script.
- Keep Eitaa SDK integration in one module and game state in another.
- Use event listeners and state transitions instead of polling where an event exists.
- Avoid unnecessary dependencies, DOM re-render loops, and expensive work on every frame.
- Use `requestAnimationFrame()` only for genuinely frame-based gameplay/animation.
- Keep all user-facing strings in Persian constants or dedicated UI data so localization is not scattered through business logic.

### Example RTL shell

```html
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <script src="https://developer.eitaa.com/eitaa-web-app.js"></script>
    <link rel="stylesheet" href="/css/base.css">
  </head>
  <body>
    <main id="app" aria-label="بازی">
      <!-- محتوای فارسی بازی -->
    </main>
    <script type="module" src="/js/app.js"></script>
  </body>
</html>
```

Do not replace this with a framework bootstrap, hydration layer, client router, or generated component system unless the user explicitly changes the technology requirement.

## 3. Theme and safe-area integration

Mirror Eitaa's theme into CSS instead of inventing an unrelated app chrome.

Useful theme values include:

- `bg_color`
- `text_color`
- `hint_color`
- `link_color`
- `button_color`
- `button_text_color`
- `secondary_bg_color`
- `header_bg_color`
- `accent_text_color`
- `section_bg_color`
- `section_header_text_color`
- `section_separator_color`
- `subtitle_text_color`

The SDK also exposes theme CSS variables. Use them when appropriate, with project-level fallback variables for browser preview.

Safe areas are exposed through SDK data and CSS variables such as:

- `--tg-safe-area-inset-top`
- `--tg-safe-area-inset-bottom`
- `--tg-safe-area-inset-left`
- `--tg-safe-area-inset-right`
- `--tg-content-safe-area-inset-top`
- `--tg-content-safe-area-inset-bottom`
- `--tg-content-safe-area-inset-left`
- `--tg-content-safe-area-inset-right`
- `--tg-viewport-height`
- `--tg-viewport-stable-height`

Build bottom-anchored game controls with safe-area padding. Do not hard-code `env(safe-area-inset-bottom)` alone and assume it matches the Eitaa sheet; combine platform-safe CSS with the SDK's variables/fallbacks.

Listen to `themeChanged`, `viewportChanged`, `safeAreaChanged`, and `contentSafeAreaChanged` when the UI depends on those values.

## 4. Core Eitaa methods and events

Use these APIs as the first-choice integration layer instead of recreating Eitaa chrome in HTML:

### Navigation/window

- `ready()` — mark the Mini App ready.
- `expand()` — request maximum available height.
- `close()` — close the Mini App.
- `requestFullscreen()` / `exitFullscreen()` — fullscreen where supported.
- `lockOrientation()` / `unlockOrientation()` — Android-supported orientation control.
- `enableVerticalSwipes()` / `disableVerticalSwipes()` — control conflict between game swipes and Eitaa sheet gestures.
- `enableClosingConfirmation()` / `disableClosingConfirmation()` — warn before closing when meaningful unsaved progress exists.

Do not disable vertical swipes for a game unless the game's gesture mechanics genuinely conflict with Eitaa's sheet gestures.

### Links/dialogs

- `openLink(url, options)` — external browser/navigation behavior.
- `openEitaaLink(url)` — open an Eitaa link inside Eitaa.
- `showPopup(params, callback)` — native Eitaa popup.
- `showAlert(message, callback)`.
- `showConfirm(message, callback)`.
- `showScanQrPopup(params, callback)` / `closeScanQrPopup()` where supported.
- `requestWriteAccess(callback)` where the product needs to message the user.
- `requestContact(callback)` only when the product genuinely needs the contact number.
- `downloadFile(params)` on supported clients.

Keep browser fallbacks for APIs unavailable outside Eitaa.

### Buttons

`MainButton` and `SecondaryButton` are native bottom UI controls. Use them when an action belongs in Eitaa's bottom action area; do not duplicate the same action with a visually competing HTML sticky button.

Supported operations include:

- `setParams(...)`
- `show()` / `hide()`
- `enable()` / `disable()`
- `showProgress(leaveActive)` / `hideProgress()`
- `onClick()` / `offClick()`

`BackButton` supports `show()`, `hide()`, `onClick()`, and `offClick()`.

Use `BackButton` for nested game screens/settings/overlays. On the root screen it usually remains hidden.

### Haptics

Use `HapticFeedback` sparingly and semantically:

- `impactOccurred('light'|'medium'|'heavy'|'rigid'|'soft')`
- `notificationOccurred('error'|'success'|'warning')`
- `selectionChanged()` only when a selection actually changes.

Haptics should reinforce game feedback, not fire on every animation or button hover.

### Device sensors

For supported games:

- Accelerometer: `start({ refresh_rate })`, `stop()`; `refresh_rate` is documented between 20–1000 ms, default 1000 ms.
- DeviceOrientation: `start({ refresh_rate, need_absolute })`, `stop()`.
- Gyroscope: `start({ refresh_rate })`, `stop()`.

Always provide a non-sensor control path unless the whole game concept truly requires the sensor. Handle unsupported/denied sensor access gracefully.

Relevant events include `mainButtonClicked`, `backButtonClicked`, `settingsButtonClicked`, `popupClosed`, `qrTextReceived`, `scanQrPopupClosed`, `writeAccessRequested`, `contactRequested`, plus lifecycle/theme/viewport events.

## 5. Eitaa `initData` authentication — server only

Treat this as a security boundary.

At page startup, the client may send the raw `Eitaa.WebApp.initData` to an API endpoint such as `/api/session` using a POST body or equivalent request transport. The server verifies it before creating/loading the application session.

Eitaa's documented hash verification flow is:

1. Parse the query string from `initData`.
2. Extract and retain `hash`.
3. Build the remaining `key=value` pairs.
4. Sort them alphabetically by key.
5. Join them with `\n` to create the data-check string.
6. Compute HMAC-SHA256 over the app token using the literal key `WebAppData`.
7. Use that HMAC result as the key for a second HMAC-SHA256 over the data-check string.
8. Compare the resulting lowercase hex digest with the received `hash`.

Never put the bot/app token in frontend code, never verify `initData` only in the browser, and never persist a raw `initData` value as a long-lived credential unless there is a specific security reason.

The Cloudflare Functions implementation should use Web Crypto (`crypto.subtle`) rather than relying on Node-only crypto APIs, so it is naturally compatible with the Workers runtime.

A robust verification helper should also:

- reject malformed query strings;
- reject missing `hash`;
- enforce a reasonable freshness window using `auth_date` (for example, a short configurable window appropriate to the game);
- compare hashes without early-exit string comparison where practical;
- avoid logging tokens, raw initData, or personal user data;
- return a generic authentication error to the client.

Eitaa also documents a separate server-side `/api/app/verify` service for checking a received hash. Use it only when that documented server-to-server validation flow is specifically needed; local cryptographic validation remains the core path for ordinary Mini App authentication.

Official auth docs:
- https://developer.eitaa.com/docs/Develop/AuthorizationViaHash/
- https://developer.eitaa.com/docs/Develop/ValidateHash/

## 6. `start_param` / deep-link game state

Eitaa's Mini App flow supports `start_param`.

Example:

```text
https://eitaa.com/app/miniapp?startapp=level-42
```

Client-side access:

```ts
const startParam = window.Eitaa?.WebApp?.initDataUnsafe?.start_param;
```

A GET parameter named `tgWebAppStartParam` may also be available.

Treat start parameters as untrusted input. Validate allowed formats/IDs on the server. Do not encode secrets into them. Use them for things like referral IDs, room IDs, invite codes, or initial game mode selection.

Official doc:
- https://developer.eitaa.com/docs/Develop/SendData/

## 7. Eitaa Web iframe compatibility

Eitaa Web loads apps in an `<iframe>`. Therefore the deployed app must not send restrictive framing headers that prevent Eitaa from embedding it.

In particular, do not add:

```text
X-Frame-Options: sameorigin
Content-Security-Policy: frame-ancestors self
```

without verifying that the resulting policy permits the actual Eitaa embedding environment. Eitaa's official docs explicitly call these headers problematic for its web iframe experience.

Be careful with CSP: the SDK is a remote script from `developer.eitaa.com`, so a CSP that only allows `script-src 'self'` will break the SDK unless that origin is permitted.

Official doc:
- https://developer.eitaa.com/docs/Develop/DisplayOnWeb/

## 8. Cloudflare Pages architecture

Pages serves the built frontend and can run server-side code through Pages Functions. A `functions/` directory at the project root provides file-based routing.

Recommended structure:

```text
.
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── base.css
│   │   ├── layout.css
│   │   └── game.css
│   ├── js/
│   │   ├── app.js
│   │   ├── eitaa.js
│   │   ├── api.js
│   │   └── game.js
│   └── assets/
├── functions/
│   ├── api/
│   │   ├── session.js
│   │   ├── game.js
│   │   └── leaderboard.js
│   └── _middleware.js          # only if middleware is actually needed
├── migrations/
│   └── 0001_initial.sql
├── wrangler.jsonc
└── README.md
```

Pages file-based routes map from the `functions/` path. For example:

- `functions/api/session.ts` → `/api/session`
- `functions/api/game.ts` → `/api/game`
- `functions/index.ts` → `/`

Avoid putting `/functions` inside `dist/` source structure unless the existing framework specifically requires that integration.

For complex custom Worker routing, Pages also supports Advanced Mode via `_worker.js`, but do not choose it by default; standard `/functions` routing is clearer for a small game backend.

## 9. Cloudflare D1 = SQLite database

D1 is Cloudflare's managed serverless database built around SQLite semantics. Access it through a D1 binding from Pages Functions.

Use a binding named `DB`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "eitaa-miniapp",
  "pages_build_output_dir": "./dist",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "eitaa-miniapp-db",
      "database_id": "<DATABASE_ID>"
    }
  ]
}
```

Function access:

```ts
interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async ({ env }) => {
  const row = await env.DB
    .prepare('SELECT id, score FROM players WHERE id = ?')
    .bind('player-id')
    .first();

  return Response.json(row);
};
```

Prefer prepared statements and bound parameters. Never interpolate user input into SQL strings.

Use D1 batch operations when several statements form one logical unit. Keep transactions/query counts small because D1 is SQLite-like and each individual database is processed serially.

Create indexes for frequently filtered/joined columns such as `eitaa_user_id`, room IDs, timestamps, and leaderboard ordering keys when justified by actual queries.

Do not assume PostgreSQL/MySQL behavior. Design the schema and SQL for SQLite/D1 first.

## 10. D1 migrations

Keep all schema changes in numbered SQL migration files:

```text
migrations/
├── 0001_initial.sql
├── 0002_add_rooms.sql
└── 0003_add_leaderboard_index.sql
```

Typical workflow:

```bash
npx wrangler d1 create eitaa-miniapp-db
npx wrangler d1 migrations create eitaa-miniapp-db initial
npx wrangler d1 migrations apply eitaa-miniapp-db --local
npx wrangler d1 migrations apply eitaa-miniapp-db --remote
```

Use the actual database name consistently for production migration commands where practical. Review generated SQL before applying it.

Never make ad-hoc production schema edits that are not represented by a migration.

## 11. Local development

Install Wrangler as a dev dependency where appropriate:

```bash
npm install -D wrangler
```

Build the frontend, then run Pages locally:

```bash
npx wrangler pages dev public
```

With a Wrangler config containing a D1 binding, local development can use the bound local D1 state. You can also pass a binding explicitly:

```bash
npx wrangler pages dev dist --d1 DB=<DATABASE_ID>
```

Local D1 state is local-only by default. Do not accidentally point development code at production data.

For browser-only development outside Eitaa, expose a development mode in the Eitaa wrapper and use a mock user/session. Never weaken production authentication to make local development convenient.

## 12. Pages deployment

Preferred setup for this project:

1. Push the repo to GitHub or GitLab.
2. In Cloudflare Dashboard → Workers & Pages → Create application → Pages → Import an existing Git repository.
3. Leave the build command empty when the project contains only static HTML/CSS/JS and Pages Functions.
4. Set the build output directory to the static site directory, normally `public` for this skill.
5. Configure the D1 binding in the Pages project's Settings → Bindings.
6. Configure production/preview variables and secrets separately.
7. Deploy and test the generated `*.pages.dev` preview/production URL inside Eitaa.

Pages Git integration automatically rebuilds/deploys on pushes and supports preview deployments for pull requests.

Direct dashboard upload is not suitable when Pages Functions are required; use Git integration or Wrangler instead. Because this skill intentionally avoids a frontend build step, the static frontend should be directly servable from the Pages output directory.

## 13. Environment variables and secrets

Use `context.env` inside Functions.

Keep secrets such as the Eitaa app/bot token server-side only.

Prefer Cloudflare dashboard variables/secrets for deployed environments. Do not commit production tokens into `wrangler.jsonc`, source code, `.env` files, or client bundles.

Have separate preview and production values where the game needs isolated databases or credentials.

## 14. API/session design for a game

A simple recommended flow:

```text
Eitaa client
   │
   │ initData
   ▼
POST /api/session
   │
   │ verify HMAC server-side
   │
   ├── upsert player in D1
   └── return minimal verified player/session data

Game client
   │
   ├── POST /api/game/start
   ├── POST /api/game/finish
   └── GET  /api/leaderboard
           │
           ▼
         D1
```

For score-based games, assume the browser is hostile. Never accept `score=999999` as authoritative merely because the client sent it.

Prefer one of these models:

- Server-authoritative game state for competitive games.
- Server-validated event/result submissions with strict constraints for lighter games.
- Cosmetic/client-only state for non-competitive features.

For a leaderboard, validate score bounds, game version, session ownership, replay/event constraints if applicable, and timing sanity. Store server timestamps rather than trusting a browser clock.

## 15. Database model recommendations

A common starting schema:

```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eitaa_user_id TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  best_score INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX players_best_score_idx ON players(best_score DESC);
```

Do not blindly copy this schema into every game. Add tables for matches, rooms, attempts, inventories, achievements, etc. based on actual game rules.

Use integers for timestamps (Unix seconds/milliseconds) consistently. Document the chosen unit.

## 16. UI direction: no generic "AI/vibe coding"

Use the existing project's visual system when one exists. Otherwise choose a specific art direction based on the game itself before coding.

The recommended companion reference is Anthropic's `frontend-design` skill:
- https://github.com/anthropics/skills/tree/main/skills/frontend-design

Apply these principles:

- Design from the game's identity, audience, and interaction model—not from a generic dashboard template.
- Avoid default Tailwind-looking cards everywhere, huge gradient blobs, gratuitous glassmorphism, excessive pill buttons, generic Inter/Arial stacks, and "AI landing page" hero layouts.
- Make typography, spacing, iconography, color, and motion a coherent system.
- Prefer one memorable visual idea over ten random effects.
- Use real game states and meaningful content in the UI.
- Make interactive elements look interactive without relying on hover alone; touch is primary in Eitaa.
- Use motion to explain state changes: score gained, countdown, modal open/close, turn change, selection, success/failure.
- Respect `prefers-reduced-motion`.
- Keep effects cheap enough for mid-range Android phones.
- Test the actual rendered UI in an Eitaa-like narrow viewport, not only desktop.

### Persian/RTL visual rules

- The visual hierarchy, spacing, alignment, controls, modals, scoreboards, and navigation must be designed for RTL first, not translated from an LTR mockup afterward.
- Test long Persian labels, short labels, mixed Persian/English usernames, numbers, dates, and symbols.
- Keep game HUD values visually stable when the number of digits changes.
- For scoreboards and rankings, make the rank number, player identity, and score hierarchy clear in RTL.
- Avoid using CSS `direction: ltr` as a blanket fix. Apply LTR only to genuinely directional data such as URLs, code, or technical identifiers.

### Eitaa-specific visual rules

- Treat the Eitaa sheet/header as part of the product context.
- Use Eitaa theme variables when they improve integration.
- Do not build a fake Telegram-like/Eitaa-like top bar merely for decoration.
- Keep critical controls away from safe-area edges.
- Use `MainButton` for a truly primary bottom action where it improves native integration.
- Use `BackButton` for navigation rather than adding a giant duplicated back arrow.
- Make the game usable with one hand where practical.
- Avoid tiny tap targets; target comfortable touch sizes.
- Never make the game depend on color alone for state.

## 17. Accessibility and performance gates

Before considering the UI done:

- keyboard navigation works where browser users can access it;
- focus states are visible;
- buttons have accessible names;
- contrast is readable in both light and dark themes;
- touch targets are appropriately sized;
- loading, empty, error, success, disabled, and offline/degraded states exist;
- `prefers-reduced-motion` is respected;
- images are optimized;
- avoid unnecessary client libraries and huge bundles;
- avoid continuous high-frequency sensor work unless gameplay requires it;
- measure before adding animation, particle systems, blur, or WebGL-heavy effects.

## 18. Security checklist

Treat the following as release blockers:

- no Eitaa token in client code;
- no trust in `initDataUnsafe` for authorization;
- server validates `initData`;
- API endpoints authorize against the verified player/session;
- SQL uses prepared statements/bound parameters;
- client input is validated on the server;
- score/reward logic is server-authoritative where competitive;
- secrets are stored as Cloudflare secrets/variables, not git;
- logs do not expose initData/tokens unnecessarily;
- framing/CSP headers do not accidentally break Eitaa Web embedding;
- preview and production resources are not mixed accidentally.

## 19. Testing workflow

At minimum test:

1. Normal browser development mode.
2. Eitaa Android/Web client.
3. Light and dark Eitaa themes.
4. Small phone viewport and expanded viewport.
5. Back button/navigation states.
6. MainButton loading/disabled/success states.
7. Slow network and API failure.
8. Fresh/expired/invalid `initData`.
9. Direct API requests with forged player IDs.
10. Leaderboard/score tampering attempts.
11. D1 local migrations from an empty database.
12. Production/preview environment separation.

For production-like verification, inspect the final rendered UI, not just source code.

## 20. Implementation order

When starting a new project, work in this order unless the existing repo dictates otherwise:

1. Inspect the repository and enforce the raw HTML/CSS/JS + Persian RTL requirements.
2. Define the game loop, player identity flow, and persistence requirements.
3. Install/configure the official Eitaa SDK wrapper.
4. Add Cloudflare Pages/Functions structure and Wrangler config.
5. Create D1 schema + migrations.
6. Implement server-side `initData` verification.
7. Implement minimal `/api/session` and verified player lookup.
8. Implement gameplay APIs and server validation.
9. Build the actual game UI with the chosen art direction.
10. Integrate Eitaa theme, viewport, safe area, native buttons, haptics, and sensors only where useful.
11. Test in browser and Eitaa.
12. Deploy to Pages and test the deployed URL inside Eitaa.

Do not over-engineer the stack before the gameplay loop works. In particular, do not introduce a frontend framework or bundler unless the user explicitly asks for it.

## 21. Useful official references

See `references/official-docs.md` for the curated documentation map. Prefer the official Eitaa and Cloudflare docs over blog posts or old snippets because both platforms change their APIs/configuration.
