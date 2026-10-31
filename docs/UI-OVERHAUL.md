# UI overhaul plan

A full visual rework of Home, the title (details) page, Search, Person and the player, built phone-first. It covers what is wrong now, the new direction, the design tokens, each page, and the order of work. It builds on the player rework and the plan in [MOBILE.md](MOBILE.md).

## What's wrong now

Measured on the live site (vod.losingsanity.com) at 1440, 768 and 390px wide, with screenshots and a design inspector.

**Colour (the biggest problem).** Three palettes are fighting each other:
- A navy card (`rgba(10,20,36,.65)`) floats on a charcoal-to-plum page gradient.
- Cards under the posters are filled magenta-plum (`#3B1C32` → `#6A1E55`). Every poster is full colour, so the plum clashes with all of them.
- The call to action is a rose gradient with a pink glow, and ratings use gold `⭐` emoji.
- Secondary text is light pink (`#d4a5c0`), so it doesn't look secondary.

The stylesheets contain about 60 hard-coded colours. Only 7 of them are variables.

**Why it looks generated ("slop"):**
- 377 gradient fills on Home and 113 on a movie page. There are glows on buttons, `text-shadow` on titles, and 15 backdrop-blur ("glass") panels.
- The whole site sits inside a floating 1200px box with a drop shadow. The Home hero breaks out of that box, so the page is off-centre: 114px margin on the left, 20px on the right.
- Emoji and text glyphs are used as icons: ⭐ ▶ ℹ 📍 🎬. The trailer has a YouTube-red play button.
- Cards tilt in 3D when hovered.
- The movie page uses 11 font sizes. A page needs about 5.
- The details page sets its overview at 13px and 17 text blocks are under 13px. The movie title is only 24px on tablet and phone.
- Inter is named in `font-family` but never loaded, so every OS shows a different font.

**On phones:**
- The search field gets squeezed to about 200px next to the Search and Filter buttons.
- Most text on the details page is centred (77% of it).
- Ratings sit 4px from the screen edge.
- On a movie page, the first screen has no button.
- The TV page shows each episode as a tall card with a paragraph of text, so Season 1 alone takes about 6 screens of scrolling.

Before screenshots: run `node <taste-skill>/scripts/inspect.mjs https://vod.losingsanity.com/<path> --out .taste-skill/before/<page>` for `/`, `/movie/27205`, `/tv/1399`, `/search?q=batman` and `/player/tv/1399/1/1`. Keep them so the redesign can be compared against them.

## Direction

**The idea: the screen never moves.** On every title, the title's own picture works like a fixed stage:
- on the details page, the backdrop;
- on a person's page, their portrait;
- in the player, the video.

The information scrolls next to the stage (desktop) or underneath it (phone). The player already works this way after the rework (sticky video, episode list scrolling below it). The redesign uses the same structure on the details and person pages, so the whole app shares one layout.

On the details page, the stage also changes with what you are about to watch. Choosing an episode puts its still on the stage. "Trailer" plays the trailer on the stage itself.

**The posters provide the colour; the interface stays neutral.** A near-black ground, an off-white ink, two greys, and one accent colour. The accent is used for the main action on each screen and for the current item (playing episode, selected chip). Nothing else is coloured.

### Removed everywhere

- Gradients: all of them, except one neutral dark scrim behind text placed on a photo.
- Glows, shadows on elements that aren't floating, `text-shadow`, backdrop blur.
- The boxed `.app` card and the gradient `body::before` behind it.
- Emoji and text glyphs used as icons. Use SVG icons from `components/icons.tsx` instead.
- The 3D tilt on cards (the `MovieCard` pointer code).
- The plum card backgrounds under posters.
- Centred body text.
- Small uppercase labels with wide letter-spacing, and pill badges.

## Tokens

All tokens live in a new `src/styles/tokens.css`, which replaces `variables.css`. Component CSS uses only these tokens, never raw colour values (a check enforces this; see the end of this section).

