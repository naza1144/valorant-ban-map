/**
 * ตัวกลางระหว่างเว็บ Ban Map กับ Google Sheet (UVC รวมคะแนน)
 * วิธีติดตั้งดูที่ apps-script/README.md
 *
 * โครงของแต่ละแมตช์ในแท็บวัน (h = แถวชื่อแมพ Abyss..Sunset ในคอลัมน์ J ถึง P):
 *   ชื่อแมพ    แถว h   <- เว็บเปลี่ยนสีช่องนี้: แดง = แบน, เขียว = เลือก
 *   ลำดับ     แถว h+1 (map1, map2, map3)
 *   ทีมเจ้าของ แถว h+2 (ทีมที่เลือกแมพนั้น)
 *   ฝั่ง       แถว h+3 (ฝั่งของทีมเจ้าของ: ATK / DEF)
 *
 * ส่วนผลการแข่ง (t = แถวชื่อทีม, คอลัมน์ C = ทีมแรก, G = ทีมที่สอง):
 *   แถว bo1, bo2, bo3 (ตามป้ายคอลัมน์ A)  แมพ 1/2/3 ใส่ 1 = ชนะ, 0 = แพ้ ที่คอลัมน์ B/C/D (ทีมแรก) และ F/G/H (ทีมที่สอง)
 *   สละสิทธิ์: ฝั่งชนะเขียน "ชนะ by" ฝั่งสละสิทธิ์เขียน "สละสิทธิ์" ที่คอลัมน์ C/G ทั้ง 3 แถว
 *   แถว "คะแนนที่ได้" คอลัมน์ C/G: ชนะ 2-0 หรือสละสิทธิ์ = 3:0, ชนะ 2-1 = 2:1
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
      teamRow: teamRow + 1,        // แถวชื่อทีม (เลขแถวใน Sheet เริ่มที่ 1)
      headerRow: r + 1,            // แถวชื่อแมพ
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
  const v = sheet.getRange(1, 1, lastRow, 16).getValues();
  const blocks = findBlocks_(v);
  // ทำเครื่องหมายแมตช์ที่มีข้อมูลแมพอยู่แล้ว (สีแดง/เขียว หรือมีลำดับ/ทีมเจ้าของ) เพื่อเตือนกรรมการก่อนเขียนทับ
  blocks.forEach((b) => {
    const rng = sheet.getRange(b.headerRow, COL_MAP_FIRST, 4, MAP_COUNT);
    const bg = rng.getBackgrounds()[0], vals = rng.getValues();
    // แมพที่เล่น (ลำดับ map1..map3 ที่เว็บเขียนไว้ใต้ชื่อแมพ) ใช้แสดงในหน้าบันทึกผล
    b.played = vals[1].map((x, i) => ({ order: Number(String(x).replace(/\D/g, '')), name: b.maps[i] }))
      .filter((p) => p.order > 0).sort((p, q) => p.order - q.order);
    try { b.result = parseResult_(v, b); } catch (err) { b.result = null; }   // ผลที่กรอกไว้แล้ว (ให้เว็บแสดงสถานะ/แก้ต่อ)
    b.used = bg.some((c) => c === RED || c === GREEN) ||
      [1, 2, 3].some((r) => vals[r].some((x) => String(x).trim() !== ''));
  });
  return blocks;
}

/** หาเลขแถว bo1-bo3 และ "คะแนนที่ได้" ของแมตช์ (ค้นจากป้ายคอลัมน์ A ใต้แถวชื่อทีม) */
function findResultRows_(v, block) {
  const bo = {};
  let scoreRow = 0;
  for (let r = block.teamRow + 1; r <= block.teamRow + 8 && r <= v.length; r++) {
    const a = String(v[r - 1][0] || '').trim().toLowerCase();
    if (/^bo[123]$/.test(a)) bo[a] = r;
    if (a === 'คะแนนที่ได้') scoreRow = r;
  }
  if (!bo.bo1 || !bo.bo2 || !bo.bo3 || !scoreRow) throw new Error('หาแถว bo1-bo3/คะแนนที่ได้ ของแมตช์นี้ไม่เจอ');
  return { bo, scoreRow };
}

/**
 * อ่านผลที่มีอยู่ในชีตกลับมา: { maps:[null|0|1 x3], forfeit:null|0|1, pts:[a,b]|null }
 * (รูปแบบเดียวกับที่ planResult_ รับเข้า เพื่อให้หน้าเว็บแก้ต่อได้)
 */
function parseResult_(v, block) {
  const { bo, scoreRow } = findResultRows_(v, block);
  const L = [2, 3, 4], R = [6, 7, 8], SC = [3, 7];
  const isOne = (x) => x !== '' && Number(x) === 1;
  const maps = [null, null, null];
  let forfeit = null;
  ['bo1', 'bo2', 'bo3'].forEach((k, n) => {
    const row = v[bo[k] - 1];
    SC.forEach((c, t) => { if (String(row[c - 1]).trim() === 'สละสิทธิ์') forfeit = t; });
    if (isOne(row[L[n] - 1])) maps[n] = 0; else if (isOne(row[R[n] - 1])) maps[n] = 1;
  });
  const sr = v[scoreRow - 1];
  const num = (x) => (x === '' || x === null ? null : Number(x));
  const a = num(sr[SC[0] - 1]), b = num(sr[SC[1] - 1]);
  return { maps, forfeit, pts: a === null && b === null ? null : [a || 0, b || 0] };
}

