(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

    /* ---------- Storage (kalin keys wage thiyenawa, ඉතින් පරණ progress / favorites නොනැසී තියෙනවා) ---------- */
    const KEY = { read: 'jataka_read_progress', fav: 'jataka_favorites', prefs: 'jataka_prefs', last: 'jataka_last' };
    const store = {
        get(k, d) {
            try {
                const v = localStorage.getItem(k);
                return v ? JSON.parse(v) : d;
            } catch (e) {
                return d;
            }
        },
        set(k, v) {
            try {
                localStorage.setItem(k, JSON.stringify(v));
            } catch (e) {
                /* private mode */
            }
        },
        del(k) {
            try {
                localStorage.removeItem(k);
            } catch (e) {
                /* ignore */
            }
        },
    };
    const arr = (v) => (Array.isArray(v) ? v.map(String) : []);

    const read = new Set(arr(store.get(KEY.read, [])));
    const fav = new Set(arr(store.get(KEY.fav, [])));
    const prefs = Object.assign({ theme: 'auto', fs: 18 }, store.get(KEY.prefs, {}));
    const saveRead = () => store.set(KEY.read, [...read]);
    const saveFav = () => store.set(KEY.fav, [...fav]);
    const savePrefs = () => store.set(KEY.prefs, prefs);

    /* ---------- Helpers ---------- */
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    // ZWJ / ZWNJ අයින් කරලා search කරනවා - phone keyboards වල typing වෙනස් වුනත් match වෙන්න
    const norm = (s) =>
        String(s)
            .toLowerCase()
            .replace(/[\u200c\u200d]/g, '')
            .normalize('NFC')
            .trim();
    const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

    let toastT;
    function toast(msg) {
        const t = $('toast');
        t.textContent = msg;
        t.hidden = false;
        clearTimeout(toastT);
        toastT = setTimeout(() => {
            t.hidden = true;
        }, 2200);
    }

    /* ---------- State ---------- */
    let items = []; // { id, n, title, tags, t, hay }
    const byId = new Map();
    let scope = 'all'; // 'all' | 'fav'
    let filter = 'all'; // 'all' | 'read' | 'unread'
    let tag = '';
    let query = '';
    let list = [];
    let shown = 0;
    let dirty = false; // reader eke read/fav wenas una nam home list eka refresh karanna
    let homeY = 0;
    let current = null; // dan open wela thiyena story id
    let loadToken = 0;
    const CHUNK = 40;
    const storyCache = new Map();

    const listEl = $('list');
    const sentinel = $('more');

    /* ---------- Theme & font size ---------- */
    const darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function applyTheme() {
        const root = document.documentElement;
        if (prefs.theme === 'auto') delete root.dataset.theme;
        else root.dataset.theme = prefs.theme;
        const dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && darkMq && darkMq.matches);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', dark ? '#11141b' : '#faf7f2');
        document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === prefs.theme)));
        $('btnTheme').innerHTML = icon(dark ? 'sun' : 'moon');
    }
    if (darkMq && darkMq.addEventListener) darkMq.addEventListener('change', applyTheme);

    // Theme wenas wenna kalin class eka damma, 500ms pase ayin karanawa -> smooth fade
    let themeAnimT;
    function animateTheme() {
        const root = document.documentElement;
        root.classList.add('theme-anim');
        clearTimeout(themeAnimT);
        themeAnimT = setTimeout(() => root.classList.remove('theme-anim'), 500);
    }

    function applyFs() {
        prefs.fs = Math.min(30, Math.max(15, Number(prefs.fs) || 18));
        document.documentElement.style.setProperty('--fs', prefs.fs + 'px');
        $('fsRange').value = prefs.fs;
    }

    $('btnTheme').addEventListener('click', () => {
        const dark = document.documentElement.dataset.theme === 'dark' || (prefs.theme === 'auto' && darkMq && darkMq.matches);
        prefs.theme = dark ? 'light' : 'dark';
        animateTheme(); // NEW
        savePrefs();
        applyTheme();
    });
    document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-theme-set]');
        if (!b) return;
        prefs.theme = b.dataset.themeSet;
        animateTheme(); // NEW
        savePrefs();
        applyTheme();
    });

    $('fsRange').addEventListener('input', (e) => {
        prefs.fs = Number(e.target.value);
        applyFs();
        savePrefs();
    });
    $('fsUp').addEventListener('click', () => {
        prefs.fs += 1;
        applyFs();
        savePrefs();
    });
    $('fsDown').addEventListener('click', () => {
        prefs.fs -= 1;
        applyFs();
        savePrefs();
    });

    /* ---------- Restart app (splash eka aye pennala reload) ---------- */
    $('btnRestart').addEventListener('click', () => {
        try {
            sessionStorage.removeItem('jk_splash'); // splash eka aye pennanna
        } catch (e) {}
        location.reload();
    });

    /* ---------- Load index ---------- */
    function loadIndex() {
        fetch('Data/index.json')
            .then((r) => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(initIndex)
            .catch(() => {
                listEl.innerHTML = '<p class="empty">කතා නාමාවලිය ලෝඩ් කිරීමට නොහැකි විය.<br><br><button class="btn" id="btnReload" type="button">නැවත උත්සාහ කරන්න</button></p>';
                $('btnReload').addEventListener('click', () => {
                    listEl.innerHTML = '<p class="empty">ලෝඩ් වෙමින්…</p>';
                    loadIndex();
                });
                $('count').textContent = 'Offline';
            });
    }

    function initIndex(raw) {
        items = raw.map(([n, title, tags]) => ({ id: String(n), n, title, tags: tags || [], t: norm(title), hay: norm((tags || []).join(' ')) }));
        byId.clear();
        items.forEach((it) => byId.set(it.id, it));
        $('count').textContent = `ජාතක කතා ${items.length} ක්`;
        buildTagPills();
        applyFilters();
        updateProgress();
        updateContinue();
        if (current !== null) updateNeighbors();
    }

    function buildTagPills() {
        const counts = new Map();
        items.forEach((it) => it.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
        const box = $('pills');
        box.querySelectorAll('.pill.tag-pill').forEach((n) => n.remove());
        box.insertAdjacentHTML('beforeend', top.map(([t]) => `<button class="pill tag-pill" type="button" data-tag="${esc(t)}" aria-pressed="false">#${esc(t)}</button>`).join(''));
    }

    /* ---------- List: filter + render ---------- */
    function applyFilters(keep = 0) {
        const q = norm(query);
        const numQ = /^\d+$/.test(q) ? q : '';
        let out = items.filter((it) => {
            if (scope === 'fav' && !fav.has(it.id)) return false;
            if (filter === 'read' && !read.has(it.id)) return false;
            if (filter === 'unread' && read.has(it.id)) return false;
            if (tag && !it.tags.includes(tag)) return false;
            return true;
        });
        if (q) {
            const a = [];
            const b = [];
            for (const it of out) {
                if ((numQ && it.id.startsWith(numQ)) || it.t.includes(q)) a.push(it);
                else if (it.hay.includes(q)) b.push(it);
            }
            out = a.concat(b); // nama match wena ewa mulinma, tag match passe
        }
        list = out;
        shown = 0;
        listEl.textContent = '';
        renderTo(Math.max(CHUNK, keep));
        updateResult();
        syncPills();
    }

    function itemHTML(it) {
        const isRead = read.has(it.id);
        return `<a class="item${isRead ? ' read' : ''}" href="#/story/${it.id}" data-id="${it.id}"><span class="num">${isRead ? icon('check') : it.id}</span><span class="name">${esc(it.title)}</span>${fav.has(it.id) ? icon('heart', 'fav') : ''}${icon('next', 'chev')}</a>`;
    }

    function emptyMessage() {
        if (query || tag) return 'එබඳු ජාතක කතාවක් සොයාගත නොහැකි විය.';
        if (scope === 'fav') return 'ඔයා තවම කිසිම කතාවක් ප්‍රියතම ලැයිස්තුවට එකතු කර නැත.';
        if (filter === 'read') return 'ඔයා තවම කිසිම කතාවක් කියවා අවසන් කර නැත.';
        if (filter === 'unread') return 'සියලුම ජාතක කතා කියවා අවසන් කර ඇත!';
        return 'එබඳු ජාතක කතාවක් සොයාගත නොහැකි විය.';
    }

    const io =
        'IntersectionObserver' in window
            ? new IntersectionObserver(
                  (entries) => {
                      if (entries[0].isIntersecting) renderTo(shown + CHUNK);
                  },
                  { rootMargin: '700px' },
              )
            : null;

    function renderTo(n) {
        if (!list.length) {
            listEl.innerHTML = `<p class="empty">${emptyMessage()}</p>`;
            if (io) io.unobserve(sentinel);
            return;
        }
        const end = io ? Math.min(n, list.length) : list.length;
        let html = '';
        for (let i = shown; i < end; i++) html += itemHTML(list[i]);
        listEl.insertAdjacentHTML('beforeend', html);
        shown = end;
        if (io) {
            io.unobserve(sentinel);
            if (shown < list.length) io.observe(sentinel); // observe කරද්දි ආයෙ check වෙනවා
        }
    }

    function updateResult() {
        const label = scope === 'fav' ? 'ප්‍රියතම කතා' : 'කතා';
        $('result').textContent = items.length ? `${label} ${list.length} ක්` : '';
    }

    function syncPills() {
        document.querySelectorAll('#pills [data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === filter)));
        document.querySelectorAll('#pills [data-tag]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tag === tag)));
        document.querySelectorAll('#nav [data-nav="home"]').forEach((b) => b.classList.toggle('on', scope === 'all'));
        document.querySelectorAll('#nav [data-nav="fav"]').forEach((b) => b.classList.toggle('on', scope === 'fav'));
    }

    let qTimer;
    $('q').addEventListener('input', (e) => {
        clearTimeout(qTimer);
        qTimer = setTimeout(() => {
            query = e.target.value;
            applyFilters();
        }, 120);
    });
    $('pills').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.f) filter = b.dataset.f;
        else if (b.dataset.tag !== undefined) tag = tag === b.dataset.tag ? '' : b.dataset.tag;
        applyFilters();
    });

    /* ---------- Progress & continue card ---------- */
    function readCount() {
        let n = 0;
        read.forEach((id) => {
            if (byId.has(id)) n++;
        });
        return n;
    }
    function updateProgress() {
        const total = items.length;
        const n = readCount();
        $('progressText').textContent = `${n} / ${total}`;
        $('progressBar').style.transform = `scaleX(${total ? n / total : 0})`;
    }
    function updateContinue() {
        const last = store.get(KEY.last, null);
        const card = $('continueCard');
        const it = last && byId.get(String(last.id));
        if (it && !read.has(it.id) && last.y > 0.02) {
            card.hidden = false;
            card.dataset.id = it.id;
            card.href = '#/story/' + it.id;
            $('contName').textContent = `${it.id}. ${it.title}`;
        } else {
            card.hidden = true;
            delete card.dataset.id;
        }
    }

    /* ---------- Router ---------- */
    function go(id, replace) {
        const h = '#/story/' + id;
        if (replace) history.replaceState(history.state, '', h);
        else history.pushState({ app: 1 }, '', h);
        route();
    }
    function goHome() {
        if (history.state && history.state.app) history.back();
        else {
            history.replaceState({ app: 0 }, '', location.pathname + location.search);
            route();
        }
    }
    function route() {
        const m = location.hash.match(/^#\/story\/(\d+)/);
        if (m) openStory(m[1]);
        else showHome();
    }
    window.addEventListener('popstate', route);

    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-id]');
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(a.dataset.id, a.dataset.replace === '1');
    });

    function showHome() {
        const wasReading = current !== null;
        current = null;
        loadToken++;
        document.title = 'ජාතක කතා';
        $('reader').hidden = true;
        $('home').hidden = false;
        $('nav').hidden = false;
        closePanel();
        if (dirty && items.length) {
            applyFilters(shown);
            dirty = false;
        }
        updateProgress();
        updateContinue();
        if (wasReading) requestAnimationFrame(() => window.scrollTo(0, homeY));
    }

    /* ---------- Story load ---------- */
    function getStory(id) {
        if (storyCache.has(id)) return Promise.resolve(storyCache.get(id));
        return fetch(`Data/${id}.json`)
            .then((r) => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then((s) => {
                storyCache.set(id, s);
                if (storyCache.size > 6) storyCache.delete(storyCache.keys().next().value);
                return s;
            });
    }

    function openStory(id) {
        if (current === null) homeY = window.scrollY;
        current = id;
        const token = ++loadToken;
        $('home').hidden = true;
        $('reader').hidden = false;
        $('nav').hidden = true;
        closePanel();
        $('rbar').classList.remove('hide');
        $('rprog').style.transform = 'scaleX(0)';
        $('storyBody').hidden = true;
        $('storyError').hidden = true;
        $('storyLoading').hidden = false;
        const meta = byId.get(id);
        $('rbarTitle').textContent = meta ? meta.title : '';
        window.scrollTo(0, 0);
        updateFavBtn();

        getStory(id)
            .then((s) => {
                if (token !== loadToken) return;
                renderStory(id, s);
            })
            .catch(() => {
                if (token !== loadToken) return;
                $('storyLoading').hidden = true;
                $('storyError').hidden = false;
                $('errText').textContent = navigator.onLine === false ? 'Internet සම්බන්ධතාව නැත. මෙම කතාව Download කර නැත.' : 'කතාව ලෝඩ් කිරීමට නොහැකි විය.';
            });
    }

    function paragraphs(text, tagName) {
        const frag = document.createDocumentFragment();
        String(text || '')
            .split(/\n{2,}/)
            .forEach((part) => {
                part = part.trim();
                if (!part) return;
                const p = document.createElement(tagName || 'p');
                p.textContent = part;
                frag.appendChild(p);
            });
        return frag;
    }

    function renderStory(id, s) {
        const meta = byId.get(id);
        const title = s.title || (meta && meta.title) || '';
        document.title = `${title} | ජාතක කතා`;
        $('rbarTitle').textContent = title;
        $('sNum').textContent = `ජාතක කතාව ${id}`;
        $('sTitle').textContent = title;
        $('sTopic').textContent = s.topic || '';
        $('sTopic').hidden = !s.topic;
        $('sText').replaceChildren(paragraphs(s.text));
        // "1. ... 2. ..." වගේ ලකුණු තියෙන ආදර්ශය වෙනම පේළි වලට කඩනවා
        $('sLesson').replaceChildren(paragraphs(String(s.life_lesson_summary || '').replace(/([.?!])\s+(?=\d{1,2}\.\s)/g, '$1\n\n')));
        $('sLesson').parentElement.hidden = !s.life_lesson_summary;

        const tagBox = $('sTags');
        tagBox.textContent = '';
        (s.tags || []).forEach((t) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'tag';
            b.dataset.storyTag = t;
            b.textContent = '#' + t;
            tagBox.appendChild(b);
        });

        $('storyLoading').hidden = true;
        $('storyBody').hidden = false;
        updateDone();
        updateNeighbors();

        // අන්තිමට කියවපු තැනින් ආයෙත් පටන් ගන්න
        const last = store.get(KEY.last, null);
        if (last && String(last.id) === id && last.y > 0.02 && !read.has(id)) {
            requestAnimationFrame(() => {
                const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                window.scrollTo(0, last.y * max);
                toast('අන්තිමට කියවූ තැනින් ආරම්භ විය');
            });
        }
    }

    $('sTags').addEventListener('click', (e) => {
        const b = e.target.closest('[data-story-tag]');
        if (!b) return;
        tag = b.dataset.storyTag;
        query = '';
        $('q').value = '';
        filter = 'all';
        scope = 'all';
        dirty = false;
        applyFilters();
        homeY = 0;
        goHome();
    });

    function updateNeighbors() {
        const prev = $('btnPrev');
        const next = $('btnNext');
        const i = items.findIndex((it) => it.id === current);
        const setNav = (el, it) => {
            el.classList.toggle('off', !it);
            if (!it) return;
            el.dataset.id = it.id;
            el.href = '#/story/' + it.id;
            el.querySelector('span').textContent = `${it.id}. ${it.title}`;
        };
        setNav(prev, i > 0 ? items[i - 1] : null);
        setNav(next, i >= 0 && i < items.length - 1 ? items[i + 1] : null);
    }

    $('btnRetry').addEventListener('click', () => {
        if (current !== null) openStory(current);
    });
    $('btnBack').addEventListener('click', goHome);

    /* ---------- Done / Favourite ---------- */
    function updateDone() {
        const b = $('btnDone');
        const done = read.has(current);
        b.classList.toggle('done', done);
        b.innerHTML = done ? `${icon('check')}<span>කියවා අවසන් කළා (අයින් කිරීමට ඔබන්න)</span>` : `${icon('check')}<span>කියවා අවසන් කළා</span>`;
    }
    $('btnDone').addEventListener('click', () => {
        if (current === null) return;
        if (read.has(current)) {
            read.delete(current);
            toast('කියවූ සටහන අයින් කළා');
        } else {
            read.add(current);
            const last = store.get(KEY.last, null);
            if (last && String(last.id) === current) store.del(KEY.last);
            toast('කියවා අවසන් ලෙස සටහන් විය ✔');
        }
        saveRead();
        dirty = true;
        updateDone();
    });

    function updateFavBtn() {
        const on = current !== null && fav.has(current);
        const b = $('btnFav');
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', on ? 'ප්‍රියතමයෙන් අයින් කරන්න' : 'ප්‍රියතම කරන්න');
    }
    $('btnFav').addEventListener('click', () => {
        if (current === null) return;
        if (fav.has(current)) {
            fav.delete(current);
            toast('ප්‍රියතමයෙන් අයින් කළා');
        } else {
            fav.add(current);
            toast('ප්‍රියතම ලැයිස්තුවට එකතු කළා ❤️');
        }
        saveFav();
        dirty = true;
        updateFavBtn();
    });

    /* ---------- Reader scroll: progress bar, hide/show top bar, save position ---------- */
    let ticking = false;
    let lastY = 0;
    let saveT;
    window.addEventListener(
        'scroll',
        () => {
            if (current === null || ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                if (current === null) return;
                const y = window.scrollY;
                const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
                $('rprog').style.transform = `scaleX(${Math.min(1, y / max)})`;
                const d = y - lastY;
                if (Math.abs(d) > 6) {
                    $('rbar').classList.toggle('hide', d > 0 && y > 140);
                    if (d > 0) closePanel();
                    lastY = y;
                }
                clearTimeout(saveT);
                const id = current;
                saveT = setTimeout(() => {
                    const ratio = y / max;
                    if (current === id && ratio > 0.02 && !read.has(id)) store.set(KEY.last, { id, y: Math.round(ratio * 1000) / 1000 });
                }, 500);
            });
        },
        { passive: true },
    );

    /* ---------- PDF (browser print -> Save as PDF) ---------- */
    /* App details (app-info.json). File eka load unoth eka, nathnam me default wala thiyena eka */
    let appInfo = {
        name: 'ජාතක කතා',
        tagline: '',
        version: '',
        website: '',
        developer: { name: 'Sasindu Nethsara Karanayaka', role: '', email: '', website: '', studio: 'CodeGen N3xt Solutions' },
        copyright: '© 2026',
    };
    fetch('app-info.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
            if (j) appInfo = { ...appInfo, ...j, developer: { ...appInfo.developer, ...(j.developer || {}) } };
        })
        .catch(() => {});

    function stamp() {
        const d = new Date();
        try {
            const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
            return `${date} · ${time}`;
        } catch (e) {
            return d.toLocaleString();
        }
    }

    function fillInfo(id) {
        const APP_NAME = 'Sinhala Jataka Stories';
        const rows = [
            ['App', [APP_NAME, appInfo.version && 'v' + appInfo.version].filter(Boolean).join(' · ')],
            ['About', '548 Jataka stories in Sinhala. Read, search, save favourites and read offline.'],
            ['Story link', location.origin + location.pathname + '#/story/' + id],
            ['Website', appInfo.website],
        ].filter((r) => r[1]);
        const body = $('pdMeta');
        body.textContent = '';
        rows.forEach(([k, v]) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            const td = document.createElement('td');
            th.textContent = k;
            td.textContent = v;
            tr.append(th, td);
            body.appendChild(tr);
        });
        $('pdGen').textContent = `Downloaded on: ${stamp()}`;
        $('pdFoot').textContent = APP_NAME;
    }
    function fillPrint(id, s) {
        const meta = byId.get(id);
        const title = s.title || (meta && meta.title) || '';
        const lesson = String(s.life_lesson_summary || '').replace(/([.?!])\s+(?=\d{1,2}\.\s)/g, '$1\n\n');
        $('pdNo').textContent = `ජාතක කතාව ${id}`;
        $('pdTitle').textContent = title;
        $('pdTopic').textContent = s.topic || '';
        $('pdTopic').hidden = !s.topic;
        $('pdText').replaceChildren(paragraphs(s.text));
        $('pdLesson').replaceChildren(paragraphs(lesson));
        $('pdLesson').hidden = !lesson;
        $('pdLessonH').hidden = !lesson;
        const tagBox = $('pdTags');
        tagBox.textContent = '';
        (s.tags || []).forEach((t) => {
            const sp = document.createElement('span');
            sp.textContent = '#' + t;
            tagBox.appendChild(sp);
        });
        fillInfo(id);
        return title;
    }

    $('btnPdf').addEventListener('click', () => {
        if (current === null) return;
        const id = current;
        getStory(id)
            .then((s) => {
                const title = fillPrint(id, s);
                const oldTitle = document.title;
                document.title = `Jataka ${id} - ${title}`; // PDF file name eka
                window.addEventListener(
                    'afterprint',
                    () => {
                        document.title = oldTitle;
                    },
                    { once: true },
                );
                window.print();
            })
            .catch(() => toast('PDF එක සකස් කිරීමට නොහැකි විය'));
    });

    /* ---------- Font panel ---------- */
    function closePanel() {
        $('aaPanel').hidden = true;
        $('btnAa').setAttribute('aria-expanded', 'false');
    }
    $('btnAa').addEventListener('click', () => {
        const open = $('aaPanel').hidden;
        $('aaPanel').hidden = !open;
        $('btnAa').setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
        if (!$('aaPanel').hidden && !e.target.closest('#aaPanel, #btnAa')) closePanel();
    });

    /* ---------- Bottom nav ---------- */
    function randomStory() {
        if (!items.length) return;
        let pool = items.filter((it) => !read.has(it.id)); // නොකියවූ ඒවායින් තෝරනවා
        if (!pool.length) pool = items;
        go(pool[Math.floor(Math.random() * pool.length)].id);
    }
    $('nav').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-nav]');
        if (!b) return;
        const k = b.dataset.nav;
        if (k === 'random') return randomStory();
        if (k === 'more') return openSheet();
        if (k === 'home') {
            scope = 'all';
            filter = 'all';
            tag = '';
            query = '';
            $('q').value = '';
        }
        if (k === 'fav') {
            scope = 'fav';
        }
        applyFilters();
        window.scrollTo(0, 0);
    });
    $('progressCard').addEventListener('click', openSheet);

    /* ---------- Sheet ---------- */
    function openSheet() {
        $('sheet').hidden = false;
        document.body.style.overflow = 'hidden';
        refreshOffline();
        $('sheetClose').focus();
    }
    function closeSheet() {
        $('sheet').hidden = true;
        document.body.style.overflow = '';
        disarmReset();
    }
    $('sheet').addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) closeSheet();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
    });

    /* ---------- Share app link ---------- */
    $('btnShare').addEventListener('click', async () => {
        const url = appInfo.website || 'https://nethsara14.github.io/sinhala-jataka-stories/';
        const data = { title: 'ජාතක කතා', text: 'ජාතක කතා 548ක් - කියවන්න, සොයන්න, ප්‍රියතම කරන්න.', url };
        if (navigator.share) {
            try {
                await navigator.share(data);
            } catch (e) {
                /* user cancelled */
            }
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            toast('Link එක copy කළා ✔');
        } catch (e) {
            window.prompt('Link එක copy කරන්න', url);
        }
    });

    /* reset progress (two-tap confirm) */
    let resetArmed = false;
    let resetT;
    const resetLabel = 'කියවූ සටහන් මකාදමන්න';
    function disarmReset() {
        resetArmed = false;
        clearTimeout(resetT);
        $('btnReset').classList.remove('armed');
        $('btnReset').textContent = resetLabel;
    }
    $('btnReset').addEventListener('click', () => {
        if (!resetArmed) {
            resetArmed = true;
            $('btnReset').classList.add('armed');
            $('btnReset').textContent = 'ස්ථිරද? නැවත ඔබන්න (වෙනස් කළ නොහැක)';
            resetT = setTimeout(disarmReset, 4000);
            return;
        }
        read.clear();
        saveRead();
        store.del(KEY.last);
        disarmReset();
        updateProgress();
        updateContinue();
        applyFilters(shown);
        toast('කියවීමේ ප්‍රගතිය මකා දැමුවා');
    });

    /* ---------- Offline download ---------- */
    const DATA_CACHE = 'jk-data-v1';
    let offBusy = false;
    let offCancel = false;
    const offOK = 'caches' in window;

    async function refreshOffline() {
        if (!offOK) {
            $('offlineBox').hidden = true;
            return;
        }
        if (offBusy || !items.length) return;
        try {
            const cache = await caches.open(DATA_CACHE);
            const keys = await cache.keys();
            const n = keys.filter((r) => /\/Data\/\d+\.json$/.test(r.url)).length;
            setOffUI(n, items.length);
        } catch (e) {
            /* ignore */
        }
    }
    function setOffUI(n, total, busy) {
        $('offBar').style.transform = `scaleX(${total ? Math.min(1, n / total) : 0})`;
        $('offText').textContent = n >= total ? 'සියලු කතා Download කර ඇත ✔ Internet නැතිවත් කියවන්න පුළුවන්.' : `Download කර ඇත: ${n} / ${total}`;
        $('offLabel').textContent = busy ? 'නවත්වන්න' : n >= total ? 'යාවත්කාලීන කරන්න' : 'සියලු කතා Download කරන්න';
    }
    $('btnOffline').addEventListener('click', async () => {
        if (!offOK || !items.length) return;
        if (offBusy) {
            offCancel = true;
            return;
        }
        offBusy = true;
        offCancel = false;
        try {
            const cache = await caches.open(DATA_CACHE);
            const missing = [];
            for (const it of items) if (!(await cache.match(`Data/${it.id}.json`))) missing.push(it);
            let done = items.length - missing.length;
            setOffUI(done, items.length, true);
            for (let i = 0; i < missing.length && !offCancel; i += 6) {
                await Promise.all(
                    missing.slice(i, i + 6).map(async (it) => {
                        try {
                            const r = await fetch(`Data/${it.id}.json`);
                            if (r.ok) {
                                await cache.put(`Data/${it.id}.json`, r);
                                done++;
                            }
                        } catch (e) {
                            /* skip */
                        }
                    }),
                );
                setOffUI(done, items.length, true);
            }
            setOffUI(done, items.length, false);
            if (done < items.length) $('offText').textContent += ' (Internet බලලා නැවත උත්සාහ කරන්න)';
        } catch (e) {
            $('offText').textContent = 'Download කිරීමට නොහැකි විය.';
        }
        offBusy = false;
    });

    /* ---------- Init ---------- */
    applyTheme();
    applyFs();
    loadIndex();
    route();

    /* ---------- Splash: kamathi min time ekak pennala, page eka load unama smooth fade out ---------- */
    (function () {
        const splash = $('splash');
        if (!splash) return;
        let gone = false;
        const hide = () => {
            if (gone) return;
            gone = true;
            splash.classList.add('out'); // CSS eke fade + zoom
            setTimeout(() => splash.remove(), 700);
            try {
                sessionStorage.setItem('jk_splash', '1');
            } catch (e) {}
        };
        const minTime = new Promise((r) => setTimeout(r, 4000)); // splash eka minimum 1.8s pennanawa
        const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }));
        Promise.all([minTime, loaded]).then(hide);
        setTimeout(hide, 6000); // safety: 3s ekata passe hari hide
    })();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        });
    }
})();
