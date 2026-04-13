# AGENTS.md

## Cursor Cloud specific instructions

This is a static HTML/CSS/JS website (no build system, no package manager, no dependencies). The product is **Tallfind** — a curated directory of tall clothing stores for men and women.

### Running the dev server

Serve files with Python's built-in HTTP server from the repo root:

```
python3 -m http.server 5500
```

Then open `http://localhost:5500/tall-directory.html` in a browser. The `index.html` just redirects to `tall-directory.html`.

### Key files

| File | Purpose |
|---|---|
| `tall-directory.html` | Main HTML page (entry point) |
| `assets/app.js` | All application logic (tab switching, filtering, rendering) |
| `assets/styles.css` | All styles |
| `data/men.json` | Men's store directory data |
| `data/women.json` | Women's store directory data |
| `data/featured.json` | Featured stores data |
| `index.html` | Redirect stub → `tall-directory.html` |
| `CNAME` | GitHub Pages custom domain (`tallfind.com`) |

### Gotchas

- Opening `tall-directory.html` directly as a file (`file://`) will fail because `fetch()` calls to load JSON data are blocked by CORS. Always use a local HTTP server.
- There are no lint, test, or build commands — the project has zero tooling dependencies.
- Form submissions (Submit a Store / Feedback) POST to Formspree endpoints; these will only work with valid Formspree configuration.
