/* ================================================================
   คลังสื่อ ครูหนังสือ — app.js
   ระบบคลังสื่อออนไลน์ ดึงข้อมูลจาก Google Sheet CSV
   ================================================================ */

// ============================================================
// ⚙️  CONFIG — แก้ไขค่านี้ให้ตรงกับ Google Sheet ของคุณ
// ============================================================
const CONFIG = {
  SHEET_ID: '1scny0PCCVtcjEz4e6LHsqiE46CEWy6Hh_NY7XMFP4i0',   // เช่น '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'
  SHEET_NAME: 'Sheet1',                          // ชื่อชีต (tab) ที่ต้องการ
  SKELETON_COUNT: 8,                             // จำนวน skeleton card ระหว่างโหลด
};
// ============================================================

// ---------- DOM Elements ----------
const cardGrid = document.getElementById('cardGrid');
const searchInput = document.getElementById('searchInput');
const resultCount = document.getElementById('resultCount');
const lightboxOverlay = document.getElementById('lightboxOverlay');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxIframe = document.getElementById('lightboxIframe');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');
const btnTop = document.getElementById('btnTop');
const installBanner = document.getElementById('installBanner');
const btnInstall = document.getElementById('btnInstall');
const btnDismiss = document.getElementById('btnDismiss');

// ---------- State ----------
let allItems = [];         // ข้อมูลทั้งหมดจาก Google Sheet
let filteredItems = [];    // ข้อมูลหลังกรอง
let deferredPrompt = null; // สำหรับ PWA install

