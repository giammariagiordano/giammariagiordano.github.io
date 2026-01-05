// ===== Config =====
const PUBLICATIONS_URL = 'publications.json';
const SPECIALS_URL = 'specials.json';

// --- helper robusto per risolvere link relativi (funziona anche in sottocartella GitHub Pages)
const resolveHref = (p) => (p ? new URL(p, document.baseURI).toString() : null);

// ===== Helper: estrazione codice J/C + numero (da id/code o dal nome PDF) =====
const extractCode = (p) => {
  const raw = (p.id || p.code || p.pdf || '').toString();
  const m = raw.match(/([JC])\s*(\d+)/i);
  if (!m) return { prefix: 'Z', num: -1 };
  return { prefix: m[1].toUpperCase(), num: parseInt(m[2], 10) };
};

// Ordine dei prefissi nello stesso anno (modifica qui se vuoi C prima di J)
const prefixRank = (prefix) => (prefix === 'J' ? 0 : prefix === 'C' ? 1 : 2);

// ===== Publications Rendering con SCORRIMENTO + bottoni allineati =====
async function loadPublications() {
  const listHost = document.querySelector('#publications-list');
  listHost.innerHTML = '<p class="fade-in">Loading publications…</p>';

  try {
    // cache busting extra (oltre a cache: 'no-store') per evitare caching aggressivo su Pages/CDN
    const bust = `v=${Date.now()}`;
    const resp = await fetch(`${PUBLICATIONS_URL}?${bust}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const pubs = await resp.json();

    // Group by year (desc) + "Unknown" in fondo
    const byYear = pubs.reduce((acc, p) => {
      const y = (p.year !== undefined && p.year !== null && String(p.year).trim() !== '')
        ? String(p.year).trim()
        : 'Unknown';
      (acc[y] ||= []).push(p);
      return acc;
    }, {});

    const years = Object.keys(byYear).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return Number(b) - Number(a); // sort numerico: 2026 prima di 2025
    });

    // Debug utile (apri DevTools Console)
    console.log('[Publications] Loaded:', pubs.length, 'Years:', years);

    // Toolbar (chips anni + bottoni scorrimento)
    const toolbar = document.createElement('div');
    toolbar.className = 'publications-toolbar';

    const chips = document.createElement('div');
    chips.className = 'pub-year-chips';
    const allChip = document.createElement('button');
    allChip.className = 'pub-chip active';
    allChip.textContent = 'All';
    allChip.dataset.year = 'all';
    chips.appendChild(allChip);
    years.forEach(y => {
      const c = document.createElement('button');
      c.className = 'pub-chip';
      c.textContent = y;
      c.dataset.year = y;
      chips.appendChild(c);
    });

    const controls = document.createElement('div');
    controls.className = 'pub-controls';
    const prevBtn = Object.assign(document.createElement('button'), { className: 'pub-btn', innerText: '◀ Prev', type: 'button', 'aria-label': 'Previous' });
    const nextBtn = Object.assign(document.createElement('button'), { className: 'pub-btn', innerText: 'Next ▶', type: 'button', 'aria-label': 'Next' });
    controls.append(prevBtn, nextBtn);

    toolbar.append(chips, controls);

    // Scroller
    const wrap = document.createElement('div');
    wrap.className = 'pub-scroller-wrap';
    const scroller = document.createElement('div');
    scroller.className = 'pub-scroller';
    wrap.appendChild(scroller);

    // Render cards
    function renderCards(filterYear = 'all') {
      scroller.innerHTML = '';
      const items = filterYear === 'all'
        ? pubs
        : pubs.filter(p => String(p.year).trim() === String(filterYear).trim());

      items
        .sort((a, b) => {
          // 1) anno decrescente
          const ay = Number(String(a.year || 0).trim()) || 0;
          const by = Number(String(b.year || 0).trim()) || 0;
          if (ay !== by) return by - ay;

          // 2) entro lo stesso anno: prima per tipo (J poi C), poi per numero decrescente (10 > 9 > 8)
          const ac = extractCode(a);
          const bc = extractCode(b);

          const pr = prefixRank(ac.prefix) - prefixRank(bc.prefix);
          if (pr !== 0) return pr;

          if (ac.num !== bc.num) return bc.num - ac.num;

          // 3) tie-breaker stabile
          return String(a.title || '').localeCompare(String(b.title || ''));
        })
        .forEach(pub => {
          const bestBadge = pub.best_paper ? '<span title="Best Paper" aria-label="Best Paper" style="margin-left:8px">🏆</span>' : '';
          const pdfHref = resolveHref(pub.pdf);
          const pdfBtn = pdfHref
            ? `<a class="btn btn-primary" href="${pdfHref}" download>Download PDF</a>`
            : '';

          const el = document.createElement('div');
          el.className = 'publication-item fade-in';
          el.innerHTML = `
            <div class="publication-meta">
              <div class="publication-content">
                <h3>${pub.title} ${bestBadge}</h3>
                <div class="publication-authors">${pub.authors || ''}</div>
                <div class="publication-venue">${pub.venue || ''}</div>
              </div>
              <div class="publication-actions">
                ${pdfBtn}
              </div>
              <div class="publication-year">${pub.year || ''}</div>
            </div>
          `;
          scroller.appendChild(el);
        });
    }

    // Initial paint
    listHost.innerHTML = '';
    listHost.append(toolbar, wrap);
    renderCards('all');

    // Chip filter
    chips.addEventListener('click', (e) => {
      const btn = e.target.closest('.pub-chip');
      if (!btn) return;
      chips.querySelectorAll('.pub-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      renderCards(btn.dataset.year);
      scroller.scrollTo({ left: 0, behavior: 'instant' });
    });

    // Scroll controls
    const scrollAmount = () => scroller.clientWidth * 0.9;
    prevBtn.addEventListener('click', () => scroller.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => scroller.scrollBy({ left:  scrollAmount(), behavior: 'smooth' }));

    // Keyboard support
    scroller.tabIndex = 0;
    scroller.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') nextBtn.click();
      if (e.key === 'ArrowLeft')  prevBtn.click();
    });

  } catch (err) {
    listHost.innerHTML = `
      <p role="alert" style="line-height:1.6">
        Could not load publications.<br>
        <small>Dettagli: ${String(err)}</small>
      </p>`;
    console.error('Publications load error:', err);
  }
}

// ===== Specials Rendering =====
async function loadSpecials() {
  const container = document.querySelector('#specials-list');
  if (!container) return;
  container.innerHTML = '<p class="fade-in">Loading specials…</p>';
  try {
    const resp = await fetch(SPECIALS_URL, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const items = await resp.json();

    items.sort((a,b) => String(b.year).localeCompare(String(a.year)));

    container.innerHTML = '';
    for (const it of items) {
      const card = document.createElement('article');
      card.className = 'special-card fade-in';
      card.dataset.role = it.role || 'other';
      card.innerHTML = `
        <div class="special-meta">
          <span class="special-venue">${it.venue || ''}</span>
          <span class="special-year">${it.year || ''}</span>
        </div>
        <h3 class="special-title">${it.title || ''}
          ${it.role ? `<span class="role-badge">${it.role}</span>` : ''}
        </h3>
        <div class="special-actions">
          ${it.url ? `<a class="btn btn-primary" href="${it.url}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}
        </div>
      `;
      container.appendChild(card);
    }
  } catch (err) {
    container.innerHTML = '<p role="alert">Could not load specials. Please try again later.</p>';
    console.error('Specials load error:', err);
  }
}

// ===== Obfuscated email button =====
function setupObfuscatedEmailButton() {
  const btn = document.getElementById('btn-contact');
  if (!btn) return;
  const b64 = 'Z2lhbW1hcmlhLmdpb3JkYW5vQHVuaXNhLml0';
  const email = atob(b64);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const subject = encodeURIComponent('Hello Giammaria');
    window.location.href = `mailto:${email}?subject=${subject}`;
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadPublications();
  loadSpecials();
  setupObfuscatedEmailButton();
});
