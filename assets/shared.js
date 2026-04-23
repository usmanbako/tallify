/*
 * Shared chrome + analytics for static pages (trust pages, SEO landing pages).
 *
 * Populates #siteHeader and #siteFooter with the same layout as the SPA home,
 * renders the consent banner, and attaches the document-level outbound-click
 * listener that emits the same GA4 events as app.js.
 *
 * Expected body attribute: data-page="<slug>" (used as source_page in events).
 */
(function () {
    'use strict';

    var CONSENT_KEY = 'tallfind_analytics_consent';
    var GA_ID = 'G-98C0R7CN01';

    // ── Event helper (matches app.js) ────────────────────────────────────────
    function trackEvent(name, params, opts) {
        try {
            if (localStorage.getItem(CONSENT_KEY) !== 'accepted') return;
            if (typeof gtag !== 'function') return;
            var p = Object.assign({}, params || {});
            if (opts && opts.beacon) p.transport_type = 'beacon';
            gtag('event', name, p);
        } catch (e) { /* ignore */ }
    }
    window.trackEvent = window.trackEvent || trackEvent;

    // ── Header / Footer markup ───────────────────────────────────────────────
    var headerHTML =
        '<header>'
        + '<a class="logo" href="/" aria-label="Tallfind home">Tall<em>find</em></a>'
        + '<nav class="header-nav" aria-label="Directory sections">'
        +   '<a class="pill pill-sm" href="/">Home</a>'
        +   '<a class="pill pill-sm" href="/?tab=men">Men’s</a>'
        +   '<a class="pill pill-sm" href="/?tab=women">Women’s</a>'
        + '</nav>'
        + '<div class="search-wrap">'
        +   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
        +   '<label for="searchShortcut" class="sr-only">Search stores</label>'
        +   '<input type="text" id="searchShortcut" placeholder="Search by store, size, inseam..." readonly onclick="location.href=\'/?tab=men\'">'
        + '</div>'
        + '<div class="header-actions">'
        +   '<a class="pill pill-ghost pill-sm" href="/?modal=submit">+<span class="btn-label"> Submit</span></a>'
        +   '<a class="pill pill-ghost pill-sm" href="/?modal=feedback">✉<span class="btn-label"> Feedback</span></a>'
        + '</div>'
        + '</header>';

    function footerHTML() {
        return '<footer class="hp-footer">'
            + '<div class="hp-footer-inner">'
            +   '<div class="hp-footer-grid">'
            +     '<div class="hp-footer-brand">'
            +       '<div class="hp-footer-logo">Tall<em>find</em></div>'
            +       '<p>Curated tall fashion<br>for men and women.</p>'
            +     '</div>'
            +     '<div class="hp-footer-col">'
            +       '<h5>Directory</h5>'
            +       '<ul>'
            +         '<li><a href="/?tab=men">Men’s Tall</a></li>'
            +         '<li><a href="/?tab=women">Women’s Tall</a></li>'
            +         '<li><a href="/?tab=men&ft=tallSpecific">Tall-Only Brands</a></li>'
            +       '</ul>'
            +     '</div>'
            +     '<div class="hp-footer-col">'
            +       '<h5>Trust</h5>'
            +       '<ul>'
            +         '<li><a href="/about/">About</a></li>'
            +         '<li><a href="/how-we-review/">How We Review</a></li>'
            +         '<li><a href="/privacy/">Privacy</a></li>'
            +         '<li><a href="/terms/">Terms</a></li>'
            +       '</ul>'
            +     '</div>'
            +   '</div>'
            +   '<div class="hp-footer-bottom">'
            +     '<span>© ' + new Date().getFullYear() + ' Tallfind · Some outbound links may be affiliate links. <a href="/how-we-review/#disclosure" style="color:rgba(255,253,246,0.6);text-decoration:underline">How this works</a>.</span>'
            +   '</div>'
            + '</div>'
            + '</footer>';
    }

    // ── Consent banner ───────────────────────────────────────────────────────
    function renderConsentBanner() {
        if (document.getElementById('consentBanner')) return;
        var banner = document.createElement('div');
        banner.id = 'consentBanner';
        banner.className = 'consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-live', 'polite');
        banner.setAttribute('aria-label', 'Analytics consent');
        banner.innerHTML =
            '<div class="consent-title">Privacy settings</div>'
            + '<div class="consent-text">We use analytics to understand site usage and improve Tallfind. You can accept or reject analytics tracking.</div>'
            + '<div class="consent-actions">'
            +   '<button id="consentReject" class="pill pill-sm pill-ghost" type="button">Reject</button>'
            +   '<button id="consentAccept" class="pill pill-sm" type="button">Accept</button>'
            + '</div>';
        document.body.appendChild(banner);

        var configured = false;
        function configureGA() {
            if (configured || typeof gtag !== 'function') return;
            configured = true;
            gtag('config', GA_ID);
        }
        function setConsent(choice) {
            localStorage.setItem(CONSENT_KEY, choice);
            if (typeof gtag === 'function') {
                if (choice === 'accepted') {
                    gtag('consent', 'update', { analytics_storage: 'granted' });
                    configureGA();
                } else {
                    gtag('consent', 'update', {
                        ad_storage: 'denied',
                        analytics_storage: 'denied',
                        ad_user_data: 'denied',
                        ad_personalization: 'denied'
                    });
                }
            }
            banner.classList.remove('open');
        }

        var saved = localStorage.getItem(CONSENT_KEY);
        if (saved === 'accepted') setConsent('accepted');
        else if (saved === 'rejected') setConsent('rejected');
        else banner.classList.add('open');

        document.getElementById('consentAccept').addEventListener('click', function () { setConsent('accepted'); });
        document.getElementById('consentReject').addEventListener('click', function () { setConsent('rejected'); });
    }

    // ── Outbound click tracking ──────────────────────────────────────────────
    function installOutboundTracker() {
        if (window.__tallfindOutboundInstalled) return;
        window.__tallfindOutboundInstalled = true;
        document.addEventListener('click', function (e) {
            var a = e.target.closest ? e.target.closest('a[href]') : null;
            if (!a) return;
            var host;
            try { host = new URL(a.href, location.href).host; } catch (err) { return; }
            if (!host || host === location.host) return;
            var slug = a.dataset.storeSlug || null;
            var name = a.dataset.storeName
                || (a.dataset.store ? decodeURIComponent(a.dataset.store) : null);
            var network = a.dataset.affiliateNetwork || 'none';
            var source = (document.body && document.body.dataset.page) || 'static';
            trackEvent('outbound_click', {
                store_slug: slug,
                store_name: name,
                source_page: source,
                destination_domain: host,
                affiliate_network: network
            }, { beacon: true });
            if (name) {
                trackEvent('visit_store', { store_name: name, tab: source }, { beacon: true });
            }
        });
    }

    // ── Bootstrap ────────────────────────────────────────────────────────────
    function mount() {
        var header = document.getElementById('siteHeader');
        if (header) header.outerHTML = headerHTML;
        var footer = document.getElementById('siteFooter');
        if (footer) footer.outerHTML = footerHTML();
        renderConsentBanner();
        installOutboundTracker();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