```css
:root {
  color-scheme: dark;

  /* Colour: one ground, one ink, one accent */
  --ground:   #0b0c0e;   /* page */
  --surface:  #141518;   /* panels, episode list, inputs */
  --raised:   #1d1f23;   /* buttons, hover rows, chips */
  --active:   #272a2f;   /* pressed / selected-neutral */
  --line:     #2c2f35;   /* only for form fields and the player's column edge */
  --ink:      #f2f0ed;   /* all running text */
  --muted:    #b3b5b9;   /* secondary: year, runtime, character name */
  --faint:    #8e9196;   /* meta and placeholders (5.9:1 on ground) */
  --accent:   #ff7a1f;   /* main action + current item, nothing else (7.5:1 on ground) */
  --accent-ink: #0b0c0e; /* text on accent (8:1) */
  --scrim: linear-gradient(to top, rgb(11 12 14 / .92), rgb(11 12 14 / 0) 60%); /* text on photos only */

  /* Type: one family, five sizes */
  --font: "Clash Grotesk", system-ui, sans-serif;
  --fs-small:   0.8125rem;                          /* 13: meta, captions */
  --fs-body:    clamp(1rem, .97rem + .15vw, 1.0625rem); /* 16-17: overview, bio */
  --fs-lead:    clamp(1.125rem, 1rem + .5vw, 1.375rem); /* 18-22: row titles, section heads */
  --fs-head:    clamp(1.75rem, 1.2rem + 2.2vw, 2.75rem); /* 28-44: page h1 on list pages */
  --fs-display: clamp(2.5rem, 1.4rem + 5vw, 5.5rem);    /* 40-88: title name on hero/stage */

  /* Shape and space */
  --radius: 4px;            /* the only radius: posters, stills, buttons, inputs */
  --gutter: clamp(16px, 4vw, 48px);  /* one pair of page margins, everywhere */
  --gap: 12px;              /* between cards in a rail or grid */
  --section: clamp(40px, 6vw, 72px); /* between rows/sections */
  --tap: 44px;              /* minimum touch target */
  --bar-h: 56px;            /* top bar (64px from 900px up) */
}
```

Decisions behind these values:
- **Accent: orange.** It is the warm half of the current logo. Violet is out: it is the stereotypical generated-UI colour, and it is what makes the current site look like a template. Red is out because it reads as Netflix.
- **Type: Clash Grotesk**, at weights 400 and 500, used for everything. It is a slightly narrow grotesk, which keeps titles large without making them heavy. Self-host the woff2 files in `public/fonts/`, because the CSP is `font-src 'self'`. The Fontshare licence allows commercial use. It covers Latin only, so `system-ui` renders CJK and other titles.
- **One radius: 4px.** Use it for posters, buttons and inputs, with no rounded "soft" 12–16px cards. Round buttons are only for icon buttons.

**Enforcement.** Add `scripts/check-css.ts` and run it next to `npm run lint` in CI. It fails on:
- hex or `rgb(` values outside `tokens.css`;
- `linear-gradient` outside `--scrim`;
- `backdrop-filter`, `text-shadow`, or `box-shadow` outside `.is-floating` (menus, the filter sheet).

Without this check, the hard-coded colours will come back within a month.

## Foundation

- **Breakpoints become phone-first `min-width` queries:** 600 (large phone / small tablet), 900 (tablet landscape / small laptop), 1200 (desktop). Add `(hover: hover)` for hover-only details such as rail arrows, and `(max-height: 500px) and (orientation: landscape)` for phones in landscape. Document them in `tokens.css`. The desktop-first `max-width` blocks go away as each file is rewritten.
- **CSS layout:**
  - `tokens.css` and `base.css` (reset, body, focus ring, `.visually-hidden`, reduced motion).
  - One file per component or page, as now.
  - The leftovers in `ui.css` move into the files they belong to.
  - Stay on plain CSS. No Tailwind and no CSS-in-JS.
- **Icons:** extend `icons.tsx` with Star, Info, Close, Filter, Fullscreen, Mail, Discord and Plus. Use 20px icons with a 1.75 stroke and `currentColor`.
- **Images:** keep `OptimizedImage`. Update the `sizes` strings for the new card widths. Use the backdrop at `w1280` for the stage on desktop and `w780` on phones, and the poster at `w342` for cards.
- **Skeletons:** flat `--surface` blocks with exactly the final layout (no layout shift), and a slow opacity pulse that turns off under reduced motion.

## Shared components

