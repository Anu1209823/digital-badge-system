import json, uuid, sys, os, hashlib, hmac, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "registry" / "registry.json"
# Change this to your real site URL (e.g., https://<user>.github.io/digital-badge-system/site)
SITE_BASE = os.environ.get("SITE_BASE", "http://localhost:8000/site")
HMAC_SECRET = os.environ.get("BADGE_HMAC_SECRET", "")  # optional signing

def sign_badge(payload: dict, secret: str) -> dict:
    critical = f"{payload['id']}|{payload['name']}|{payload['recipient']['name']}|{payload['issuedOn']}"
    sig = hmac.new(secret.encode("utf-8"), critical.encode("utf-8"), hashlib.sha256).hexdigest()
    payload["signature"] = {"alg": "HS256", "value": sig}
    return payload

def main():
    if len(sys.argv) < 6:
        print("Usage: python scripts/issue_badge.py <badge_name> <recipient_name> <recipient_email_or_-> <image_rel_path> <comma_separated_skills> [description]")
        sys.exit(1)

    name = sys.argv[1]
    r_name = sys.argv[2]
    r_email = None if sys.argv[3] == "-" else sys.argv[3]
    image_rel = sys.argv[4]
    skills = [s.strip() for s in sys.argv[5].split(",") if s.strip()]
    description = sys.argv[6] if len(sys.argv) > 6 else ""

    with open(REGISTRY, "r", encoding="utf-8") as f:
        reg = json.load(f)

    badge_id = str(uuid.uuid4())
    issued_on = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()

    verify_url = f"{SITE_BASE}/#id={badge_id}"

    badge = {
        "id": badge_id,
        "name": name,
        "description": description,
        "recipient": {"name": r_name, **({"email": r_email} if r_email else {})},
        "issuer": reg.get("issuer", {}),
        "issuedOn": issued_on,
        "skills": skills,
        "image": f"{image_rel}",
        "verifyUrl": verify_url
    }

    if HMAC_SECRET:
        badge = sign_badge(badge, HMAC_SECRET)

    # append into registry
    reg.setdefault("badges", []).append(badge)

    with open(REGISTRY, "w", encoding="utf-8") as f:
        json.dump(reg, f, indent=2, ensure_ascii=False)

    # Also write an individual JSON (optional)
    out_single = ROOT / "registry" / f"{badge_id}.json"
    with open(out_single, "w", encoding="utf-8") as f:
        json.dump(badge, f, indent=2, ensure_ascii=False)

    print(f"Issued badge {badge_id}")
    print(f"Verify at: {verify_url}")

if __name__ == "__main__":
    main()
