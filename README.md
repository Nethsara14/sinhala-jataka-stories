# ජාතක කතා (Jataka Stories) - Mobile-first PWA

Framework නැහැ, build step නැහැ. Plain HTML + CSS + JS. Phone එකට Install කරගන්නත් පුළුවන් (Add to Home Screen).

## Folder structure
```
index.html              app shell (home + reader + settings sheet, ඔක්කොම මෙතන)
css/style.css           styles (light / dark)
js/app.js               app logic
sw.js                   service worker (offline support)
manifest.webmanifest    install as app
icons/                  app icons
Data/1.json ... 550.json  stories
Data/index.json         list + tags (tools/build-index.js එකෙන් හැදෙනවා)
tools/build-index.js    index.json regenerate කරන script
```

## Local එකේ run කරන්න
`fetch()` use කරන නිසා file:// වලින් වැඩ කරන්නේ නැහැ. Server එකක් ඕනේ:
```
npx serve .
```
හරි VS Code "Live Server" extension.

## Deploy
GitHub Pages / Netlify / Vercel / Cloudflare Pages - folder එක upload කරන්න. HTTPS ඕනේ (offline + install වැඩ කරන්න).

## Aluth katha add / edit kalama
1. `Data/<number>.json` file එක දාන්න (title, text, life_lesson_summary, topic, index, tags)
2. `node tools/build-index.js` run කරන්න
3. Deploy

## Old files delete කරන්න (aluth version එකට ඕනේ නැහැ)
`story.html`, `Js/story.js`, `Data/path.json`, `structure.txt`
(Windows වල `Js` / `js` එකම folder එක, `app.js` replace වෙනවා.)

## Storage keys (පරණ data ආරක්ෂිතයි)
`jataka_read_progress`, `jataka_favorites` - කලින් වගේම. ඒ නිසා user ලගේ progress නැතිවෙන්නේ නැහැ.
