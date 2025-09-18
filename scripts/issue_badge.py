#!/usr/bin/env python3
# scripts/issue_badge.py
# Issue a BugBox badge, update registry/registry.json,
# and write registry/<uuid>.json

import argparse
import datetime
import hashlib
import hmac
import json
import os
import sys
import uuid
from pathlib import Path


# --- Paths ---
SCRIPT_PATH = Path(__file__).resolve()
# assumes this file is repo/scripts/issue_badge.py
ROOT = SCRIPT_PATH.parents[1]
REGISTRY_DIR = ROOT / "registry"
REGISTRY_JSON = REGISTRY_DIR / "registry.json"


# --- Env ---
# Default points at your GitHub Pages site
SITE_BASE = os.environ.get(
    "SITE_BASE",
    "https://anu1209823.github.io/digital-badge-system/site/"
).rstrip("/")
# Optional HMAC signing key
HMAC_SECRET = os.environ.get("BADGE_HMAC_SECRET", "")


# --- Helpers ---
def sign_badge(payload: dict, secret: str) -> dict:
    """Attach an HMAC signature over critical fields."""
    critical = (
        f"{payload['id']}|"
        f"{payload['name']}|"
        f"{payload['recipient'].get('name', '')}|"
        f"{payload['issuedOn']}"
    )
    sig = hmac.new(
        secret.encode("utf-8"),
        critical.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    payload["signature"] = {"alg": "HS256", "value": sig}
    return payload


def load_registry() -> dict:
    """Load registry.json or create a minimal one if missing/corrupt."""
    REGISTRY_DIR.mkdir(parents=True, exist_ok=True)

    if REGISTRY_JSON.exists():
        try:
            with REGISTRY_JSON.open("r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("registry.json is not a JSON object")
        except Exception:
            # backup and start fresh
            try:
                backup = REGISTRY_JSON.with_suffix(".json.bak")
                REGISTRY_JSON.replace(backup)
                print(
                    "Warn: registry.json was invalid; backed up to "
                    f"{backup.name}",
                    file=sys.stderr
                )
            except Exception:
                print(
                    "Warn: failed to backup invalid registry.json; "
                    "continuing with a fresh file",
                    file=sys.stderr
                )
            data = {
                "issuer": {"name": "BugBox", "website": ""},
                "badges": []
            }
    else:
        data = {
            "issuer": {"name": "BugBox", "website": ""},
            "badges": []
        }

    data.setdefault("issuer", {"name": "BugBox", "website": ""})
    data.setdefault("badges", [])
    return data


def save_registry(reg: dict) -> None:
    with REGISTRY_JSON.open("w", encoding="utf-8") as f:
        json.dump(reg, f, indent=2, ensure_ascii=False)


def write_single_badge(badge: dict) -> Path:
    out_single = REGISTRY_DIR / f"{badge['id']}.json"
    with out_single.open("w", encoding="utf-8") as f:
        json.dump(badge, f, indent=2, ensure_ascii=False)
    return out_single


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=(
            "Issue a BugBox badge and update registry/registry.json"
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    p.add_argument("badge_name", help="Badge display name")
    p.add_argument("recipient_name", help="Recipient full name")
    p.add_argument(
        "recipient_email_or_dash",
        help="Recipient email, or '-' for none"
    )
    p.add_argument(
        "image_rel_path",
        help=(
            "Image path relative to the site/repo "
            "(e.g. assets/badges/sample.png)"
        )
    )
    p.add_argument(
        "skills_csv",
        help="Comma-separated skills (e.g. 'Figma, Colour theory')"
    )
    p.add_argument(
        "description",
        nargs="?",
        default="",
        help="Optional description"
    )
    p.add_argument(
        "--issuer-name",
        default=None,
        help="Override issuer.name (else use registry.issuer.name)"
    )
    p.add_argument(
        "--issuer-website",
        default=None,
        help="Override issuer.website (else use registry.issuer.website)"
    )
    return p.parse_args()


# --- Main ---
def main() -> int:
    args = parse_args()

    reg = load_registry()

    issuer = {
        "name": (
            args.issuer_name
            if args.issuer_name is not None
            else reg.get("issuer", {}).get("name", "BugBox")
        ),
        "website": (
            args.issuer_website
            if args.issuer_website is not None
            else reg.get("issuer", {}).get("website", "")
        )
    }

    badge_id = str(uuid.uuid4())
    issued_on = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc
    ).isoformat()
    recipient_email = (
        None
        if args.recipient_email_or_dash == "-"
        else args.recipient_email_or_dash
    )
    skills = [s.strip() for s in args.skills_csv.split(",") if s.strip()]

    verify_url = f"{SITE_BASE}#id={badge_id}"

    badge = {
        "id": badge_id,
        "name": args.badge_name,
        "description": args.description,
        "recipient": {
            "name": args.recipient_name,
            **({"email": recipient_email} if recipient_email else {})
        },
        "issuer": issuer,
        "issuedOn": issued_on,
        "skills": skills,
        "image": args.image_rel_path,
        "verifyUrl": verify_url
    }

    if HMAC_SECRET:
        if len(HMAC_SECRET) < 16:
            print(
                "ERROR: BADGE_HMAC_SECRET is too short; please set a longer "
                "secret (>=16 chars).",
                file=sys.stderr
            )
            return 2
        badge = sign_badge(badge, HMAC_SECRET)

    # Update registry (newest first, ensure unique by id)
    badges = reg.get("badges", [])
    badges = [b for b in badges if b.get("id") != badge_id]
    badges.insert(0, badge)
    reg["badges"] = badges
    reg["issuer"] = issuer

    # Write files
    save_registry(reg)
    single_path = write_single_badge(badge)

    # Output
    print(f"Issued badge {badge_id}")
    print(f"Wrote: {single_path.relative_to(ROOT)}")
    print(f"Wrote: {REGISTRY_JSON.relative_to(ROOT)}")
    print(f"Verify at: {verify_url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
