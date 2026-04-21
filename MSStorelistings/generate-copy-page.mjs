/**
 * generate-copy-page.mjs
 *
 * Reads all 41 non-English language listing CSVs, parses them, and generates
 * a self-contained HTML copy-paste interface for Microsoft Store Partner Center.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Language definitions — exact Partner Center order (41 non-English languages)
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { display: 'Bangla',                file: 'bengaliListing.csv' },
  { display: 'Bulgarian',             file: 'bulgarianListing.csv' },
  { display: 'Chinese (Simplified)',  file: 'chineseSimplifiedListing.csv' },
  { display: 'Croatian',              file: 'croatianListing.csv' },
  { display: 'Czech',                 file: 'czechListing.csv' },
  { display: 'Danish',                file: 'danishListing.csv' },
  { display: 'Dutch',                 file: 'dutchListing.csv' },
  { display: 'Estonian',              file: 'estonianListing.csv' },
  { display: 'Finnish',               file: 'finnishListing.csv' },
  { display: 'Filipino',              file: 'filipinoListing.csv' },
  { display: 'French',                file: 'frenchListing.csv' },
  { display: 'German',                file: 'germanListing.csv' },
  { display: 'Greek',                 file: 'greekListing.csv' },
  { display: 'Hindi',                 file: 'hindiListing.csv' },
  { display: 'Icelandic',             file: 'icelandicListing.csv' },
  { display: 'Hungarian',             file: 'hungarianListing.csv' },
  { display: 'Indonesian',            file: 'indonesianListing.csv' },
  { display: 'Italian',               file: 'italianListing.csv' },
  { display: 'Japanese',              file: 'japaneseListing.csv' },
  { display: 'Korean',                file: 'koreanListing.csv' },
  { display: 'Latvian',               file: 'latvianListing.csv' },
  { display: 'Lithuanian',            file: 'lithuanianListing.csv' },
  { display: 'Malay',                 file: 'malayListing.csv' },
  { display: 'Marathi',               file: 'marathiListing.csv' },
  { display: 'Norwegian',             file: 'norwegianListing.csv' },
  { display: 'Polish',                file: 'polishListing.csv' },
  { display: 'Portuguese',            file: 'portugueseListing.csv' },
  { display: 'Romanian',              file: 'romanianListing.csv' },
  { display: 'Russian',               file: 'russianListing.csv' },
  { display: 'Serbian',               file: 'serbianListing.csv' },
  { display: 'Slovak',                file: 'slovakListing.csv' },
  { display: 'Slovenian',             file: 'slovenianListing.csv' },
  { display: 'Spanish',               file: 'spanishListing.csv' },
  { display: 'Kiswahili',             file: 'swahiliListing.csv' },
  { display: 'Swedish',               file: 'swedishListing.csv' },
  { display: 'Tamil',                 file: 'tamilListing.csv' },
  { display: 'Telugu',                file: 'teluguListing.csv' },
  { display: 'Thai',                  file: 'thaiListing.csv' },
  { display: 'Turkish',               file: 'turkishListing.csv' },
  { display: 'Ukrainian',             file: 'ukrainianListing.csv' },
  { display: 'Vietnamese',            file: 'vietnameseListing.csv' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CSV parser — handles quoted fields with embedded newlines and escaped quotes
// ─────────────────────────────────────────────────────────────────────────────
function parseCSV(text) {
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const rows = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row = [];

    while (i < len) {
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
        row.push(field);
      } else {
        // Unquoted field
        let field = '';
        while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i];
          i++;
        }
        row.push(field);
      }

      if (i < len && text[i] === ',') {
        i++; // consume comma, read next field
      } else {
        break; // end of row
      }
    }

    // Consume line ending
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;

    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row);
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load and parse all language files
// Returns: { display, fields: { fieldName -> value } }[]
// ─────────────────────────────────────────────────────────────────────────────
function loadLanguages() {
  const result = [];

  for (const { display, file } of LANGUAGES) {
    const filepath = path.join(__dirname, file);

    if (!fs.existsSync(filepath)) {
      console.error(`ERROR: File not found: ${filepath}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(filepath, 'utf8');
    const rows = parseCSV(raw);

    if (rows.length < 2) {
      console.error(`ERROR: File has insufficient data: ${file}`);
      process.exit(1);
    }

    // Skip header row (index 0), extract field -> value from data rows
    const fields = {};
    for (const row of rows.slice(1)) {
      const fieldName = row[0] || '';
      const value     = row[2] !== undefined ? row[2] : '';
      if (fieldName) {
        fields[fieldName] = value;
      }
    }

    result.push({ display, fields });
    console.log(`  Loaded ${display}: ${Object.keys(fields).length} fields`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML escaping
// ─────────────────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Escape for inline JS string literals (inside JSON.stringify-like contexts)
function escJS(str) {
  if (!str) return '';
  return JSON.stringify(str);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the language slug used as an HTML id
// ─────────────────────────────────────────────────────────────────────────────
function slug(display) {
  return display.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate field blocks for one language
// ─────────────────────────────────────────────────────────────────────────────
function buildFieldBlock(langSlug, fieldKey, label, value, idx) {
  if (!value || !value.trim()) return '';

  const id = `${langSlug}-${idx}`;
  const escaped = esc(value);
  const jsValue = escJS(value);

  return `
        <div class="field-block" id="${id}">
          <div class="field-header">
            <span class="field-label">${esc(label)}</span>
            <button class="copy-btn" onclick="copyField(${jsValue}, this)" title="Copy to clipboard">Copy</button>
          </div>
          <div class="field-value">${escaped}</div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build one language section
// ─────────────────────────────────────────────────────────────────────────────
function buildLanguageSection(lang, langIndex) {
  const { display, fields } = lang;
  const langSlug = slug(display);
  let fieldIdx = 0;

  // Collect all fields for "Copy All" functionality
  const allParts = [];
  let blocks = '';

  // 1. Description
  const description = fields['Description'] || '';
  if (description.trim()) {
    fieldIdx++;
    blocks += buildFieldBlock(langSlug, 'Description', 'Description', description, fieldIdx);
    allParts.push({ label: 'Description', value: description });
  }

  // 2. What's New
  const whatsNew = fields['WhatsNew'] || '';
  if (whatsNew.trim()) {
    fieldIdx++;
    blocks += buildFieldBlock(langSlug, 'WhatsNew', "What's new", whatsNew, fieldIdx);
    allParts.push({ label: "What's new", value: whatsNew });
  }

  // 3. Short Description
  const shortDesc = fields['ShortDescription'] || '';
  if (shortDesc.trim()) {
    fieldIdx++;
    blocks += buildFieldBlock(langSlug, 'ShortDescription', 'Short Description', shortDesc, fieldIdx);
    allParts.push({ label: 'Short Description', value: shortDesc });
  }

  // 4. Product Features 1-10
  for (let i = 1; i <= 10; i++) {
    const val = fields[`ProductFeatures${i}`] || '';
    if (val.trim()) {
      fieldIdx++;
      blocks += buildFieldBlock(langSlug, `ProductFeatures${i}`, `Product Feature ${i}`, val, fieldIdx);
      allParts.push({ label: `Product Feature ${i}`, value: val });
    }
  }

  // 5. Search Terms 1-7
  for (let i = 1; i <= 7; i++) {
    const val = fields[`SearchTerms${i}`] || '';
    if (val.trim()) {
      fieldIdx++;
      blocks += buildFieldBlock(langSlug, `SearchTerms${i}`, `Search Term ${i}`, val, fieldIdx);
      allParts.push({ label: `Search Term ${i}`, value: val });
    }
  }

  // 6. Applicable license terms
  const license = fields['Applicable license terms'] || '';
  if (license.trim()) {
    fieldIdx++;
    blocks += buildFieldBlock(langSlug, 'LicenseTerms', 'Applicable license terms', license, fieldIdx);
    allParts.push({ label: 'Applicable license terms', value: license });
  }

  // Build "Copy All" JS payload
  const copyAllText = allParts.map(p => `=== ${p.label} ===\n${p.value}`).join('\n\n');
  const copyAllJS = escJS(copyAllText);

  return `
    <section class="lang-section" id="lang-${langSlug}" data-lang-index="${langIndex}">
      <div class="lang-header">
        <div class="lang-title-row">
          <label class="done-check" title="Mark as done">
            <input type="checkbox" class="lang-done-checkbox" data-lang="${langSlug}" onchange="toggleDone('${langSlug}', this.checked)">
            <span class="checkmark"></span>
          </label>
          <h2 class="lang-name">${esc(display)}</h2>
          <span class="lang-badge">${langIndex + 1} / 41</span>
        </div>
        <button class="copy-all-btn" onclick="copyAll(${copyAllJS}, '${langSlug}', this)">Copy All Fields</button>
      </div>
      <div class="lang-fields">
${blocks}
      </div>
    </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build navigation sidebar
// ─────────────────────────────────────────────────────────────────────────────
function buildNav(languages) {
  const items = languages.map((lang, i) => {
    const langSlug = slug(lang.display);
    return `      <a href="#lang-${langSlug}" class="nav-item" data-nav-lang="${langSlug}" onclick="highlightNav('${langSlug}')">${esc(lang.display)}</a>`;
  }).join('\n');

  return `    <nav class="lang-nav" id="langNav">
${items}
    </nav>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the complete HTML
// ─────────────────────────────────────────────────────────────────────────────
function buildHTML(languages) {
  const nav = buildNav(languages);

  const sections = languages.map((lang, i) => buildLanguageSection(lang, i)).join('\n');

  const allSlugs = JSON.stringify(languages.map(l => slug(l.display)));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wohnly — MS Store Listings Copy Tool</title>
  <style>
    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-page:       #1a1a1d;
      --bg-card:       #232327;
      --bg-field:      #2a2a2e;
      --bg-nav:        #1e1e22;
      --bg-header:     #111114;
      --accent:        #0078d4;
      --accent-hover:  #006cbf;
      --accent-done:   #107c10;
      --text-primary:  #e8e8e8;
      --text-secondary:#a0a0a8;
      --text-label:    #7878a0;
      --border:        #38383f;
      --border-hover:  #505060;
      --success:       #4ec94e;
      --radius-sm:     6px;
      --radius-md:     10px;
      --radius-lg:     14px;
      --shadow:        0 2px 12px rgba(0,0,0,0.4);
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: var(--bg-page);
      color: var(--text-primary);
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
    }

    /* ── Sticky Header ── */
    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--bg-header);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .site-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      flex-shrink: 0;
    }

    .progress-bar-wrap {
      flex: 1;
      min-width: 200px;
    }

    .progress-text {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 5px;
    }

    .progress-track {
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--accent-done);
      border-radius: 3px;
      transition: width 0.3s ease;
      width: 0%;
    }

    .reset-btn {
      padding: 6px 14px;
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 12px;
      transition: border-color 0.15s, color 0.15s;
    }

    .reset-btn:hover {
      border-color: var(--border-hover);
      color: var(--text-primary);
    }

    /* ── Navigation ── */
    .lang-nav {
      background: var(--bg-nav);
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .nav-item {
      display: inline-block;
      padding: 5px 12px;
      background: var(--bg-field);
      border: 1px solid var(--border);
      border-radius: 20px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 12px;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .nav-item:hover {
      background: var(--border);
      color: var(--text-primary);
    }

    .nav-item.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .nav-item.done {
      border-color: var(--accent-done);
      color: var(--accent-done);
    }

    .nav-item.done.active {
      background: var(--accent-done);
      border-color: var(--accent-done);
      color: #fff;
    }

    /* ── Main Content ── */
    .main-content {
      max-width: 900px;
      margin: 0 auto;
      padding: 28px 20px 60px;
    }

    /* ── Language Section ── */
    .lang-section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      margin-bottom: 28px;
      overflow: hidden;
      scroll-margin-top: 120px;
      transition: border-color 0.2s;
    }

    .lang-section.is-done {
      border-color: #1e4a1e;
    }

    .lang-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding: 16px 20px;
      background: var(--bg-field);
      border-bottom: 1px solid var(--border);
    }

    .lang-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .lang-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .lang-badge {
      font-size: 11px;
      color: var(--text-label);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2px 9px;
    }

    /* ── Done Checkbox ── */
    .done-check {
      position: relative;
      display: inline-flex;
      align-items: center;
      cursor: pointer;
    }

    .done-check input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .checkmark {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border);
      border-radius: 5px;
      background: var(--bg-card);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s, background 0.15s;
      flex-shrink: 0;
    }

    .done-check input:checked + .checkmark {
      background: var(--accent-done);
      border-color: var(--accent-done);
    }

    .checkmark::after {
      content: '';
      display: none;
      width: 5px;
      height: 9px;
      border: 2px solid #fff;
      border-top: none;
      border-left: none;
      transform: rotate(45deg) translateY(-1px);
    }

    .done-check input:checked + .checkmark::after {
      display: block;
    }

    /* ── Copy All Button ── */
    .copy-all-btn {
      padding: 8px 18px;
      background: var(--accent);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .copy-all-btn:hover { background: var(--accent-hover); }

    .copy-all-btn.copied {
      background: var(--accent-done);
    }

    /* ── Field Blocks ── */
    .lang-fields {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .field-block {
      background: var(--bg-field);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .field-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-card);
    }

    .field-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-label);
    }

    .copy-btn {
      padding: 4px 12px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      white-space: nowrap;
    }

    .copy-btn:hover {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .copy-btn.copied {
      color: var(--success);
      border-color: var(--success);
    }

    .field-value {
      padding: 12px 14px;
      color: var(--text-primary);
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      user-select: text;
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-page); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-hover); }
  </style>
