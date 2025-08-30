(function () {
  // =================== Registry loader (404-safe) ===================
  // Works whether you serve from project root or elsewhere.
  function getRegistryPath() {
    // If URL contains /site/, build absolute path "<root>/registry/registry.json"
    const m = location.pathname.match(/^(.*\/)site(\/|$)/);
    if (m) return m[1] + 'registry/registry.json';
    // Fallback to absolute from the server root
    return '/registry/registry.json';
  }

  async function loadRegistry() {
    const candidates = [
      getRegistryPath(),               // preferred
      '../registry/registry.json',     // relative from /site/*
      './registry/registry.json',      // if registry is under /site/registry
      '/registry/registry.json'        // absolute from site root
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return res.json();
      } catch (_) {}
    }
    throw new Error('Cannot load registry.json');
  }

  // =================== Styles (injected once) ===================
  const BB_STYLE_ID = 'bb-badge-styles';
  function injectBadgeStyles() {
    if (document.getElementById(BB_STYLE_ID)) return;
    const css = `
/* === BugBox HTML-only badge === */
:root{
  --bb-primary:#FF5412;  /* BugBox orange */
  --bb-secondary:#12BDFF;/* BugBox blue   */
  --bb-ink:#0e1a2b; --bb-ink2:#374357;
  --bb-cream:#F7EFE5; --bb-cream-stroke:#EADFCF;
  --bb-deep:#0F3B63;
}
.bb-badge-wrap{ width:520px; margin:16px auto; filter:drop-shadow(0 18px 45px rgba(0,0,0,.12)); }
.bb-pentagon{ position:relative; width:100%; padding-top:120%;
  background:var(--bb-primary);
  clip-path:polygon(50% 0%, 95% 28%, 78% 92%, 22% 92%, 5% 28%);
  border-radius:18px;
}
.bb-pill{ position:absolute; left:50%; top:8%; transform:translateX(-50%);
  background:var(--bb-secondary); color:#fff; font-weight:800; font-size:24px; letter-spacing:1.2px;
  padding:14px 28px; border-radius:16px; z-index:3;
}
.bb-circle{ position:absolute; left:50%; top:36%; width:66%; aspect-ratio:1;
  transform:translate(-50%,-50%); background:var(--bb-deep);
  border-radius:50%; box-shadow: inset 0 0 0 16px rgba(255,255,255,.06);
}
.bb-circle::after{ content:""; position:absolute; inset:8%; border-radius:50%;
  box-shadow: inset 0 0 0 10px rgba(255,255,255,.08);
}
.bb-arc{ position:absolute; inset:0; pointer-events:none; z-index:2; }
.bb-arc span{ position:absolute; left:50%; top:50%; transform-origin:0 0; color:#fff; font-weight:800; }
.bb-arc.top span{ font-size:28px; letter-spacing:0; }     /* no extra spacing: JS positions chars */
.bb-arc.bottom span{ font-size:20px; letter-spacing:0; }

.bb-emblem{ position:absolute; left:50%; top:50%; transform:translate(-50%,-36%);
  width:84px; height:84px; background: var(--bb-primary); border-radius:22px;
  box-shadow:0 0 0 10px rgba(255,255,255,.08); z-index:1;
}

/* Plaque */
.bb-plaque{ position:absolute; left:50%; bottom:6%; transform:translateX(-50%);
  width:78%; background:var(--bb-cream); border:4px solid var(--bb-cream-stroke);
  border-radius:16px; padding:16px 18px; text-align:center;
}
.bb-name{ font-weight:800; font-size:22px; color:var(--bb-ink); }
.bb-divider{ height:0; border-top:3px solid #B44720; width:72%; margin:10px auto; }
.bb-project{ font-weight:700; font-size:14px; color:var(--bb-ink2); letter-spacing:.3px; }
.bb-date{ font-weight:700; font-size:16px; color:var(--bb-ink); letter-spacing:.8px; margin-top:6px; }

.bb-actions{ display:flex; gap:8px; justify-content:center; margin-top:10px; }
.bb-actions button{ border:1px solid #222; background:#222; color:#fff; border-radius:10px; padding:8px 12px; cursor:pointer; }

.card { border:1px solid #e8ecf2; border-radius:12px; padding:16px; background:#fff; }
.muted{ color:#6c778b; }
.error{ color:#b00020; }
.list-item{ display:flex; align-items:center; gap:12px; border:1px solid #e8ecf2; border-radius:10px; padding:10px; margin:10px 0; }
.list-item img{ width:48px; height:48px; object-fit:contain; border-radius:6px; background:#f6f7f9; }
.list-text .title{ font-weight:700; }
.list-text .sub{ color:#5c6675; }
.list-text .small{ font-size:12px; }
.list-item button{ margin-left:auto; }
    `.trim();
    const tag = document.createElement('style');
    tag.id = BB_STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // =================== Curved text (HTML only) ===================
  function bbRenderArc(el, text, radius, startDeg, endDeg) {
    el.innerHTML = '';
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const chars = Array.from(text);
    const start = (startDeg * Math.PI) / 180;
    const end   = (endDeg   * Math.PI) / 180;
    const step  = (end - start) / Math.max(chars.length - 1, 1);

    chars.forEach((ch, i) => {
      const ang = start + step * i;                 // 0° = 3 o’clock, clockwise
      const x = cx + radius * Math.cos(ang);
      const y = cy + radius * Math.sin(ang);
      const span = document.createElement('span');
      span.textContent = ch;
      span.style.transform = `translate(${x}px,${y}px) rotate(${ang + Math.PI/2}rad) translate(-50%,-50%)`;
      el.appendChild(span);
    });
  }

  function bbDrawArcs(circleEl, topText, bottomText) {
    // Wait a frame so layout completes (prevents zero width)
    requestAnimationFrame(() => {
      const box = circleEl.getBoundingClientRect();
      if (!box.width || !box.height) { setTimeout(() => bbDrawArcs(circleEl, topText, bottomText), 16); return; }
      const size = Math.min(box.width, box.height);
      const r = size * 0.38; // a little inside the ring to avoid clipping
      // Top: ~10 o’clock → ~2 o’clock
      bbRenderArc(document.getElementById('bb-arc-top'),    topText,    r, -150, -30);
      // Bottom: ~4 o’clock → ~8 o’clock (reads left→right)
      bbRenderArc(document.getElementById('bb-arc-bottom'), bottomText, r,  210, 330);
    });
  }

  // =================== Badge renderer ===================
  function renderBadge(el, badge) {
    injectBadgeStyles();

    const displayName = (badge.recipient?.name || '').toUpperCase();
    const projectText = (badge.name || 'BUGBOX — CERTIFIED BADGE').toUpperCase();
    const issuedDate = (() => {
      try { return new Date(badge.issuedOn).toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'}).toUpperCase(); }
      catch { return (badge.issuedOn || '').toUpperCase(); }
    })();
    const verifyLink = badge.verifyUrl || (location.origin + location.pathname + '#id=' + badge.id);

    el.innerHTML = `
      <div class="card">
        <div class="bb-badge-wrap" id="bb-badge">
          <div class="bb-pentagon">
            <div class="bb-pill">BUGBOX</div>
            <div class="bb-circle" id="bb-circle">
              <div class="bb-arc top" id="bb-arc-top"></div>
              <div class="bb-arc bottom" id="bb-arc-bottom"></div>
              <div class="bb-emblem"></div>
            </div>
            <div class="bb-plaque">
              <div class="bb-name">${escapeHtml(displayName)}</div>
              <div class="bb-divider"></div>
              <div class="bb-project">${escapeHtml(projectText)}</div>
              <div class="bb-date">${escapeHtml(issuedDate)}</div>
            </div>
          </div>
          <div class="bb-actions">
            <button id="bb-copy">Copy verify link</button>
            <button id="bb-download">Download PNG</button>
          </div>
        </div>
        <p class="muted">Issuer: ${escapeHtml(badge.issuer?.name || '')}${badge.recipient?.email ? ' • ' + escapeHtml(badge.recipient.email) : ''}</p>
      </div>
    `;

    // Draw arcs after layout and on resize
    const draw = () => bbDrawArcs(document.getElementById('bb-circle'), 'BUGBOX', 'CERTIFIED BADGE');
    requestAnimationFrame(draw);
    window.addEventListener('resize', draw, { passive: true });

    // Copy link
    document.getElementById('bb-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(verifyLink);
        const b = document.getElementById('bb-copy');
        b.textContent = 'Copied!';
        setTimeout(() => (b.textContent = 'Copy verify link'), 1200);
      } catch (e) {
        alert('Copy failed: ' + e.message);
      }
    });

    // Download PNG (lazy-load html2canvas)
    document.getElementById('bb-download').addEventListener('click', async () => {
      if (!window.html2canvas) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          s.onload = res; s.onerror = () => rej(new Error('html2canvas failed to load'));
          document.body.appendChild(s);
        });
      }
      const node = document.getElementById('bb-badge');
      const canvas = await window.html2canvas(node, { backgroundColor: null, scale: 2 });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `bugbox-badge-${badge.id}.png`;
      a.click();
    });
  }

  // =================== List/search ===================
  function renderList(el, badges, query) {
    if (badges.length === 0) {
      el.innerHTML = `<p class="muted">No results for "<strong>${escapeHtml(query)}</strong>".</p>`;
      return;
    }
    el.innerHTML = badges.map((b) => `
      <div class="list-item" data-id="${b.id}">
        ${b.image ? `<img src="../${escapeAttr(b.image)}" alt="badge" />` : `<div style="width:48px;height:48px;border-radius:6px;background:#f0f2f5;"></div>`}
        <div class="list-text">
          <div class="title">${escapeHtml(b.name)}</div>
          <div class="sub">${escapeHtml(b.recipient?.name || '')} ${b.recipient?.email ? '(' + escapeHtml(b.recipient.email) + ')' : ''}</div>
          <div class="sub small">${escapeHtml(b.id)}</div>
        </div>
        <button data-open="${b.id}">Open</button>
      </div>`).join('');
    el.querySelectorAll('button[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        location.hash = 'id=' + btn.getAttribute('data-open');
        location.reload();
      });
    });
  }

  function search(reg, q) {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const get = (v) => (v || '').toLowerCase();
    return reg.badges.filter((b) =>
      get(b.id) === query ||
      get(b.id).includes(query) ||
      get(b.recipient?.name).includes(query) ||
      get(b.recipient?.email).includes(query)
    ).slice(0, 30);
  }

  // =================== Escaping helpers ===================
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  // =================== Init ===================
  async function init() {
    const result = document.getElementById('result');
    const reg = await loadRegistry();

    // Deep-link by #id=...
    const hash = new URLSearchParams(location.hash.slice(1));
    const id = hash.get('id');
    if (id) {
      const badge = reg.badges.find((b) => b.id === id);
      if (badge) {
        renderBadge(result, badge);
      } else {
        result.innerHTML = `<p class="muted">Badge not found for id <code>${escapeHtml(id)}</code>.</p>`;
      }
      return;
    }

    // Search UI
    const q = document.getElementById('q');
    const btn = document.getElementById('btnSearch');
    btn.addEventListener('click', () => {
      const items = search(reg, q.value);
      renderList(result, items, q.value);
    });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
  }

  init().catch((err) => {
    const node = document.getElementById('result');
    if (node) node.innerHTML = `<p class="error">Error: ${escapeHtml(err.message)}</p>`;
  });
})();
