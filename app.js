// ===== Config: แก้ Map Pool ที่นี่ได้ (สีใช้แทนรูปภาพ) =====
const ALL_MAPS = [
  { id: "ascent",  name: "Ascent", img: "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png",  color: "#3a6b8a" },
  { id: "bind",    name: "Bind", img: "https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png",    color: "#a0642d" },
  { id: "haven",   name: "Haven", img: "https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png",   color: "#5a7d4f" },
  { id: "split",   name: "Split", img: "https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png",   color: "#6b4f7d" },
  { id: "lotus",   name: "Lotus", img: "https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png",   color: "#8a3a5c" },
  { id: "sunset",  name: "Sunset", img: "https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png",  color: "#c9722b" },
  { id: "icebox",  name: "Icebox", img: "https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png",  color: "#4f9bb0" },
  { id: "breeze",  name: "Breeze", img: "https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png",  color: "#2fa39a" },
  { id: "fracture",name: "Fracture", img: "https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png",color: "#7d6b2f" },
  { id: "pearl",   name: "Pearl", img: "https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png",   color: "#2f4f8a" },
  { id: "corrode", name: "Corrode", color: "#7d4f2f", img: "https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/splash.png" },
  { id: "summit", name: "Summit", color: "#5a7a9a", img: "https://media.valorant-api.com/maps/756da597-416b-c0f2-f47b-afbdf28670bc/splash.png" },
  { id: "abyss",   name: "Abyss", img: "https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png",   color: "#4a3a8a" },
];
// แมพตามกติกา UVC2026: Abyss, Bind, Corrode, Haven, Lotus, Summit, Sunset
const DEFAULT_POOL = ["abyss", "bind", "corrode", "haven", "lotus", "summit", "sunset"];

// ลำดับ action ตามรูปแบบ: ban / pick / (decider = แมพที่เหลือ). team: 0=A, 1=B
// สำหรับ pick ทีมที่ "ไม่ได้ pick" จะเลือกฝั่ง (Attack/Defend)
// Flow เดียว: 7 แมพ -> ban 2 (A,B) -> pick 2 (A,B) -> ban 2 (A,B) -> เหลือ 1 แมพ = decider (เล่น 3 แมพ)
// สำหรับ pick ทีมที่ไม่ได้ pick จะเลือกฝั่ง (Attack/Defend)
function buildSequence() {
  const B = (team) => ({ type: "ban", team }), P = (team) => ({ type: "pick", team });
  return [B(0), B(1), P(0), P(1), B(0), B(1)];
}

const $ = (id) => document.getElementById(id);
let state = null;
let pool = new Set(DEFAULT_POOL);

function renderPicker() {
  $("poolPicker").innerHTML = "";
  ALL_MAPS.forEach((m) => {
    const c = document.createElement("div");
    c.className = "chip" + (pool.has(m.id) ? " on" : "");
    c.textContent = m.name;
    c.onclick = () => {
      if (pool.has(m.id)) pool.delete(m.id);
      else if (pool.size >= 7) return alert("เลือกได้สูงสุด 7 แมพ — ยกเลิกแมพอื่นก่อน");
      else pool.add(m.id);
      renderPicker();
    };
    $("poolPicker").appendChild(c);
  });
}

function start() {
  const format = "bo3";
  const maps = ALL_MAPS.filter((m) => pool.has(m.id));
  // BO3 ต้องการ ≥5 แมพเพื่อใช้ลำดับ ban2-pick2-... ปกติ; รองรับขั้นต่ำตามที่กำหนด
  if (maps.length !== 7) return alert("ต้องเลือก Map Pool 7 แมพพอดี");
  const seq = buildSequence(format);
  state = {
    teams: [$("teamA").value || "Team A", $("teamB").value || "Team B"],
    format, maps: maps.map((m) => ({ ...m, status: "free", by: null, sideBy: null, side: null })),
    seq, step: 0, history: [], pendingSide: null,
    sheet: sheetTarget(),
  };
  if (state.sheet) {
    const used = (sheetMatches.find((x) => x.id === state.sheet.match) || {}).used;
    const warn = used ? "แมตช์นี้มีข้อมูลแมพในชีตอยู่แล้ว และจะถูกเขียนทับ" : "จะเขียนข้อมูลแมพลงชีต";
    if (!confirm(`${warn}\nแมตช์ ${state.sheet.match} (${state.sheet.date}) ต้องการต่อหรือไม่?`)) { state = null; return; }
  }
  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  render();
}

