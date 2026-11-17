/**
 * ตัวกลางระหว่างเว็บ Ban Map กับ Google Sheet (UVC รวมคะแนน)
 * วิธีติดตั้งดูที่ apps-script/README.md
 *
 * โครงของแต่ละแมตช์ในแท็บวัน (ตรวจจากคอลัมน์ K ที่มีป้าย A1, B2, A3 ...):
 *   ป้ายแมตช์  คอลัมน์ K (แถวที่ r)
 *   ชื่อทีม    คอลัมน์ C (ทีมแรก) และ G (ทีมที่สอง) ในแถวที่คอลัมน์ E เป็น A หรือ B (ช่วง r-1 ถึง r+2)
 *   ชื่อแมพ    แถว r+1 คอลัมน์ J ถึง P  <- เว็บเปลี่ยนสีช่องนี้: แดง = แบน, เขียว = เลือก
 *   ลำดับ     แถว r+2  (map1, map2, map3)
 *   ทีมเจ้าของ แถว r+3  (ทีมที่เลือกแมพนั้น)
 *   ฝั่ง       แถว r+4  (ฝั่งของทีมเจ้าของ: ATK / DEF)
 */

// เปลี่ยนค่านี้ก่อน Deploy แล้วใส่ค่าเดียวกันในหน้าเว็บ
const TOKEN = 'change-me';
const SKIP_TABS = ['รวมคะแนน'];
const COL_TEAM1 = 3, COL_TEAM2 = 7, COL_GROUP = 5, COL_LABEL = 11;
const COL_MAP_FIRST = 10, MAP_COUNT = 7;          // J..P
const RED = '#ff0000', GREEN = '#00ff00';

/** หาแมตช์ทั้งหมดจากตาราง values (2D array เริ่มที่ A1 กว้างอย่างน้อย 16 คอลัมน์) */
function findBlocks_(v) {
  const blocks = [];
  for (let r = 0; r < v.length; r++) {
    const id = String(v[r][COL_LABEL - 1] || '').trim();
    if (!/^[AB]\d+$/.test(id)) continue;
    let teamRow = -1;
    for (let t = r - 1; t <= r + 2; t++) {
      if (t >= 0 && t < v.length && /^[AB]$/.test(String(v[t][COL_GROUP - 1]).trim())) { teamRow = t; break; }
    }
    if (teamRow < 0 || r + 1 >= v.length) continue;
    const names = [];
    for (let i = 0; i < MAP_COUNT; i++) names.push(String(v[r + 1][COL_MAP_FIRST - 1 + i] || '').trim());
    blocks.push({
      id,
      group: String(v[teamRow][COL_GROUP - 1]).trim(),
      teamA: clean_(v[teamRow][COL_TEAM1 - 1]),
      teamB: clean_(v[teamRow][COL_TEAM2 - 1]),
      headerRow: r + 2,            // แถวชื่อแมพ (เลขแถวใน Sheet เริ่มที่ 1)
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
  return findBlocks_(sheet.getRange(1, 1, lastRow, 16).getValues());
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