// ================================================================
//  📡 Fetch & Parse Google Sheet CSV
// ================================================================
function getCSVUrl() {
  const sheetNameEncoded = encodeURIComponent(CONFIG.SHEET_NAME);
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetNameEncoded}`;
}

async function fetchSheetData() {
  showSkeleton();

  try {
    const url = getCSVUrl();
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const csvText = await response.text();
    const items = parseCSV(csvText);

    if (items.length === 0) {
      showEmptyState('ไม่พบข้อมูล', 'Google Sheet ของคุณอาจว่างเปล่า หรือยังไม่ได้เผยแพร่ (Publish)');
      return;
    }

    allItems = items.reverse();
    filteredItems = [...allItems];
    renderCards(filteredItems);
    updateCount(filteredItems.length);

  } catch (err) {
    console.error('fetchSheetData error:', err);

    if (CONFIG.SHEET_ID.includes('ใส่_GOOGLE_SHEET_ID')) {
      showConfigError();
    } else {
      showErrorState();
    }
  }
}

// ---- Parse CSV → array of objects ----
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return []; // ต้องมี header + data อย่างน้อย 1 แถว

  const items = [];

  // ข้ามแถว header (แถวแรก)
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 4) continue;

    const order = cols[0].trim().replace(/^"|"$/g, '');
    const type = cols[1].trim().replace(/^"|"$/g, '').toLowerCase().trim();
    const label = cols[2].trim().replace(/^"|"$/g, '');
    const url = cols[3].trim().replace(/^"|"$/g, '');

    if (!label && !url) continue; // ข้ามแถวว่าง

    items.push({ order, type, label, url });
  }

  return items;
}

// CSV line parser รองรับ comma ใน quoted fields
function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ================================================================
//  🎨 Render Cards
// ================================================================
function renderCards(items) {
  cardGrid.innerHTML = '';

  if (items.length === 0) {
    cardGrid.innerHTML = `
      <div class="no-results">
        <span class="no-icon">🔍</span>
        <p>ไม่พบสื่อที่ค้นหา ลองพิมพ์ใหม่นะคะ</p>
      </div>`;
    return;
  }

  items.forEach((item, index) => {
    const card = createCard(item, index);
    cardGrid.appendChild(card);
  });
}

function createCard(item, index) {
  const isImage = item.type === 'image';
  const isCanva = item.type === 'canva';
  const isDrive = item.type === 'drive';

  const card = document.createElement('div');
  card.className = 'media-card';
  card.style.animationDelay = `${index * 0.07}s`;
  card.setAttribute('data-label', item.label.toLowerCase());

  // Thumb / Placeholder
  let thumbHTML = '';
  if (isImage && item.url) {
    thumbHTML = `
      <div class="card-thumb-wrap">
        <img
          class="card-thumb"
          src="${escapeAttr(item.url)}"
          alt="${escapeAttr(item.label)}"
          loading="lazy"
          onerror="this.parentElement.innerHTML='<div class=\\'card-link-placeholder\\'>🖼️</div>'"
        />
        <span class="card-badge badge-image">รูปภาพ</span>
      </div>`;
  } else {
    // Link type — แสดง placeholder สวยๆ
    const emoji = getLinkEmoji(item.label, item.url);
    let badgeClass = 'badge-link';
    let badgeText = 'ลิงก์';
    
    if (isCanva) {
      badgeClass = 'badge-canva';
      badgeText = 'Canva';
    } else if (isDrive) {
      badgeClass = 'badge-drive';
      badgeText = 'Drive';
    }
    
    thumbHTML = `
      <div class="card-thumb-wrap">
        <div class="card-link-placeholder">${emoji}</div>
        <span class="card-badge ${badgeClass}">${badgeText}</span>
      </div>`;
  }

  // Button
  let btnClass = 'btn-link';
  let btnIcon = '🔗';
  let btnText = item.label || 'เปิดลิงก์';

  if (isImage) {
    btnClass = 'btn-image';
    btnIcon = '🔍';
    btnText = item.label || 'ดูรูป';
  } else if (isCanva) {
    btnClass = 'btn-canva';
    btnIcon = '🎨';
    btnText = item.label || 'เปิดดู';
  } else if (isDrive) {
    btnClass = 'btn-drive';
    btnIcon = '📁';
    btnText = item.label || 'เปิดไฟล์';
  }

  card.innerHTML = `
    ${thumbHTML}
    <div class="card-body">
      ${item.order ? `<span class="card-order">ลำดับที่ ${item.order}</span>` : ''}
      <div class="card-label">${escapeHTML(item.label)}</div>
      <button class="card-btn ${btnClass}" aria-label="${escapeAttr(item.label)}">
        ${btnIcon} ${escapeHTML(btnText)}
      </button>
    </div>`;

  // Click handler
  if (isImage) {
    card.addEventListener('click', () => openLightbox(item.url, item.label, 'image'));
  } else if (isCanva) {
    card.addEventListener('click', () => openLightbox(item.url, item.label, 'canva'));
  } else {
    card.addEventListener('click', () => {
      if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
    });
  }

  return card;
}

// เลือก Emoji ตาม URL ของลิงก์
function getLinkEmoji(label, url) {
  const u = (url || '').toLowerCase();
  const l = (label || '').toLowerCase();
  if (u.includes('youtube') || u.includes('youtu.be')) return '▶️';
  if (u.includes('drive.google')) return '📁';
  if (u.includes('docs.google.com/document')) return '📄';
  if (u.includes('docs.google.com/presentation')) return '📊';
  if (u.includes('forms.google') || u.includes('docs.google.com/forms')) return '📝';
  if (u.includes('canva')) return '🎨';
  if (l.includes('เกม') || l.includes('game')) return '🎮';
  if (l.includes('วิดีโอ') || l.includes('video')) return '🎥';
  if (l.includes('เสียง') || l.includes('audio') || l.includes('เพลง')) return '🎵';
  if (l.includes('แบบทดสอบ') || l.includes('quiz')) return '✏️';
  return '🌐';
}

// ================================================================
//  💀 Skeleton Screen
// ================================================================
function showSkeleton() {
  cardGrid.innerHTML = Array.from({ length: CONFIG.SKELETON_COUNT }, () => `
    <div class="skeleton-card">
      <div class="skeleton-thumb"></div>
      <div class="skeleton-body">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line btn"></div>
      </div>
    </div>`).join('');
  updateCount('--');
}

// ================================================================
//  🔍 Search / Filter
// ================================================================
function searchFilter(query) {
  const q = query.trim().toLowerCase();

  if (!q) {
    filteredItems = [...allItems];
  } else {
    filteredItems = allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.order.toString().includes(q)
    );
  }

  renderCards(filteredItems);
  updateCount(filteredItems.length);
}

function updateCount(n) {
  if (resultCount) resultCount.textContent = n;
}

// ================================================================
//  🖼️ Lightbox
// ================================================================
function openLightbox(url, caption, type = 'image') {
  if (type === 'canva') {
    lightboxImg.classList.add('hidden');
    lightboxIframe.classList.remove('hidden');
    
    // แปลงลิงก์ Canva ให้แสดงผลเต็มจอดีขึ้น
    let embedUrl = url;
    if (embedUrl.includes('/view') && !embedUrl.includes('embed')) {
      embedUrl = embedUrl.replace('/view', '/view?embed');
    }
    lightboxIframe.src = embedUrl;
  } else {
    lightboxIframe.classList.add('hidden');
    lightboxImg.classList.remove('hidden');
    lightboxImg.src = url;
    lightboxImg.alt = caption || 'รูปภาพ';
  }

  if (lightboxCaption) lightboxCaption.textContent = caption || '';
  lightboxOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightboxOverlay.classList.remove('active');
  lightboxImg.src = '';
  lightboxIframe.src = '';
  document.body.style.overflow = '';
}

// ================================================================
//  ❗ Error / Empty States
// ================================================================
function showConfigError() {
  cardGrid.innerHTML = `
    <div class="state-box" style="grid-column:1/-1">
      <span class="state-icon">⚙️</span>
      <h2>ตั้งค่า Google Sheet ก่อนนะคะ!</h2>
      <p>กรุณาเปิดไฟล์ <strong>app.js</strong> แล้วใส่ค่า <code>SHEET_ID</code> และ <code>SHEET_NAME</code> ในส่วน CONFIG ด้านบนของไฟล์</p>
      <p style="margin-top:8px;font-size:0.8rem;opacity:0.7">
        📋 วิธีหา SHEET_ID: เปิด Google Sheet แล้วดู URL<br>
        <em>…/spreadsheets/d/<strong>[SHEET_ID]</strong>/edit…</em>
      </p>
    </div>`;
}

function showEmptyState(title, desc) {
  cardGrid.innerHTML = `
    <div class="state-box" style="grid-column:1/-1">
      <span class="state-icon">📭</span>
      <h2>${title}</h2>
      <p>${desc}</p>
      <button class="btn-retry" onclick="fetchSheetData()">🔄 โหลดใหม่</button>
    </div>`;
}

function showErrorState() {
  cardGrid.innerHTML = `
    <div class="state-box" style="grid-column:1/-1">
      <span class="state-icon">😅</span>
      <h2>โหลดไม่ได้แล้ว...</h2>
      <p>ตรวจสอบว่า Google Sheet ได้รับการ <strong>Publish to web</strong> แล้ว และ SHEET_ID ถูกต้อง</p>
      <button class="btn-retry" onclick="fetchSheetData()">🔄 ลองใหม่</button>
    </div>`;
}

// ================================================================
//  📱 PWA — Install Prompt
// ================================================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // แสดง banner หลังจาก 3 วินาที
  setTimeout(() => {
    if (installBanner) installBanner.classList.add('show');
  }, 3000);
});

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBanner.classList.remove('show');
  });
}

if (btnDismiss) {
  btnDismiss.addEventListener('click', () => {
    installBanner.classList.remove('show');
  });
}

// ================================================================
//  🔧 Service Worker Registration
// ================================================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('✅ SW registered:', reg.scope))
        .catch(err => console.warn('SW registration failed:', err));
    });
  }
}

// ================================================================
//  ⬆️ Scroll to Top
// ================================================================
window.addEventListener('scroll', () => {
  if (btnTop) {
    btnTop.classList.toggle('visible', window.scrollY > 300);
  }
});

if (btnTop) {
  btnTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ================================================================
//  🎯 Event Listeners
// ================================================================

// Lightbox — ปิดเมื่อคลิก overlay
lightboxOverlay?.addEventListener('click', (e) => {
  if (e.target === lightboxOverlay) closeLightbox();
});

lightboxClose?.addEventListener('click', closeLightbox);

// Lightbox — ปิดด้วย ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// Search — real-time
searchInput?.addEventListener('input', (e) => {
  searchFilter(e.target.value);
});

// ================================================================
//  🚀 Init
// ================================================================
registerServiceWorker();
fetchSheetData();
