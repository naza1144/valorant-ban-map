/**
 * ตัวกลางระหว่างเว็บ Ban Map กับ Google Sheet (UVC รวมคะแนน)
 * วิธีติดตั้งดูที่ apps-script/README.md
 *
 * โครงของแต่ละแมตช์ในแท็บวัน (h = แถวชื่อแมพ Abyss..Sunset ในคอลัมน์ J ถึง P):
 *   ชื่อแมพ    แถว h   <- เว็บเปลี่ยนสีช่องนี้: แดง = แบน, เขียว = เลือก
 *   ลำดับ     แถว h+1 (map1, map2, map3)
 *   ทีมเจ้าของ แถว h+2 (ทีมที่เลือกแมพนั้น)
 *   ฝั่ง       แถว h+3 (ฝั่งของทีมเจ้าของ: ATK / DEF)
 */

// เปลี่ยนค่านี้ก่อน Deploy แล้วใส่ค่าเดียวกันในหน้าเว็บ
const TOKEN = 'change-me';
const SKIP_TABS = ['รวมคะแนน'];
const COL_TEAM1 = 3, COL_TEAM2 = 7, COL_GROUP = 5, COL_LABEL = 11;
const COL_MAP_FIRST = 10, MAP_COUNT = 7;          // J..P
const RED = '#ff0000', GREEN = '#00ff00';

/**
 * หาแมตช์ทั้งหมดจากตาราง values (2D array เริ่มที่ A1 กว้างอย่างน้อย 16 คอลัมน์)
 * แถวชื่อแมพ = แถวที่คอลัมน์ J..P มีข้อความครบทั้ง 7 ช่อง
 * ทีม = คอลัมน์ C และ G ในแถวที่คอลัมน์ E เป็น A/B (แถวชื่อแมพ หรือสูงขึ้นไปไม่เกิน 2 แถว)
 * รหัสแมตช์ = ป้ายในคอลัมน์ K เหนือแถวชื่อแมพ (เช่น A1) ถ้าไม่มีให้ตั้งเป็น กลุ่ม+ลำดับ (A1, B2, A3 ...)
 */
function findBlocks_(v) {
  const blocks = [];
  for (let r = 0; r < v.length; r++) {
    const names = [];
    for (let i = 0; i < MAP_COUNT; i++) names.push(String(v[r][COL_MAP_FIRST - 1 + i] || '').trim());
    if (names.some((n) => n === '')) continue;
    let teamRow = -1;
    for (let t = r; t >= Math.max(r - 2, 0); t--) {
      if (/^[AB]$/.test(String(v[t][COL_GROUP - 1]).trim())) { teamRow = t; break; }
    }
    if (teamRow < 0) continue;
    const group = String(v[teamRow][COL_GROUP - 1]).trim();
    let id = '';
    for (let t = r - 1; t >= Math.max(r - 2, 0); t--) {
      const label = String(v[t][COL_LABEL - 1] || '').trim();
      if (/^[AB]\d+$/.test(label)) { id = label; break; }
    }
    if (!id) id = group + (blocks.length + 1);
    blocks.push({
      id, group,
      teamA: clean_(v[teamRow][COL_TEAM1 - 1]),
      teamB: clean_(v[teamRow][COL_TEAM2 - 1]),
      headerRow: r + 1,            // แถวชื่อแมพ (เลขแถวใน Sheet เริ่มที่ 1)
      maps: names,
    });
  }
  return blocks;
}

function clean_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

/** แปลง state จากเว็บเป็นค่าที่จะเขียนลง Sheet (ไม่แตะ Sheet จึงทดสอบได้) */
function planWrites_(block, maps) {
  const byName = {};
  maps.forEach((m) => { byName[String(m.name).toLowerCase()] = m; });
  return block.maps.map((name, i) => {
    const m = byName[name.toLowerCase()];
    const col = COL_MAP_FIRST + i;
    if (!m || m.status === 'free') return { col, bg: null, cells: ['', '', ''] };
    if (m.status === 'banned') return { col, bg: RED, cells: ['', '', ''] };
    return {
      col, bg: GREEN,
      cells: [m.order ? 'map' + m.order : '', clean_(m.owner), String(m.side || '').toUpperCase()],
    };
  });
}

function applyBlock_(sheet, block, maps) {
  planWrites_(block, maps).forEach((w) => {
    sheet.getRange(block.headerRow, w.col).setBackground(w.bg);
    sheet.getRange(block.headerRow + 1, w.col, 3, 1).setValues(w.cells.map((c) => [c]));
  });
}

function readBlocks_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const blocks = findBlocks_(sheet.getRange(1, 1, lastRow, 16).getValues());
  // ทำเครื่องหมายแมตช์ที่มีข้อมูลแมพอยู่แล้ว (สีแดง/เขียว หรือมีลำดับ/ทีมเจ้าของ) เพื่อเตือนกรรมการก่อนเขียนทับ
  blocks.forEach((b) => {
    const rng = sheet.getRange(b.headerRow, COL_MAP_FIRST, 4, MAP_COUNT);
    const bg = rng.getBackgrounds()[0], vals = rng.getValues();
    b.used = bg.some((c) => c === RED || c === GREEN) ||
      [1, 2, 3].some((r) => vals[r].some((x) => String(x).trim() !== ''));
  });
  return blocks;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const p = e.parameter || {};
    if (p.token !== TOKEN) return json_({ ok: false, error: 'bad token' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (p.action === 'tabs') {
      const tabs = ss.getSheets().map((s) => s.getName()).filter((n) => SKIP_TABS.indexOf(n) < 0);
      return json_({ ok: true, tabs });
    }
    if (p.action === 'matches') {
      const sheet = ss.getSheetByName(p.date);
      if (!sheet) return json_({ ok: false, error: 'no tab ' + p.date });
      return json_({ ok: true, matches: readBlocks_(sheet) });
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** body (text/plain JSON): { token, date, match, maps:[{name,status,order,owner,side}] } */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return json_({ ok: false, error: 'bad token' });
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(body.date);
    if (!sheet) return json_({ ok: false, error: 'no tab ' + body.date });
    const block = readBlocks_(sheet).filter((b) => b.id === body.match)[0];
    if (!block) return json_({ ok: false, error: 'no match ' + body.match });
    applyBlock_(sheet, block, body.maps || []);
    SpreadsheetApp.flush();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* ไม่ได้ล็อก */ }
  }
}

// ให้ทดสอบใน Node ได้ (ไม่มีผลใน Apps Script)
if (typeof module !== 'undefined') module.exports = { findBlocks_, planWrites_ };
