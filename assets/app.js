let menStores = [];
let womenStores = [];

async function loadData() {
    const [menRes, womenRes] = await Promise.all([
        fetch('data/men.json'),
        fetch('data/women.json')
    ]);
    if (!menRes.ok || !womenRes.ok) {
        throw new Error('Failed to load directory data.');
    }
    [menStores, womenStores] = await Promise.all([
        menRes.json(),
        womenRes.json()
    ]);
}

// Pre-sort (A-Z, once)
const _cmp = (a, b) => a.name.localeCompare(b.name);
function sortStores() {
    menStores.sort(_cmp);
    womenStores.sort(_cmp);
}

// ── STATE ────────────────────────────────────────────────────────────────────
let tab = 'home';
let minInseam = 0;
const AF = { favorites: false, tallSpecific: false, hasTops: false, hasBottoms: false };

// ── FAVORITES ────────────────────────────────────────────────────────────────
function getFavs() {
    try { return JSON.parse(localStorage.getItem('tallfind_favs') || '[]'); } catch { return []; }
}
function setFavs(arr) { localStorage.setItem('tallfind_favs', JSON.stringify(arr)); }
function toggleFav(name, e) {
    e.preventDefault(); e.stopPropagation();
    const favs = getFavs();
    const idx = favs.indexOf(name);
    if (idx > -1) favs.splice(idx, 1); else favs.push(name);
    setFavs(favs);
    render();
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
const _skip = v => !v || /^(N\/A|Not listed|Not specified|Varies|Shorts only|None)/i.test(v);
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function safeUrl(url) {
    try {
        const parsed = new URL(String(url || ''));
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
}

const arrowSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';

function generateDesc(s, isMen) {
    if (s.notes) return s.notes;

    if (s.tallSpecific) {
        if (isMen) {
            if (s.hasTops && s.hasBottoms) {
                if (s.inseam >= 40) return 'Purpose-built for tall men with inseams up to ' + s.inseamD + '. Full range of tops and bottoms in proper tall proportions.';
                if (s.inseam >= 38) return 'Dedicated tall brand with tops and bottoms. Inseams reach ' + s.inseamD + ', which puts it well above average.';
                return 'Tall-specific brand with both tops and bottoms designed around taller frames.';
            }
            if (s.hasTops) return 'Dedicated tall brand focused on tops in genuine tall cuts.';
            if (s.hasBottoms) return 'Tall-specific brand with bottoms' + (s.inseam ? ' reaching ' + s.inseamD + ' inseam' : ' in extended lengths') + '.';
        } else {
            if (s.hasTops && s.hasBottoms) return 'Dedicated tall brand with tops and bottoms cut for taller proportions.';
            if (s.hasTops) return 'Tall-specific brand focused on tops for taller frames.';
            if (s.hasBottoms) return 'Dedicated tall brand specializing in bottoms with extended lengths.';
        }
        return 'Dedicated tall brand.';
    }

    // Mainstream
    const has = s.hasTops && s.hasBottoms ? 'tops and bottoms' : s.hasTops ? 'tops' : 'bottoms';
    if (isMen) {
        if (s.inseam >= 38) return 'Solid mainstream option with tall ' + has + '. Inseams go up to ' + s.inseamD + '.';
        if (s.inseam >= 36) return 'Carries tall ' + has + ' with inseams to ' + s.inseamD + '. Reliable for the basics.';
        if (s.inseam) return 'Has a tall section for ' + has + '. Inseam tops out at ' + s.inseamD + '.';
        if (!s.hasTops && s.hasBottoms) return 'Tall sizing for bottoms only. Worth checking for specific pieces.';
        if (s.hasTops && !s.hasBottoms) return 'Carries tall tops but no tall bottoms. Good for layering pieces.';
        return 'Mainstream retailer with a dedicated tall section for ' + has + '.';
    } else {
        if (!_skip(s.bottomSizes) && !_skip(s.topSizes)) return 'Mainstream retailer with tall options for ' + has + '. Decent range in both categories.';
        if (s.hasTops && !s.hasBottoms) return 'Carries tall tops but limited bottom options.';
        if (!s.hasTops && s.hasBottoms) return 'Tall sizing focused on bottoms and extended lengths.';
        return 'Mainstream retailer with a tall section for ' + has + '.';
    }
}

function matchesSearch(s, q, isMen) {
    if (!q) return true;
    const fields = [
        s.name, s.domain, s.notes || '', s.topSizes || '',
        s.tallSpecific ? 'tall-specific tall specific dedicated tall-only' : 'mainstream',
        s.hasTops ? 'tops shirts' : '',
        s.hasBottoms ? 'bottoms pants jeans' : ''
    ];
    if (isMen) {
        fields.push(s.inseamD || '', s.waist || '');
    } else {
        fields.push(s.bottomSizes || '');
    }
    const text = fields.join(' ').toLowerCase();
    // Support multi-word queries: all terms must match
    const terms = q.split(/\s+/).filter(Boolean);
    return terms.every(term => text.includes(term));
}

// ── SWITCH TAB ───────────────────────────────────────────────────────────────
function switchTab(t, opts) {
    opts = opts || {};
    tab = t;
    ['home', 'men', 'women'].forEach(id => {
        const el = document.getElementById('tab-' + id);
        el.classList.toggle('on', t === id);
        el.setAttribute('aria-selected', t === id);
    });

    if (t === 'home') {
        document.getElementById('homepageSection').style.display = '';
        document.getElementById('mainContent').style.display = 'none';
        renderHomepage();
        if (!opts.preserveSearch) window.scrollTo(0, 0);
        return;
    }

    document.getElementById('homepageSection').style.display = 'none';
    document.getElementById('mainContent').style.display = '';
    document.getElementById('inseamRow').style.display = t === 'men' ? '' : 'none';

    // Update directory hero
    document.getElementById('dirTitle').textContent = t === 'men' ? "Men's Tall" : "Women's Tall";
    document.getElementById('dirMeta').textContent = t === 'men'
        ? menStores.length + ' hand-checked stores with genuine tall sizing for men 6\'2" and above. Filter by inseam, store type, and more.'
        : womenStores.length + ' hand-checked stores with tall sizing for women 5\'9" and above. Filter by store type, sizing, and more.';

    clearFilters(true, !!opts.preserveSearch);

    if (opts.filter) {
        AF[opts.filter] = true;
        document.getElementById('f-' + opts.filter).classList.add('on');
        document.getElementById('f-all').classList.remove('on');
        updateClear();
    }
    if (opts.inseam) {
        minInseam = opts.inseam;
        document.querySelectorAll('[data-ins]').forEach(b =>
            b.classList.toggle('on', +b.dataset.ins === opts.inseam));
        updateClear();
    }

    render();
    if (!opts.preserveSearch) window.scrollTo(0, 0);
}

// ── HOMEPAGE RENDER ──────────────────────────────────────────────────────────
function renderHomepage() {
    const total = menStores.length + womenStores.length;
    const maxIns = menStores.reduce(function(m, s) { return s.inseam && s.inseam > m ? s.inseam : m; }, 0);

    // Brand names for marquee
    var marqueeNames = [], seen = {};
    menStores.concat(womenStores).forEach(function(s) {
        if (!seen[s.name] && s.tallSpecific) { marqueeNames.push(s.name); seen[s.name] = true; }
    });
    menStores.concat(womenStores).forEach(function(s) {
        if (!seen[s.name]) { marqueeNames.push(s.name); seen[s.name] = true; }
    });
    marqueeNames = marqueeNames.slice(0, 16);
    var marqueeHTML = marqueeNames.map(function(n) { return '<span class="hp-brand">' + n + '</span>'; }).join('');

    document.getElementById('homepageContent').innerHTML =
    // ── HERO ──
    '<section class="hp-hero-section">'
    + '<div class="hp-hero">'
    +   '<img class="hp-hero-img" src="https://images.pexels.com/photos/11054593/pexels-photo-11054593.jpeg?auto=compress&cs=tinysrgb&w=1600" alt="Tall fashion">'
    +   '<div class="hp-hero-overlay"></div>'
    +   '<div class="hp-hero-content">'
    +     '<div class="hp-pill">Curated Tall Clothing Directory</div>'
    +     '<h1>Find brands that actually fit.</h1>'
    +     '<p>A hand-reviewed directory of ' + total + ' tall-friendly stores for men and women. Every store verified, every size range confirmed.</p>'
    +     '<button class="hp-cta" onclick="switchTab(\'men\')">Browse the Directory ' + arrowSvg + '</button>'
    +   '</div>'
    +   '<div class="hp-hero-meta"><span>' + total + ' Stores Reviewed</span><span>Updated March 2026</span></div>'
    + '</div>'
    + '</section>'

    // ── BROWSE CARDS ──
    + '<div class="hp-section-label">Browse by Category</div>'
    + '<section class="hp-browse-grid">'
    +   '<div class="hp-browse-card hp-browse-card-sage" role="button" tabindex="0" onclick="switchTab(\'men\')" onkeydown="if(event.key===\'Enter\')this.click()">'
    +     '<div>'
    +       '<h2>Men\u2019s Tall</h2>'
    +       '<p>' + menStores.length + ' vetted stores with inseams up to ' + maxIns + '"</p>'
    +     '</div>'
    +     '<span class="hp-browse-cta">Browse directory ' + arrowSvg + '</span>'
    +   '</div>'
    +   '<div class="hp-browse-card hp-browse-card-sand" role="button" tabindex="0" onclick="switchTab(\'women\')" onkeydown="if(event.key===\'Enter\')this.click()">'
    +     '<div>'
    +       '<h2>Women\u2019s Tall</h2>'
    +       '<p>' + womenStores.length + ' vetted stores with extended length options</p>'
    +     '</div>'
    +     '<span class="hp-browse-cta">Browse directory ' + arrowSvg + '</span>'
    +   '</div>'
    + '</section>'

    // ── BRAND MARQUEE ──
    + '<div class="hp-marquee">'
    +   '<div class="hp-marquee-track">' + marqueeHTML + marqueeHTML + '</div>'
    + '</div>'

    // ── FOOTER ──
    + '<footer class="hp-footer">'
    +   '<div class="hp-footer-inner">'
    +     '<div class="hp-footer-grid">'
    +       '<div class="hp-footer-brand">'
    +         '<div class="hp-footer-logo">Tall<em>find</em></div>'
    +         '<p>Curated tall fashion<br>for men and women.</p>'
    +       '</div>'
    +       '<div class="hp-footer-col">'
    +         '<h5>Directory</h5>'
    +         '<ul>'
    +           '<li onclick="switchTab(\'men\')">Men\u2019s Tall</li>'
    +           '<li onclick="switchTab(\'women\')">Women\u2019s Tall</li>'
    +           '<li onclick="switchTab(\'men\',{filter:\'tallSpecific\'})">Tall-Only Brands</li>'
    +           '<li onclick="switchTab(\'men\',{inseam:38})">38\u201d+ Inseam</li>'
    +         '</ul>'
    +       '</div>'
    +       '<div class="hp-footer-col">'
    +         '<h5>Resources</h5>'
    +         '<ul>'
    +           '<li onclick="openModal()">Submit a Store</li>'
    +           '<li onclick="openFeedback()">Send Feedback</li>'
    +         '</ul>'
    +       '</div>'
    +     '</div>'
    +     '<div class="hp-footer-bottom">'
    +       '<span>\u00a9 2026 Tallfind</span>'
    +       '<span>Data sourced from community research by <a href="https://www.reddit.com/u/wildthingking" target="_blank" rel="noopener" style="color:rgba(255,253,246,0.5);text-decoration:underline">u/wildthingking</a></span>'
    +     '</div>'
    +   '</div>'
    + '</footer>';
}

// ── MODALS ───────────────────────────────────────────────────────────────────
let _activeOverlay = null;
let _triggerEl = null;

function openOverlay(id) {
    _triggerEl = document.activeElement;
    _activeOverlay = id;
    const el = document.getElementById(id);
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        const focusable = el.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
    }, 50);
}
function closeOverlay(id) {
    _activeOverlay = null;
    const el = document.getElementById(id);
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (_triggerEl && _triggerEl.focus) { _triggerEl.focus(); _triggerEl = null; }
}
function openModal()     { openOverlay('modalOverlay'); }
function closeModal()    { closeOverlay('modalOverlay'); }
function openFeedback()  { openOverlay('feedbackOverlay'); }
function closeFeedback() { closeOverlay('feedbackOverlay'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay && _activeOverlay) closeOverlay(_activeOverlay);
    });
});