</head>
<body>

  <header class="site-header">
    <div class="site-title">Wohnly — MS Store Listings</div>
    <div class="progress-bar-wrap">
      <div class="progress-text" id="progressText">0 of 41 languages completed</div>
      <div class="progress-track">
        <div class="progress-fill" id="progressFill"></div>
      </div>
    </div>
    <button class="reset-btn" onclick="resetAll()">Reset all</button>
  </header>

${nav}

  <main class="main-content">
${sections}
  </main>

  <script>
    // ── Constants ──
    const TOTAL = 41;
    const ALL_SLUGS = ${allSlugs};
    const LS_KEY = 'wohnly-store-done';

    // ── State ──
    function loadDone() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    }

    function saveDone(doneMap) {
      localStorage.setItem(LS_KEY, JSON.stringify(doneMap));
    }

    // ── Progress UI ──
    function updateProgress() {
      const done = loadDone();
      const count = ALL_SLUGS.filter(s => done[s]).length;
      document.getElementById('progressText').textContent =
        count + ' of ' + TOTAL + ' languages completed';
      const pct = (count / TOTAL) * 100;
      document.getElementById('progressFill').style.width = pct + '%';
    }

    // ── Mark done / undone ──
    function toggleDone(langSlug, checked) {
      const done = loadDone();
      if (checked) {
        done[langSlug] = true;
      } else {
        delete done[langSlug];
      }
      saveDone(done);
      updateProgress();
      updateNavDone(langSlug, checked);
      const section = document.getElementById('lang-' + langSlug);
      if (section) section.classList.toggle('is-done', checked);
    }

    function updateNavDone(langSlug, isDone) {
      const navItem = document.querySelector('[data-nav-lang="' + langSlug + '"]');
      if (navItem) navItem.classList.toggle('done', isDone);
    }

    function resetAll() {
      if (!confirm('Reset all progress? This cannot be undone.')) return;
      localStorage.removeItem(LS_KEY);
      // Uncheck all checkboxes
      document.querySelectorAll('.lang-done-checkbox').forEach(cb => { cb.checked = false; });
      document.querySelectorAll('.lang-section').forEach(s => s.classList.remove('is-done'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('done'));
      updateProgress();
    }

    // ── Copy helpers ──
    function copyField(text, btn) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 1800);
      }).catch(() => {
        // Fallback for older browsers / non-HTTPS
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 1800);
      });
    }

    function copyAll(text, langSlug, btn) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'All Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy All Fields';
          btn.classList.remove('copied');
        }, 2200);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = 'All Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy All Fields';
          btn.classList.remove('copied');
        }, 2200);
      });
    }

    // ── Nav highlight ──
    function highlightNav(langSlug) {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const item = document.querySelector('[data-nav-lang="' + langSlug + '"]');
      if (item) item.classList.add('active');
    }

    // Intersection Observer to auto-highlight nav as user scrolls
    (function setupScrollHighlight() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id; // lang-<slug>
            const langSlug = id.replace('lang-', '');
            highlightNav(langSlug);
          }
        });
      }, { threshold: 0.15, rootMargin: '-100px 0px -60% 0px' });

      document.querySelectorAll('.lang-section').forEach(section => {
        observer.observe(section);
      });
    })();

    // ── Init: restore saved state ──
    (function init() {
      const done = loadDone();
      ALL_SLUGS.forEach(langSlug => {
        if (done[langSlug]) {
          // Check checkbox
          const cb = document.querySelector('[data-lang="' + langSlug + '"]');
          if (cb) cb.checked = true;
          // Mark section
          const section = document.getElementById('lang-' + langSlug);
          if (section) section.classList.add('is-done');
          // Mark nav
          updateNavDone(langSlug, true);
        }
      });
      updateProgress();
    })();
  </script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
function main() {
  console.log('Loading language CSV files...');
  const languages = loadLanguages();
  console.log(`\nLoaded ${languages.length} languages.`);

  console.log('\nGenerating HTML...');
  const html = buildHTML(languages);

  const outputPath = path.join(__dirname, 'copy-listings.html');
  fs.writeFileSync(outputPath, html, 'utf8');

  console.log(`\nDone! Written to: ${outputPath}`);
  console.log(`  File size: ${(html.length / 1024).toFixed(1)} KB`);
  console.log(`  Languages included: ${languages.length}`);
}

main();