| Component | Replaces | Notes |
|---|---|---|
| `TopBar` | `<header>` + logo + `Search` on every page | Wordmark left. From 900px a search field (`--surface` fill, no border, 40px tall). On phones a search icon button that goes to `/search` and focuses the field. Transparent over the Home hero; turns solid `--ground` after scrolling 80px (no blur). Hidden on `/player/*`, as now. |
| `Button` | `.hero-btn`, `.play-button`, `.search-btn`, `.filter-apply-btn`, `.state-retry-btn`, … (about 8 variants) | Three variants. `primary`: accent fill, `--accent-ink` text. `secondary`: `--raised` fill. `icon`: round, `--raised`. All at least 44px tall, 4px radius, a 120ms press effect (`scale(.97)`), and a 2px accent focus ring. |
| `PosterCard` | `.category-card`, `.movie-card`, `.similar-card`, `.person-credit-card` (four card types) | A 2:3 poster with the title (one line, ellipsis) and `2021 · ★ 7.7` underneath in `--muted`. No background, no overlay, no tilt. Hover (with a pointer): the poster brightens and scales to 1.03. Person results use the same card with a profile photo and their department. |
| `StillCard` | — | A 16:9 card for **Continue watching** and **Now in theaters**: title and `S2 · E5` (or year) on the `--scrim`. |
| `Rail` | `CategoryRow` | The row heading (`--fs-lead`) is a link to a full grid later. A horizontal list with `scroll-snap-type: x mandatory`. The first card lines up with the page margin and the row runs off the right edge of the screen, so a partly visible card signals that the row scrolls. Arrow buttons only with `(hover: hover)`, shown while the row is hovered. Keep the preload logic. |
| `EpisodeRow` | `.episode-card` on the details page **and** the row in `EpisodePanel` | **One component used in both places.** A 16:9 still (128px wide, 112px on phones), `E3 · 58 min` in `--faint`, the name, and on the details page two lines of the overview. The current episode gets a 3px accent bar on its left edge and a "Playing" label. |
| `SeasonSelect` | `.season-btn` pills | The native `<select>` already used in the player, which opens the OS picker on phones. |
| `Chip` / `Segmented` | `.filter-pill`, `.genre-tag` | `--raised` fill. When selected: `--ink` fill with `--ground` text (inverted), so no second accent use is needed. |
| `Sheet` | the search filter panel on phones | A `<dialog>` that slides up from the bottom, with a grab handle, a 100dvh limit and safe-area padding. It is the one surface allowed a shadow. |
| `states.tsx` | — | Restyle only. Error: heading, message, `secondary` retry button, left-aligned. Empty: one sentence and one action. |
| `Footer` | `.app-footer` | Wordmark, "Contact" and Discord as text links, and the TMDB attribution line ("This product uses the TMDB API but is not endorsed or certified by TMDB."), which TMDB's terms require and the site doesn't show yet. No hairline above it; a `--surface` field instead. |

## Pages

### Home

1. **Hero:** a full-bleed backdrop. The box and its side gaps go. Height 72svh, between 520 and 820px; 64svh on phones.
   - Only the `--scrim` from the bottom (and the left on desktop) to keep text readable.
   - The featured title at `--fs-display` (up to 2 lines).
   - The line `★ 7.7 · 2021 · Crime, Drama`.
   - On desktop only, two lines of overview, cut at a word (`line-clamp`, not `slice(0, 200) + '...'`).
   - Two buttons: **Play** (primary) and **Details** (secondary). On phones they sit side by side at half width each, inside the first screen.
2. **Continue watching** (new, from `loadLastEpisode`, listed in MOBILE.md): a `StillCard` rail, shown only when there is history.
3. Rails: Trending, Popular movies, Popular TV, Top rated movies, Top rated TV, Coming soon. They alternate with **Now in theaters** as a `StillCard` rail, so the page isn't 7 identical rows (the main risk with this direction).
4. Keep the search field out of the page body. It moves into the `TopBar`.

**Phone:** rail cards are 128px wide (about 2.8 per screen at 390px, so the next card shows), with 10px gaps. Margins come from `--gutter` (16px).

### Title page (movie / TV)

The split stage.

