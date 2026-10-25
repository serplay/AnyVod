# Mobile plan

How AnyVod gets onto phones: what is done, what to build next, and what to avoid.

## The constraint that decides most of this

Playback is a third-party iframe (the vidsrc embed). We don't control the video element, its controls, its fullscreen button, or its ads and pop-ups. Any mobile approach still ends in a web view showing that iframe. A native rewrite would not give us a native player.

**App stores.** The Apple App Store and Google Play both remove apps that stream content the publisher hasn't licensed (Apple guideline 5.2, Google Play's intellectual property policy). A store listing is very likely to be rejected or taken down later, so don't make a store build the critical path. That leaves two channels:

1. **The mobile web, installable as a PWA.** Works on iOS and Android with no review and ships with every deploy.
2. **An optional Android APK for sideloading**, built with Capacitor around the same frontend. It is worth doing only for the native control described in phase 3.

## Options considered

| Option | Code reuse | Player | Distribution | Verdict |
|---|---|---|---|---|
| Responsive web + PWA | 100% | Same iframe | URL, "Add to Home Screen" | **Do first** |
| Capacitor (wraps the existing app) | ~95% | Same iframe, plus native control over navigation and orientation | APK sideload (stores unlikely) | **Optional, Android** |
| React Native / Expo | UI rewritten; data layer partly reusable | WebView with the same iframe | Same store problem | No: a rewrite that gains nothing for playback |
| Fully native (Swift/Kotlin) | 0% | Same iframe in a WKWebView/WebView | Same store problem | No |

## Phase 1: mobile web (in progress)

**Done (player rework):**
- One responsive player. The old version rendered separate desktop and mobile episode lists and hid one of them with CSS.
- The site header and footer are no longer rendered on `/player/*`. Before, the player was a fixed overlay over them, and they stayed focusable underneath.
- `100dvh` sizing, so the browser address bar no longer cuts off the bottom of the player.
- Portrait phones: the video and the prev/next bar stick to the top while the episode list scrolls under them. Opening the player no longer scrolls the page away from the video (the old `scrollIntoView` did).
- Landscape phones: the video fills the screen height.
- Native `<select>` for seasons, which opens the OS picker. Choosing a season only browses it and doesn't interrupt playback.
- 44px touch targets on prev/next, 16px inputs (no iOS zoom on focus), and safe-area insets.
- Resume: `/player/tv/:id` opens the last episode played (stored in localStorage).

**Still to do:**
- [ ] Audit the other pages (Home, details, search, person) at 360–430px wide: tap target sizes, horizontal overflow, hero image weight.
- [ ] Search filters: move them into a bottom sheet on phones.
- [ ] Add a "Continue watching" row on Home and a "Resume S2·E5" label on the details page's play button, using `loadLastEpisode` from `src/lib/episodes.ts`.
- [ ] **Landscape fullscreen on Android.** Add our own fullscreen button that calls `requestFullscreen()` on `.player-stage` and then `screen.orientation.lock('landscape')`. This works on Android Chrome. iPhone Safari only supports fullscreen for `<video>` elements, so iPhone users keep the embed's own fullscreen button. Show the button only when `document.fullscreenEnabled` is true.
- [ ] Media Session metadata (title and artwork on the lock screen): not possible, because the media element lives inside the cross-origin iframe. Listed here so nobody spends time on it.

## Phase 2: PWA (about 1–2 days)

- `public/manifest.webmanifest`:
  - `display: standalone`, `background_color` / `theme_color` `#0b0c0e`
  - `start_url: /`, `scope: /`
  - 192px and 512px icons plus a maskable icon, generated from the flat mark in `public/favicon.svg` (`apple-touch-icon.png` already exists)
- Link the manifest from `index.html` and add an `apple-touch-icon`. The `apple-mobile-web-app-*` meta tags are already there.
- Service worker (`vite-plugin-pwa`, `generateSW`):
  - Precache the app shell only.
  - API calls use network-first with a short cache, so the app opens offline and shows the existing error states.
  - Never cache the embed host.
- Install prompt: capture `beforeinstallprompt` on Android and show a small "Install app" button. iOS has no such event, so show a one-time "Share → Add to Home Screen" hint there.
- Headers: nginx's CSP already allows same-origin workers and manifests through `default-src 'self'`. On Vercel, check that `sw.js` is served with `Cache-Control: no-cache`.
- Standalone mode has no browser back button, so the player's Back button must always work. It does: it falls back to the details page when there's no in-app history.

## Phase 3: Android shell with Capacitor (optional, about 3–5 days)

Do this only if the PWA isn't enough. What it adds over the PWA:

- **Blocking pop-ups and redirects** from the embed. Intercept navigations in the WebView and allow only our origin, the embed host, and TMDB images. This is the biggest practical win, and the web can't do it: the `sandbox` attribute without `allow-popups` would block pop-ups too, but most embed hosts detect the sandbox and refuse to play. That is still worth a quick test on the web.
- **Orientation lock** with `@capacitor/screen-orientation` when the embed goes fullscreen. Wire `WebChromeClient.onShowCustomView` for iframe fullscreen, and check that Capacitor's bridge client handles it.
- **A home-screen app without the "Add to Home Screen" step.**

Setup:

- Add `frontend/capacitor.config.ts` and bundle `dist/` into the app (`server.url` would load the live site, which is simpler but makes the app depend on the hosted frontend).
- `VITE_API_BASE` must be absolute in the app build (`https://vapi.losingsanity.com`).
- Backend CORS: allow `https://localhost` (Capacitor's Android origin) through `FRONTEND_ORIGIN`.
- Routing: `BrowserRouter` works when the app is bundled, because Capacitor serves `index.html` for unknown paths.
- Build the APK in GitHub Actions (`gradle assembleRelease`, signed with a secret keystore) and attach it to a GitHub Release. Builds stay manual, matching the backend image (no auto-build on push).
- iOS: same codebase, but there's no realistic distribution route (TestFlight is also reviewed). Skip it.

## Testing

- Unit and component tests run in CI as they do now. The player's layout logic (sticky video, landscape) is CSS, so cover it with screenshots rather than jsdom.
- Add a Playwright screenshot job with 390×844, 844×390 and 1440×900 viewports for `/player/tv/…` and `/player/movie/…`, with API responses stubbed through `page.route`. These are the same checks used to verify the player rework.
- Before each release, check by hand on real devices:
  - iPhone Safari: portrait and landscape, rotating while playing, embed fullscreen, installed PWA.
  - Android Chrome: the same, plus the fullscreen button once it exists.
  - The app at 200% text size.

## Order of work

1. Finish the phase 1 audit and Continue watching. This helps every user and has no new dependencies.
2. PWA (phase 2).
3. Decide on Capacitor after people have used the PWA for a while. The deciding question is whether embed pop-ups are bad enough on phones to justify maintaining an APK.