/**
 * วางแผนการเขียนผลการแข่ง (ไม่แตะ Sheet จึงทดสอบได้)
 * v = ค่าทั้งแท็บ, block = แมตช์จาก findBlocks_, res = { maps:[null|0|1 x3], forfeit:null|0|1 }
 * maps[n] = ทีมที่ชนะแมพ n+1 (0 = ทีมแรก/ซ้าย, 1 = ทีมที่สอง/ขวา, null = ไม่ได้เล่น)
 * forfeit = ทีมที่สละสิทธิ์ (0/1) หรือ null; คืนรายการ {row, col, value}
 */
function planResult_(v, block, res) {
  const { bo, scoreRow } = findResultRows_(v, block);

  const maps = (res.maps || [null, null, null]).slice(0, 3);
  const forfeit = res.forfeit === 0 || res.forfeit === 1 ? res.forfeit : null;
  const L = [2, 3, 4], R = [6, 7, 8];            // คอลัมน์ผลแต่ละแมพของทีมซ้าย/ขวา
  const SC = [3, 7];                              // คอลัมน์คะแนน/ข้อความสละสิทธิ์ของทีมซ้าย/ขวา

  // คะแนนที่ได้
  let pts = null;
  if (forfeit !== null) {
    pts = forfeit === 0 ? [0, 3] : [3, 0];
  } else {
    const w = [0, 1].map((t) => maps.filter((m) => m === t).length);
    if (w[0] > 2 || w[1] > 2) throw new Error('ชนะได้ไม่เกิน 2 แมพ');
    if (w[0] === 2) pts = w[1] === 0 ? [3, 0] : [2, 1];
    else if (w[1] === 2) pts = w[0] === 0 ? [0, 3] : [1, 2];
    else pts = null;                              // ยังไม่มีทีมชนะครบ 2 แมพ
  }

  const out = [];
  ['bo1', 'bo2', 'bo3'].forEach((k, n) => {
    const row = bo[k];
    L.concat(R).forEach((c) => out.push({ row, col: c, value: '' }));      // ล้างช่องผลของแถวนี้ก่อน
    if (forfeit !== null) {
      out.push({ row, col: SC[1 - forfeit], value: 'ชนะ by' });
      out.push({ row, col: SC[forfeit], value: 'สละสิทธิ์' });
    } else if (maps[n] === 0 || maps[n] === 1) {
      out.push({ row, col: L[n], value: maps[n] === 0 ? 1 : 0 });
      out.push({ row, col: R[n], value: maps[n] === 1 ? 1 : 0 });
    }
  });
  out.push({ row: scoreRow, col: SC[0], value: pts ? pts[0] : '' });
  out.push({ row: scoreRow, col: SC[1], value: pts ? pts[1] : '' });
  return out;
}

/**
 * อ่านตารางคะแนนรวมจากแท็บ "รวมคะแนน" (คอลัมน์ A = ทีม, B = คะแนน)
 * หัวกลุ่มคือแถวที่ขึ้นต้นด้วย "ทีมสาย" เช่น "ทีมสาย A" และแต่ละกลุ่มจบที่แถวว่าง
 * ถ้าหัวกลุ่มหายไป (เช่น เซลล์ถูกลบ) แถวทีมที่ตามมาก็ยังถูกนับเป็นกลุ่มหนึ่ง
 */
function parseStandings_(v) {
  const groups = [];
  let cur = null;
  v.forEach((row) => {
    const a = clean_(row[0]);
    const m = a.match(/^ทีมสาย\s*(.+)$/);
    if (m) { cur = { name: m[1], teams: [] }; groups.push(cur); return; }
    if (!a) { cur = null; return; }
    if (!cur) { cur = { name: String.fromCharCode(65 + groups.length), teams: [] }; groups.push(cur); }   // กลุ่มที่หัว "ทีมสาย ..." ถูกลบ/ว่าง ยังนับทีมให้
    cur.teams.push({ team: a, score: Number(row[1]) || 0 });
  });
  return groups;
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
    if (p.action === 'standings') {
      const sh = ss.getSheetByName('รวมคะแนน');
      if (!sh) return json_({ ok: false, error: 'no tab รวมคะแนน' });
      return json_({ ok: true, groups: parseStandings_(sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 2).getValues()) });
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

/**
 * body (text/plain JSON):
 *   ban/pick:  { token, date, match, maps:[{name,status,order,owner,side}] }
 *   ผลการแข่ง: { token, action:'result', date, match, maps:[null|0|1 x3], forfeit:null|0|1 }
 */
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
    if (body.action === 'result') {
      const lastRow = Math.max(sheet.getLastRow(), 1);
      const v = sheet.getRange(1, 1, lastRow, 16).getValues();
      planResult_(v, block, body).forEach((w) => sheet.getRange(w.row, w.col).setValue(w.value));
    } else {
      applyBlock_(sheet, block, body.maps || []);
    }
    SpreadsheetApp.flush();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* ไม่ได้ล็อก */ }
  }
}

// ให้ทดสอบใน Node ได้ (ไม่มีผลใน Apps Script)
if (typeof module !== 'undefined') module.exports = { findBlocks_, planWrites_, planResult_, parseStandings_, parseResult_ };