// Keyboard: Escape, Tab trapping, arrow nav
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _activeOverlay) {
        closeOverlay(_activeOverlay);
        return;
    }
    if (e.key === 'Tab' && _activeOverlay) {
        const overlay = document.getElementById(_activeOverlay);
        const focusable = [...overlay.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement?.getAttribute('role') === 'tab') {
        const tabs = ['home', 'men', 'women'];
        const idx = tabs.indexOf(tab);
        const next = e.key === 'ArrowRight' ? (idx + 1) % 3 : (idx + 2) % 3;
        switchTab(tabs[next]);
        document.getElementById('tab-' + tabs[next]).focus();
        e.preventDefault();
    }
});

// Form submit
function bindFormSubmit(formId, successId, defaultLabel) {
    document.getElementById(formId).addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('.form-submit');
        btn.textContent = 'Sending...'; btn.disabled = true;
        try {
            const res = await fetch(this.action, {
                method: 'POST', body: new FormData(this),
                headers: { Accept: 'application/json' }
            });
            if (res.ok) {
                this.style.display = 'none';
                document.getElementById(successId).style.display = 'block';
            } else { throw new Error(); }
        } catch {
            btn.textContent = defaultLabel; btn.disabled = false;
            alert('Something went wrong. Please try again.');
        }
    });
}
bindFormSubmit('submitForm', 'formSuccess', 'Submit Store');
bindFormSubmit('feedbackForm', 'feedbackSuccess', 'Send Feedback');