function freeMaps() { return state.maps.filter((m) => m.status === "free"); }

function onMapClick(m) {
  if (!state || state.pendingSide || state.step >= state.seq.length || m.status !== "free") return;
  const act = state.seq[state.step];
  snapshot();
  if (act.type === "pick") m.pickNo = state.maps.filter((x) => x.status === "picked").length + 1;   // ลำดับที่เล่น
  m.status = act.type === "ban" ? "banned" : "picked";
  m.by = act.team;
  if (act.type === "pick") state.pendingSide = m;   // รอฝั่งตรงข้ามเลือกฝั่ง
  state.step++;
  finishIfDone();
  render();
}

function chooseSide(side) {
  snapshot();
  const m = state.pendingSide;
  m.sideBy = 1 - m.by;
  m.side = side;
  state.pendingSide = null;
  finishIfDone();
  render();
}

function finishIfDone() {
  if (state.step >= state.seq.length && !state.pendingSide) {
    const left = freeMaps();
    if (left.length === 1) { left[0].status = "decider"; }
  }
}

function snapshot() { state.history.push(JSON.stringify({ maps: state.maps, step: state.step, pendingSide: state.pendingSide && state.pendingSide.id })); }
function undo() {
  if (!state || !state.history.length) return;
  const s = JSON.parse(state.history.pop());
  state.maps = s.maps; state.step = s.step;
  state.pendingSide = s.pendingSide ? state.maps.find((m) => m.id === s.pendingSide) : null;
  render();
}

function render() {
  const done = state.step >= state.seq.length && !state.pendingSide;
  const st = $("status");
  if (state.pendingSide) {
    const m = state.pendingSide, t = state.teams[1 - m.by];
    st.innerHTML = `<b>${t}</b> เลือกฝั่งบน <b>${m.name}</b>`;
    st.innerHTML += `<div class="side-choice"><button class="atk" onclick="chooseSide('Attack')">⚔ Attack</button><button class="def" onclick="chooseSide('Defend')">🛡 Defend</button></div>`;
  } else if (done) {
    st.innerHTML = "✅ เสร็จสิ้น";
  } else {
    const a = state.seq[state.step];
    st.innerHTML = `<b>${state.teams[a.team]}</b> เลือกแมพที่จะ <b>${a.type.toUpperCase()}</b> (${state.step + 1}/${state.seq.length})`;
  }

  const box = $("maps");
  box.innerHTML = "";
  state.maps.forEach((m) => {
    const d = document.createElement("div");
    d.className = `map ${m.status}` + (m.status !== "free" || done || state.pendingSide ? " disabled" : "");
    d.style.background = `linear-gradient(135deg, ${m.color}, #0f1923)`;
    if (m.img) { d.style.backgroundImage = `url(${m.img}), linear-gradient(135deg, ${m.color}, #0f1923)`; d.style.backgroundSize = "cover"; d.style.backgroundPosition = "center"; }
    let tag = "";
    if (m.status === "banned") tag = `BAN · ${state.teams[m.by]}`;
    if (m.status === "picked") tag = `PICK · ${state.teams[m.by]}` + (m.side ? ` | ${state.teams[m.sideBy]}: ${m.side}` : "");
    if (m.status === "decider") tag = "DECIDER";
    d.innerHTML = (tag ? `<div class="tag">${tag}</div>` : "") + `<div class="name">${m.name}</div>`;
    d.onclick = () => onMapClick(m);
    box.appendChild(d);
  });

  const res = $("result");
  if (done) {
    const played = state.maps.filter((m) => m.status === "picked" || m.status === "decider");
    res.classList.remove("hidden");
    res.innerHTML = `<h2>ลำดับแมพที่เล่น</h2><ol>` + played.map((m) =>
      `<li><b>${m.name}</b> — ${m.status === "decider" ? "Decider (แมพที่เหลือ — เลือกฝั่งตามกติกาของลีก)" : `เลือกโดย ${state.teams[m.by]}, ${state.teams[m.sideBy]} เลือก ${m.side}`}</li>`
    ).join("") + `</ol>`;
  } else res.classList.add("hidden");
  syncSheet();
}

