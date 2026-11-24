# ජාතක කතා · Sinhala Jataka Stories

A mobile-first Progressive Web App for reading **548 Jataka stories in Sinhala**. Search, track your reading, save favourites, export any story as a PDF, and read offline.

[![Live demo](https://img.shields.io/badge/Live%20demo-open-b45309?style=for-the-badge)](https://nethsara14.github.io/sinhala-jataka-stories/)
![PWA](https://img.shields.io/badge/PWA-installable-1c273d?style=for-the-badge)
![No build step](https://img.shields.io/badge/build%20step-none-15803d?style=for-the-badge)
![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**Live site:** [https://nethsara14.github.io/sinhala-jataka-stories/](https://nethsara14.github.io/sinhala-jataka-stories/)

## Features

- **548 stories** with titles, topics, tags and life-lesson summaries
- **Search** by name, story number or tag, plus read / unread filters
- **Reading progress**, favourites, and "continue reading" from where you stopped
- **Light / dark theme** with a smooth transition, adjustable font size
- **Offline support**: download every story once and read without internet
- **Installable** on phones (Add to Home Screen) via a service worker and web manifest
- **PDF export** for each story (browser print, Sinhala renders correctly)
- Animated splash screen
- Plain HTML, CSS and JavaScript. No framework, no build step.

## Tech

| Part | Choice |
|---|---|
| UI | Vanilla HTML / CSS / JS |
| Offline | Service worker (network-first shell, cache-first story data) |
| Storage | `localStorage` for progress, favourites and preferences |
| Hosting | GitHub Pages |

## Project structure

```
index.html              app shell (home, reader, settings sheet)
css/style.css           styles (light / dark / print)
js/app.js               app logic
sw.js                   service worker (offline support)
manifest.webmanifest    install metadata
app-info.json           app and developer details used in the PDF footer
icons/                  app icons
Data/<n>.json           stories
Data/index.json         story list and tags (generated)
tools/build-index.js    regenerates Data/index.json
```

## Standalone Dataset

If you only need the structured Sinhala Jataka story JSON files (with titles, texts, topics, tags, and life-lesson summaries) for your own project or research, the standalone dataset is published in a separate repository:

- **Dataset Repository:** [Nethsara14/sinhala-jataka-stories-dataset](https://github.com/Nethsara14/sinhala-jataka-stories-dataset)

## Run locally

`fetch()` and the service worker need a server (not `file://`):

```bash
npx serve .
```

or use the VS Code **Live Server** extension.

## Adding or editing stories

1. Add `Data/<number>.json` with `title`, `text`, `topic`, `life_lesson_summary`, `tags`.
2. Run `node tools/build-index.js`.
3. Bump `VERSION` in `sw.js`, commit and push.

## Deploy

Push to GitHub, then **Settings → Pages → Deploy from branch → `main` / root**. HTTPS is required for offline mode and installing.

## Storage keys

`jataka_read_progress`, `jataka_favorites`, `jataka_prefs`, `jataka_last`

## Author

**Sasindu Nethsara Karanayaka** · [devnethsara.com](https://devnethsara.com/)

CodeGen N3xt Solutions · © 2026

## Content Attribution & License

### Story Content Source
The original Sinhala Jataka story texts used in this application were sourced from the **University of Sri Jayewardenepura (ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාල වෙබ් අඩවිය)**:
- Source URL: [https://www.sjp.ac.lk/buddhism/download-buddhist-555-jathaka-katha-free-pdf/](https://www.sjp.ac.lk/buddhism/download-buddhist-555-jathaka-katha-free-pdf/)

All structured JSON datasets (`Data/`), schema formatting, categorization tags, topics, and life-lesson summaries were independently engineered, processed, and curated by **Sasindu Nethsara Karanayaka** (CodeGen N3xt Solutions).

### License
The application source code (HTML, CSS, JavaScript, build scripts) and the structured JSON metadata schema are licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