// ── FILTERS ──────────────────────────────────────────────────────────────────
function toggleFilter(key) {
    if (key === 'all') { clearFilters(); return; }
    AF[key] = !AF[key];
    document.getElementById('f-' + key).classList.toggle('on', AF[key]);
    const any = Object.values(AF).some(Boolean);
    document.getElementById('f-all').classList.toggle('on', !any);
    updateClear();
    render();
}

function setInseam(v) {
    minInseam = v;
    document.querySelectorAll('[data-ins]').forEach(b =>
        b.classList.toggle('on', +b.dataset.ins === v));
    updateClear();
    render();
}

function clearFilters(silent, keepSearch) {
    ['favorites', 'tallSpecific', 'hasTops', 'hasBottoms'].forEach(k => {
        AF[k] = false;
        document.getElementById('f-' + k).classList.remove('on');
    });
    document.getElementById('f-all').classList.add('on');
    minInseam = 0;
    document.querySelectorAll('[data-ins]').forEach(b => b.classList.toggle('on', b.dataset.ins === '0'));
    if (!keepSearch) document.getElementById('searchInput').value = '';
    document.getElementById('clearBtn').style.display = 'none';
    if (!silent) render();
}

function updateClear() {
    const active = Object.values(AF).some(Boolean) || minInseam > 0
        || document.getElementById('searchInput').value.trim() !== '';
    document.getElementById('clearBtn').style.display = active ? '' : 'none';
}

