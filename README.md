# Digital Badge System (Starter)

This is a tiny, static badge registry + verification page, plus a simple CLI (and optional Node API) to issue badges.
It works locally or on any static host (GitHub Pages, S3).

## Structure
```
assets/badges/        # put your badge images here (PNG/SVG)
registry/registry.json# public append-only registry of badges
schema/badge.schema.json
site/index.html       # search + verify UI (fetches registry.json)
site/verify.js
site/styles.css
scripts/issue_badge.py# CLI to issue a badge and update registry.json
api/server.js         # optional REST API for issuing/verifying
api/package.json
```

## Run locally
From the project root:
```bash
# start a local static server (Python 3)
python -m http.server 8000

# open the site:
# http://localhost:8000/site/

# issue a badge (Windows PowerShell: use $env:NAME=value)
export SITE_BASE="http://localhost:8000/site"
python scripts/issue_badge.py "BugBox Design – Bronze" "Alice Student" alice@example.com assets/badges/sample.png "Figma,Colour theory,BugBox style" "Completed initial design"
```

## GitHub Pages
- Push this folder to a GitHub repo (e.g., `digital-badge-system`).
- In Settings → Pages: deploy from the main branch, root (or set to serve the repo root).
- Set `SITE_BASE` to your pages URL (e.g., `https://<user>.github.io/digital-badge-system/site`) when issuing.

## AWS S3 (static site)
- Create an S3 bucket with static website hosting enabled.
- Upload everything, keep folder structure.
- Make objects public (read-only).
- Set `SITE_BASE` to the S3 website URL before issuing badges.