// ===== เชื่อม Google Sheet ผ่าน Apps Script =====
const SHEET_KEYS = { url: "uvc_sheet_url", token: "uvc_sheet_token" };
let sheetMatches = [];
let syncChain = Promise.resolve();

function sheetTarget() {
  const m = sheetMatches.find((x) => x.id === $("sheetMatch").value);
  return m && $("sheetDate").value ? { date: $("sheetDate").value, match: m.id } : null;
}
function sheetMsg(text, cls) { const e = $("sheetMsg"); e.textContent = text; e.className = "hint " + (cls || ""); }
function logMsg(text, cls) { const e = $("log"); e.textContent = text; e.className = "log " + (cls || ""); }

async function sheetGet(params) {
  const q = new URLSearchParams({ ...params, token: $("sheetToken").value });
  const r = await fetch($("sheetUrl").value + "?" + q);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j;
}

async function loadTabs() {
  try {
    localStorage.setItem(SHEET_KEYS.url, $("sheetUrl").value);
    localStorage.setItem(SHEET_KEYS.token, $("sheetToken").value);
    sheetMsg("กำลังโหลด…");
    const { tabs } = await sheetGet({ action: "tabs" });
    $("sheetDate").innerHTML = tabs.map((t) => `<option>${t}</option>`).join("");
    await loadMatches();
  } catch (e) { sheetMsg("เชื่อมต่อไม่สำเร็จ: " + e.message, "err"); }
}

async function loadMatches() {
  try {
    const { matches } = await sheetGet({ action: "matches", date: $("sheetDate").value });
    sheetMatches = matches;
    $("sheetMatch").innerHTML = matches.map((m) => `<option value="${m.id}">${m.id}: ${m.teamA} vs ${m.teamB}${m.used ? " (มีข้อมูลแล้ว)" : ""}</option>`).join("");
    applyMatch();
    sheetMsg(`พบ ${matches.length} แมตช์`, "ok");
  } catch (e) { sheetMsg("โหลดแมตช์ไม่สำเร็จ: " + e.message, "err"); }
}

function applyMatch() {
  const m = sheetMatches.find((x) => x.id === $("sheetMatch").value);
  if (!m) return;
  $("teamA").value = m.teamA; $("teamB").value = m.teamB;
  const ids = m.maps.map((n) => n.toLowerCase()).filter((n) => ALL_MAPS.some((a) => a.id === n));
  if (ids.length === 7) { pool = new Set(ids); renderPicker(); }
}

function sheetPayload() {
  const picks = state.maps.filter((m) => m.status === "picked").length;
  const maps = state.maps.map((m) => {
    const o = { name: m.name, status: m.status };
    if (m.status === "picked") {
      o.order = m.pickNo; o.owner = state.teams[m.by];
      o.side = m.side ? (m.side === "Attack" ? "DEF" : "ATK") : "";   // ฝั่งของทีมที่เลือกแมพ (ตรงข้ามกับที่อีกทีมเลือก)
    }
    return o;
  });
  const d = maps.find((m) => m.status === "decider");
  if (d) d.order = picks + 1;
  return { token: $("sheetToken").value, date: state.sheet.date, match: state.sheet.match, maps };
}

function syncSheet() {
  if (!state || !state.sheet) return;
  const body = JSON.stringify(sheetPayload());
  logMsg("กำลังอัปเดตชีต…");
  syncChain = syncChain.then(async () => {
    try {
      const r = await fetch($("sheetUrl").value, { method: "POST", body });   // text/plain ไม่ต้อง preflight
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      logMsg("อัปเดตชีตแล้ว ✓", "ok");
    } catch (e) { logMsg("อัปเดตชีตไม่สำเร็จ: " + e.message, "err"); }
  });
}

$("sheetUrl").value = (window.UVC_CONFIG && window.UVC_CONFIG.sheetUrl) || localStorage.getItem(SHEET_KEYS.url) || "";
$("sheetToken").value = localStorage.getItem(SHEET_KEYS.token) || "";
$("loadSheetBtn").onclick = loadTabs;
$("sheetDate").onchange = loadMatches;
$("sheetMatch").onchange = applyMatch;

$("startBtn").onclick = start;
$("undoBtn").onclick = undo;
$("resetBtn").onclick = () => { state = null; $("game").classList.add("hidden"); $("setup").classList.remove("hidden"); };
renderPicker();