let _searchTimer;
document.getElementById('searchInput').addEventListener('input', () => {
    updateClear();
    const q = document.getElementById('searchInput').value.trim();
    if (tab === 'home' && q) {
        switchTab('men', { preserveSearch: true });
        return;
    }
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(render, 150);
});

// ── RENDER ───────────────────────────────────────────────────────────────────
function render() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    const isMen = tab === 'men';
    const data = isMen ? menStores : womenStores;
    const favs = getFavs();

    let list = data.filter(s => {
        if (AF.favorites && !favs.includes(s.name)) return false;
        if (AF.tallSpecific && !s.tallSpecific) return false;
        if (AF.hasTops && !s.hasTops) return false;
        if (AF.hasBottoms && !s.hasBottoms) return false;
        if (isMen && minInseam > 0 && (s.inseam === null || s.inseam < minInseam)) return false;
        if (!matchesSearch(s, q, isMen)) return false;
        return true;
    });

    document.getElementById('storeCount').textContent = list.length + ' store' + (list.length !== 1 ? 's' : '');
    document.getElementById('storeGrid').style.display = list.length ? '' : 'none';
    document.getElementById('noResults').style.display = list.length ? 'none' : '';
    if (!list.length) return;

    const tallOnly = list.filter(s => s.tallSpecific);
    const mainstream = list.filter(s => !s.tallSpecific);

    let html = '';

    if (tallOnly.length && mainstream.length) {
        html += '<div class="section-break"><h2 class="section-title">Tall-Only Brands</h2><div class="section-line"></div></div>';
    }

    const renderCard = (s, idx) => {
        const esc = s.name.replace(/'/g, "\\'");
        const hasUrl = !!s.url;
        const safeHref = safeUrl(s.url);
        const catLabel = s.tallSpecific ? 'Tall-Only' : 'Tall Section';
        const genderLabel = isMen ? "Men's" : "Women's";

        // Editorial description
        const desc = generateDesc(s, isMen);

        // Stats
        const stats = [];
        if (s.tallSpecific) stats.push({ text: '\u2605 Tall-Only', highlight: true });
        else stats.push({ text: 'Tall Section', highlight: false });

        if (s.hasTops && s.hasBottoms) stats.push({ text: 'Tops & Bottoms', highlight: false });
        else if (s.hasTops) stats.push({ text: 'Tops', highlight: false });
        else if (s.hasBottoms) stats.push({ text: 'Bottoms', highlight: false });

        if (isMen && !_skip(s.inseamD)) {
            const ins = /^\d/.test(s.inseamD) ? s.inseamD + ' inseam' : s.inseamD;
            stats.push({ text: ins, highlight: s.inseam >= 38 });
        }
        if (!isMen && !_skip(s.bottomSizes) && s.bottomSizes.length < 30) {
            stats.push({ text: s.bottomSizes, highlight: false });
        }

        // Featured color for first 3 tall-specific
        const featColors = ['featured-sage', 'featured-sand', 'featured-clay'];
        const featClass = s.tallSpecific && idx < 3 ? ' ' + featColors[idx % 3] : '';
        const isFaved = favs.includes(s.name);
        const safeName = escapeHtml(s.name);
        const safeDesc = escapeHtml(desc);
        const safeCatLabel = escapeHtml(catLabel);
        const safeGenderLabel = escapeHtml(genderLabel);

        return '<div class="card-wrap">'
            + (hasUrl && safeHref ? '<a class="link-card' + featClass + '" href="' + safeHref + '" target="_blank" rel="noopener noreferrer" aria-label="' + safeName + '">' : '<div class="link-card' + featClass + '">')
            + '<div>'
            + '<div class="link-category">' + safeGenderLabel + ' \u00b7 ' + safeCatLabel + '</div>'
            + '<div class="link-title">' + safeName + '</div>'
            + (desc ? '<div class="link-description">' + safeDesc + '</div>' : '')
            + '</div>'
            + (hasUrl && safeHref ? '<div class="link-action"><span>Visit Store</span>' + arrowSvg + '</div>' : '')
            + '<div class="stats-row">' + stats.map(st => '<span class="stat' + (st.highlight ? ' stat-highlight' : '') + '">' + escapeHtml(st.text) + '</span>').join('') + '</div>'
            + (hasUrl && safeHref ? '</a>' : '</div>')
            + '<button class="fav-btn' + (isFaved ? ' active' : '') + '" onclick="toggleFav(\'' + esc + '\',event)" aria-label="' + (isFaved ? 'Remove from favorites' : 'Save to favorites') + '">' + (isFaved ? '\u2665' : '\u2661') + '</button>'
            + '</div>';
    };

    tallOnly.forEach((s, i) => { html += renderCard(s, i); });

    if (tallOnly.length && mainstream.length) {
        html += '<div class="section-break"><h2 class="section-title">Mainstream With Tall Sizing</h2><div class="section-line"></div></div>';
    }

    mainstream.forEach((s, i) => { html += renderCard(s, i); });

    document.getElementById('storeGrid').innerHTML = html;
}

// ── INIT ─────────────────────────────────────────────────────────────────────
async function initApp() {
    try {
        await loadData();
        sortStores();
        const _total = menStores.length + womenStores.length;
        const _metaText = 'A hand-reviewed directory of ' + _total + ' tall-friendly clothing stores for men and women. Every store verified, every size range confirmed.';
        document.getElementById('metaDesc').setAttribute('content', _metaText);
        document.getElementById('ogDesc').setAttribute('content', _metaText);
        switchTab('home');
    } catch (error) {
        document.getElementById('homepageContent').innerHTML = '<div class="wrap" style="padding-top:24px;padding-bottom:24px;"><p>We could not load the directory data.</p><p style="margin-top:8px;">If you opened this file directly, run it from a local server (for example: <code>python -m http.server 5500</code>) and reload.</p></div>';
    }
}

initApp();