- **From 1200px:** a two-column grid, 45 / 55.
  - **Left:** `position: sticky; top: 0; height: 100svh`, filled edge to edge by the backdrop. Selecting an episode crossfades the stage to that episode's still (200ms). **Trailer** swaps the picture for the trailer iframe on the stage, with a close button.
  - **Right:** the reading column (max 640px, `--gutter` padding):
    - The `h1` title at `--fs-display`.
    - The line `2010 · 2h 28m · ★ 8.4 · Action, Science Fiction`. TV shows the number of seasons instead of the runtime.
    - **Play** (primary). Its label depends on state:
      - `Play`;
      - `Play S1 · E1`;
      - `Resume S2 · E5` (using `loadLastEpisode`);
      - "Checking…" with a spinner;
      - disabled "Not available" with the reason.
    - **Trailer** (secondary).
    - The overview at `--fs-body`, max 65ch.
    - TV only: **Episodes**. The `SeasonSelect` with the season's episode count, then `EpisodeRow`s with two-line overviews. About 4 rows fit on one screen, instead of 1 episode per screen now.
    - **Cast:** a rail of square photos (96px) with the name and character. The character in `--muted`.
  - Below the split, at full width: **More like this**, a poster grid on 6 columns. This breaks the split on purpose so the page doesn't end as a monotonous column.
