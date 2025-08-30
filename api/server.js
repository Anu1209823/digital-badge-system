import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const ROOT = path.join(__dirname, '..');
const REGISTRY = path.join(ROOT, 'registry', 'registry.json');
const HMAC_SECRET = process.env.BADGE_HMAC_SECRET || '';

// Helpers
function loadRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
}
function saveRegistry(reg) {
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2));
}
function signBadge(b) {
  if (!HMAC_SECRET) return b;
  const critical = `${b.id}|${b.name}|${b.recipient?.name || ''}|${b.issuedOn}`;
  const value = crypto.createHmac('sha256', HMAC_SECRET).update(critical).digest('hex');
  b.signature = { alg: 'HS256', value };
  return b;
}

// GET /verify/:id
app.get('/verify/:id', (req, res) => {
  const reg = loadRegistry();
  const badge = reg.badges.find(b => b.id === req.params.id);
  if (!badge) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, badge });
});

// POST /issue
// { name, recipientName, recipientEmail, image, skills:[], description? }
app.post('/issue', (req, res) => {
  const { name, recipientName, recipientEmail, image, skills, description } = req.body || {};
  if (!name || !recipientName || !image || !Array.isArray(skills)) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  const reg = loadRegistry();
  const id = uuidv4();
  const issuedOn = new Date().toISOString();
  const badge = signBadge({
    id,
    name,
    description: description || '',
    recipient: { name: recipientName, ...(recipientEmail ? { email: recipientEmail } : {}) },
    issuer: reg.issuer || {},
    issuedOn,
    skills,
    image,
    verifyUrl: `#id=${id}`
  });
  reg.badges.push(badge);
  saveRegistry(reg);
  // Also write a per-badge file
  fs.writeFileSync(path.join(__dirname, '..', 'registry', `${id}.json`), JSON.stringify(badge, null, 2));
  res.json({ ok: true, badge });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Badge API on http://localhost:${PORT}`));
