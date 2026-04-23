/*
 * Affiliate URL transform + slug helper.
 *
 * Reads data/affiliates.json at load. Each store, keyed by slug, can declare:
 *   {
 *     "network": "amazon" | "impact" | "skimlinks" | "cj" | null,
 *     "id":      "<affiliate-id-or-tag>" | null,
 *     "params":  { "key": "value", ... } | null
 *   }
 *
 * Stores without an entry pass through unchanged — nothing breaks when a
 * brand hasn't been signed up yet.
 */
(function (global) {
    'use strict';

    var config = {};
    var ready = fetch('data/affiliates.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; })
        .then(function (c) { config = c || {}; return config; });

    function slugFor(store) {
        if (!store) return null;
        if (store.slug) return String(store.slug);
        if (!store.name) return null;
        return String(store.name)
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function transform(rawUrl, cfg) {
        if (!rawUrl) return rawUrl;
        if (!cfg || typeof cfg !== 'object') return rawUrl;
        try {
            var u = new URL(rawUrl);
            if (cfg.network === 'amazon' && cfg.id) {
                u.searchParams.set('tag', cfg.id);
            }
            if (cfg.params && typeof cfg.params === 'object') {
                Object.keys(cfg.params).forEach(function (k) {
                    u.searchParams.set(k, cfg.params[k]);
                });
            }
            return u.toString();
        } catch (e) {
            return rawUrl;
        }
    }

    global.Tallfind = global.Tallfind || {};
    global.Tallfind.affiliates = {
        ready: ready,
        getConfig: function () { return config; },
        slugFor: slugFor,
        affiliateUrl: function (store) {
            if (!store || !store.url) return null;
            var slug = slugFor(store);
            var cfg = slug ? config[slug] : null;
            return transform(store.url, cfg);
        },
        networkFor: function (store) {
            var slug = slugFor(store);
            var cfg = slug ? config[slug] : null;
            return (cfg && cfg.network) || 'none';
        }
    };
})(window);