- **600–1199px:** the stage is a 16:9 backdrop at the top (not sticky), with a single column below it.
- **Phone:**
  - The backdrop takes the top 56svh and stays sticky while the content scrolls up over it.
  - The content is a `--ground` sheet: title, meta line, a full-width **Play** button, then the overview.
  - Play must be on the first screen (the inspector flags that it currently isn't).
  - Text is left-aligned. The poster is not shown, since the backdrop does its job.
- The poster image is used only where there is no backdrop.

### Search

- `h1` is the query (`batman`) at `--fs-head`, with `234 results` in `--muted`. The note "filters and sorting apply to one page" stays, at `--fs-small`.
- **Filters:**
  - From 900px: one row under the heading. `Segmented` type (All / Movies / TV / People), then the Score, Sort and Year controls as compact `Chip` popovers, then **Genres** opening a popover of chips. Changing a filter applies it immediately (no separate "Filter" submit button).
  - On phones: one row with the `Segmented` type and a **Filters (2)** button that opens a `Sheet` holding all filters, plus **Show results**. The first row of results must start in the top 60% of the screen.
- **Results:**
  - A `PosterCard` grid with `repeat(auto-fill, minmax(150px, 1fr))`, 3 columns on phones (2 below 360px).
  - Pagination keeps the `?page=` URL. Desktop keeps the number buttons, restyled. Phones get a compact `‹ Page 2 of 12 ›`.
- **Empty `/search`:** the field is focused, with **Trending** as a rail underneath so the page is never blank.

### Person

The same split.
- **Stage:** the profile photo. It is already portrait, so it fills the 45% column cleanly.
- **Reading column:**
  - The `h1` name.
  - The line `Acting · Born 12 Nov 1974 (51) · Los Angeles, California`, with no 📍.
  - The biography, clamped to 6 lines, with **Read more** (`<details>`).
  - **Known for:** a `PosterCard` grid with "as Character" in `--muted`.
- The "Personal info" box grid goes. Its four facts are already in the meta line, and "Popularity 84.3" means nothing to a viewer.
- **Phone:** the photo takes the top 56svh (sticky), same as the title page.

### Player

The layout from the rework stays (bar, stage, prev/next, episode panel, sticky video on phones, full height in landscape). The work is mostly restyling it onto the tokens, plus two features:

- Remove the local `--player-*` palette. Map to `--ground` (the video stays on `#000`), `--surface` (panel), `--raised` (icon buttons, no border), `--line` (the edge between video and panel only).
- **Next episode** becomes the primary button (accent). It is the main action on the screen. **Previous** is secondary.
- The current episode in the panel is marked with the accent bar plus "Playing". Remove the plum `rgba(166,77,121,.22)` fill.
- The panel uses `EpisodeRow` (shared with the title page).
- **New: fullscreen + landscape lock** (listed in MOBILE.md). An icon button in the bar runs `requestFullscreen()` on `.player-stage`, then `screen.orientation.lock('landscape')`. It is shown only when `document.fullscreenEnabled` is true (Android Chrome and desktop). iPhone keeps the embed's own button.
- The loading cover stays (backdrop at 30% with a spinner). The spinner uses the accent colour.

### Not found and error pages

A heading at `--fs-head`, one sentence, and **Go home** (primary) plus **Search** (secondary), left-aligned within the page margins.

## Motion

Kept small. Use only `transform` and `opacity`, and every effect turns off under `prefers-reduced-motion`.

- **One signature move:** the stage. On the title and person pages the backdrop scales from 1.06 to 1 as the page loads (600ms), and crossfades when the episode selection changes. In the player the same crossfade runs between the loading cover and the video.
- **Feedback** on every control: press scale, hover brightness on cards, and the focus ring.
- **Entrances:** rails and sections fade and rise 16px once when they first enter the viewport, staggered by 60ms. They are never hidden if the script fails, because the class is added by JS and the default state is visible.
- Remove the old 3D tilt, the `translateY(-2px)` hover lifts, and the glow transitions.

## Accessibility

Keep and verify everything that already works: focus rings, the single `h1` per page, labelled icon buttons, `aria-current`, listbox keyboard handling, live regions.

Additions:
- Contrast of at least 4.5:1 for all text. The token values above pass on `--ground` and `--surface`.
- The visually hidden `h1` on Home stays. The featured title is an `h2` in the hero.
- The `Sheet` traps focus (the native `<dialog>` does) and closes on Escape and on a tap on the backdrop.
- Check that the app still works at 200% text size: rails must not clip their captions.

## Order of work

Each step is one PR with screenshots before and after.

0. **Commit the current player/mobile work** (the uncommitted `PlayerPage`, `EpisodePanel`, `PlayerFrame`, `icons`, `episodes` changes). That way the overhaul diffs don't mix with it.
1. **Foundation (1–2 days).** `tokens.css`, `base.css`, self-hosted fonts, the `check-css` script, `Button`, `TopBar`, `Footer`; remove `.app` and the page gradient. After this PR, every page has lost the plum, the gradients and the box, even before the pages themselves are redone.
2. **Cards, rails, Home (1–2 days).** `PosterCard`, `StillCard`, `Rail`, the new hero, **Continue watching**. Delete the `MovieCard` tilt code.
3. **Title page (2 days).** The split stage, `SeasonSelect`, the shared `EpisodeRow`, the stage crossfade, the trailer on the stage, the Play/Resume label.
4. **Search (1–2 days).** Filter row, `Sheet`, grid, pagination, the empty state with trending.
5. **Person (½ day).** It reuses the split from step 3.
6. **Player (1 day).** Tokens, the shared `EpisodeRow`, Next as primary, the fullscreen/orientation button.
7. **Finish (1 day).**
   - Motion.
   - New flat logo mark, favicon and `og-image` in the accent colour, replacing the purple-orange gradient orb.
   - `theme-color` → `#0b0c0e` in `index.html`, and the manifest colours in the PWA phase of MOBILE.md.
   - An accessibility pass.

About 8–11 days in total. Steps 2–6 can be done in any order once step 1 is in.

## Verification, every step

- `npm run lint`, `npm run typecheck`, `npm test` and `check-css`. Component tests rarely use class names (only `PlayerPage.test.tsx` and `TrailerFacade.test.tsx` query the DOM), so most will survive. The tests for `MovieList` and `CategoryRow` change with their components.
- Inspector screenshots at 1440, 768 and 390, plus 844×390 for the player. Compare against `.taste-skill/before/`. Target: no gradient, shadow, emoji, text-shadow or off-centre findings, and no text under 13px.
- The Playwright screenshot job from MOBILE.md (390×844, 844×390, 1440×900) is extended to `/`, `/movie/:id`, `/tv/:id`, `/search?q=` and `/person/:id`.
- Real devices before each release: iPhone Safari and Android Chrome, in portrait and landscape.

## Decisions (settled by the overhaul)

1. **Accent colour:** orange `#ff7a1f`, from the logo (`--accent` in `src/styles/tokens.css`).
2. **Typeface:** Clash Grotesk, self-hosted from `public/fonts/`.
3. **Logo:** redrawn as a flat single-colour mark.
4. **Light theme:** not built. The tokens make it a later add-on: a second `:root[data-theme="light"]` block.
