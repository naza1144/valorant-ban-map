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

function start() {
  const format = "bo3";
  const maps = ALL_MAPS.filter((m) => pool.has(m.id));
  // BO3 ต้องการ ≥5 แมพเพื่อใช้ลำดับ ban2-pick2-... ปกติ; รองรับขั้นต่ำตามที่กำหนด
  if (maps.length !== 7) return alert("ต้องเลือก Map Pool 7 แมพพอดี");
  const seq = buildSequence(format);
  state = {
    teams: [$("teamA").value || "Team A", $("teamB").value || "Team B"],
    format, maps: maps.map((m) => ({ ...m, status: "free", by: null, sideBy: null, side: null })),
    seq, step: 0, history: [], pendingSide: null, decider: null, coin: null,
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

// รอบสุดท้าย (Decider): ทีม A เลือกหัว/ก้อย -> ทอยเหรียญ (สุ่มหรือกรอกผลเอง) -> ทีมที่ชนะเลือกฝั่งเริ่ม
function coinCall(face) { snapshot(); state.coin = { call: face }; render(); }
function coinResult(face) {
  snapshot();
  state.coin.result = face;
  state.coin.winner = face === state.coin.call ? 0 : 1;   // ทีม A เลือก state.coin.call, ทีม B ได้อีกด้าน
  render();
}
function coinHtml(face) {
  const rot = face === "ก้อย" ? "rotateY(180deg)" : "none";
  return `<div class="coin-wrap" id="coinWrap"><div class="coin" id="coin" style="transform:${rot}"><div class="face head">หัว</div><div class="face tail">ก้อย</div></div></div>`;
}
// ทอยเหรียญแบบมีอนิเมชัน: เหรียญลอยขึ้นและหมุนหลายรอบ แล้วหยุดที่ด้านที่สุ่มได้
function coinToss() {
  if (state.tossing) return;
  state.tossing = true;
  const face = Math.random() < 0.5 ? "หัว" : "ก้อย";
  document.querySelectorAll(".side-choice button").forEach((b) => { b.disabled = true; });
  const deg = 360 * 6 + (face === "ก้อย" ? 180 : 0), ms = 2400;
  $("coinWrap").animate(
    [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-140px) scale(1.5)", offset: 0.45 }, { transform: "translateY(0) scale(1)" }],
    { duration: ms, easing: "ease-in-out" });
  $("coin").animate([{ transform: "rotateY(0deg)" }, { transform: `rotateY(${deg}deg)` }],
    { duration: ms, easing: "cubic-bezier(.15,.6,.25,1)", fill: "forwards" });
  setTimeout(() => { state.tossing = false; coinResult(face); }, ms + 700);
}
function chooseDecider(side) {
  snapshot();
  state.decider = { team: state.coin.winner, side, coin: state.coin };
  render();
}

function finishIfDone() {
  if (state.step >= state.seq.length && !state.pendingSide) {
    const left = freeMaps();
    if (left.length === 1) { left[0].status = "decider"; }
  }
}

function snapshot() { state.history.push(JSON.stringify({ maps: state.maps, step: state.step, decider: state.decider, coin: state.coin, pendingSide: state.pendingSide && state.pendingSide.id })); }
function undo() {
  if (!state || !state.history.length) return;
  const s = JSON.parse(state.history.pop());
  state.maps = s.maps; state.step = s.step; state.decider = s.decider || null; state.coin = s.coin || null;
  state.pendingSide = s.pendingSide ? state.maps.find((m) => m.id === s.pendingSide) : null;
  render();
}

function render() {
  const allChosen = state.step >= state.seq.length && !state.pendingSide;
  const needDecider = allChosen && !state.decider;
  const done = allChosen && !!state.decider;
  const st = $("status");
  if (state.pendingSide) {
    const m = state.pendingSide, t = state.teams[1 - m.by];
    st.innerHTML = `<b>${t}</b> เลือกฝั่งบน <b>${m.name}</b>`;
    st.innerHTML += `<div class="side-choice"><button class="atk" onclick="chooseSide('Attack')">⚔ Attack</button><button class="def" onclick="chooseSide('Defend')">🛡 Defend</button></div>`;
  } else if (needDecider) {
    const dm = state.maps.find((m) => m.status === "decider");
    const c = state.coin, T = state.teams;
    const head = `แมพสุดท้าย <b>${dm ? dm.name : ""}</b> — ทอยเหรียญเลือกฝั่ง`;
    if (!c) {
      st.innerHTML = `${head}<br><b>${T[0]}</b> เลือกหัวหรือก้อย (${T[1]} ได้ด้านที่เหลือ)`
        + `<div class="side-choice"><button onclick="coinCall('หัว')">🪙 หัว</button><button onclick="coinCall('ก้อย')">🪙 ก้อย</button></div>`;
    } else if (!c.result) {
      st.innerHTML = `${head}<br>${T[0]}: <b>${c.call}</b> · ${T[1]}: <b>${c.call === "หัว" ? "ก้อย" : "หัว"}</b>`
        + coinHtml("หัว") + `<div class="side-choice"><button class="primary" onclick="coinToss()">🪙 ทอยเหรียญ (สุ่ม)</button><button onclick="coinResult('หัว')">ทอยจริงแล้ว: ออกหัว</button><button onclick="coinResult('ก้อย')">ทอยจริงแล้ว: ออกก้อย</button></div>`;
    } else {
      st.innerHTML = `เหรียญออก <b>${c.result}</b> — <b>${T[c.winner]}</b> ชนะการทอย เลือกฝั่งที่จะเริ่มบน <b>${dm ? dm.name : ""}</b>`
        + coinHtml(c.result) + `<div class="side-choice"><button class="atk" onclick="chooseDecider('Attack')">⚔ Attack</button><button class="def" onclick="chooseDecider('Defend')">🛡 Defend</button></div>`;
    }
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
    if (m.status === "decider") tag = "DECIDER" + (state.decider ? ` | ${state.teams[state.decider.team]}: ${state.decider.side}` : "");
    d.innerHTML = (tag ? `<div class="tag">${tag}</div>` : "") + `<div class="name">${m.name}</div>`;
    d.onclick = () => onMapClick(m);
    box.appendChild(d);
  });

  const res = $("result");
  if (done) {
    const played = state.maps.filter((m) => m.status === "picked" || m.status === "decider")
      .sort((x, y) => (x.status === "decider" ? 9 : x.pickNo) - (y.status === "decider" ? 9 : y.pickNo));
    res.classList.remove("hidden");
    res.innerHTML = `<h2>ลำดับแมพที่เล่น</h2><ol>` + played.map((m) =>
      `<li><b>${m.name}</b> — ${m.status === "decider" ? `Decider — เหรียญออก${state.decider.coin.result}, ${state.teams[state.decider.team]} ชนะการทอยและเลือกเริ่มฝั่ง ${state.decider.side}` : `เลือกโดย ${state.teams[m.by]}, ${state.teams[m.sideBy]} เลือก ${m.side}`}</li>`
    ).join("") + `</ol>` + (state.sheet ? `<button class="primary alt" onclick="openResult()">บันทึกผลการแข่งขัน →</button>` : "");
  } else res.classList.add("hidden");
  syncSheet();
}

// ===== เชื่อม Google Sheet ผ่านหลังบ้าน (server.js) — URL/TOKEN เก็บบนเซิร์ฟเวอร์ ไม่อยู่ในเบราว์เซอร์ =====
let sheetMatches = [];
let syncChain = Promise.resolve();

function sheetTarget() {
  const m = sheetMatches.find((x) => x.id === $("sheetMatch").value);
  return m && $("sheetDate").value ? { date: $("sheetDate").value, match: m.id } : null;
}
function sheetMsg(text, cls) { const e = $("sheetMsg"); e.textContent = text; e.className = "hint " + (cls || ""); }
function logMsg(text, cls) { const e = $("log"); e.textContent = text; e.className = "log " + (cls || ""); }

// รหัสกรรมการ (ถ้า server ตั้ง REF_PIN ไว้) จะขอครั้งแรกที่เขียนชีต แล้วจำไว้ในเบราว์เซอร์
async function api(path, opt = {}, retry = true) {
  opt = { ...opt, headers: { ...(opt.headers || {}), "X-PIN": localStorage.getItem("uvc_pin") || "" } };
  const r = await fetch(path, opt);
  const j = await r.json();
  if (!j.ok && j.error === "pin" && retry) {
    const p = prompt("ใส่รหัสกรรมการ");
    if (p) { localStorage.setItem("uvc_pin", p); return api(path, opt, false); }
  }
  if (!j.ok) throw new Error(j.error === "pin" ? "รหัสกรรมการไม่ถูกต้อง" : (j.error || "error"));
  return j;
}

async function loadTabs() {
  try {
    sheetMsg("กำลังโหลด…");
    const { tabs } = await api("/api/tabs");
    const keep = $("sheetDate").value;
    $("sheetDate").innerHTML = tabs.map((t) => `<option>${t}</option>`).join("");
    if (tabs.includes(keep)) $("sheetDate").value = keep;
    await loadMatches();
  } catch (e) { sheetMsg("เชื่อมต่อชีตไม่สำเร็จ: " + e.message, "err"); }
}

async function loadMatches() {
  try {
    const { matches } = await api("/api/matches?date=" + encodeURIComponent($("sheetDate").value));
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
  if (ids.length === 7) pool = new Set(ids);
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
  if (d) {
    d.order = picks + 1;
    if (state.decider) { d.owner = state.teams[state.decider.team]; d.side = state.decider.side === "Attack" ? "ATK" : "DEF"; }   // ทีมที่ชนะการทอยและเลือกฝั่ง
  }
  return { date: state.sheet.date, match: state.sheet.match, maps };
}

function syncSheet() {
  if (!state || !state.sheet) return;
  const body = JSON.stringify(sheetPayload());
  logMsg("กำลังอัปเดตชีต…");
  syncChain = syncChain.then(async () => {
    try {
      await api("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      logMsg("อัปเดตชีตแล้ว ✓", "ok");
    } catch (e) { logMsg("อัปเดตชีตไม่สำเร็จ: " + e.message, "err"); }
  });
}

// ===== บันทึกผลการแข่งขันลงชีต (ผลแต่ละแมพ + สละสิทธิ์ + คะแนนที่ได้) =====
let rs = null;   // { target, teams, names, maps:[null|0|1 x3], forfeit:null|0|1 }

function resultPoints() {
  if (rs.forfeit !== null) return { pts: rs.forfeit === 0 ? [0, 3] : [3, 0] };
  const w = [0, 1].map((t) => rs.maps.filter((m) => m === t).length);
  if (w[0] > 2 || w[1] > 2) return { error: "ทีมหนึ่งชนะได้ไม่เกิน 2 แมพ" };
  if (w[0] === 2) return { w, pts: w[1] === 0 ? [3, 0] : [2, 1] };
  if (w[1] === 2) return { w, pts: w[0] === 0 ? [0, 3] : [1, 2] };
  return { w, error: "ยังไม่มีทีมที่ชนะครบ 2 แมพ" };
}

async function openResult() {
  const t = sheetTarget();
  if (!t) return alert("เลือกวันที่และแมตช์ก่อน");
  try { sheetMatches = (await api("/api/matches?date=" + encodeURIComponent(t.date))).matches; } catch (e) { /* ใช้รายการเดิม */ }
  const m = sheetMatches.find((x) => x.id === t.match);
  if (!m) return alert("ไม่พบแมตช์นี้ในชีต");
  rs = { target: t, teams: [m.teamA, m.teamB], maps: [null, null, null], forfeit: null,
    names: [1, 2, 3].map((n) => ((m.played || []).find((p) => p.order === n) || {}).name || "") };
  $("setup").classList.add("hidden"); $("game").classList.add("hidden"); $("resultView").classList.remove("hidden");
  renderResult();
}

function setMapWinner(n, v) { rs.maps[n] = v; renderResult(); }
function setForfeit(v) { rs.forfeit = v; renderResult(); }
function closeResult() {
  $("resultView").classList.add("hidden");
  $(state ? "game" : "setup").classList.remove("hidden");
}

function renderResult(msg, cls) {
  const T = rs.teams, r = resultPoints();
  const btn = (on, label, fn, extra = "") => `<button class="${on ? "on " : ""}${extra}" onclick="${fn}">${label}</button>`;
  let html = `<h2>บันทึกผล — ${rs.target.match} (${rs.target.date})</h2><p><b>${T[0]}</b> vs <b>${T[1]}</b></p>`;
  html += [0, 1, 2].map((n) => `<div class="rrow${rs.forfeit !== null ? " dim" : ""}"><span class="lbl">แมพ ${n + 1}${rs.names[n] ? " — " + rs.names[n] : ""}</span>`
    + btn(rs.maps[n] === 0, `${T[0]} ชนะ`, `setMapWinner(${n},0)`) + btn(rs.maps[n] === 1, `${T[1]} ชนะ`, `setMapWinner(${n},1)`)
    + btn(rs.maps[n] === null, "ไม่ได้เล่น", `setMapWinner(${n},null)`) + `</div>`).join("");
  html += `<div class="rrow"><span class="lbl">สละสิทธิ์</span>`
    + btn(rs.forfeit === 0, `${T[0]} สละสิทธิ์`, "setForfeit(0)", "forf") + btn(rs.forfeit === 1, `${T[1]} สละสิทธิ์`, "setForfeit(1)", "forf")
    + btn(rs.forfeit === null, "ไม่มี", "setForfeit(null)") + `</div>`;
  html += r.pts ? `<div class="rsum">คะแนนที่ได้: <b>${T[0]} ${r.pts[0]}</b> : <b>${r.pts[1]} ${T[1]}</b></div>`
    : `<div class="rsum err">${r.error}</div>`;
  html += `<div class="row"><button class="primary" ${r.pts ? "" : "disabled"} onclick="saveResult()">บันทึกผลลงชีต</button><button onclick="closeResult()">กลับ</button></div>`;
  html += `<p class="hint ${cls || ""}" id="resultMsg">${msg || ""}</p>`;
  $("resultBody").innerHTML = html;
}

async function saveResult() {
  const r = resultPoints();
  if (!r.pts) return;
  if (!confirm(`บันทึกผล ${rs.target.match}: ${rs.teams[0]} ${r.pts[0]} : ${r.pts[1]} ${rs.teams[1]} ลงชีตหรือไม่?`)) return;
  try {
    renderResult("กำลังบันทึก…");
    await api("/api/result", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: rs.target.date, match: rs.target.match, maps: rs.maps, forfeit: rs.forfeit }) });
    renderResult("บันทึกผลลงชีตแล้ว ✓", "ok");
  } catch (e) { renderResult("บันทึกไม่สำเร็จ: " + e.message, "err"); }
}

$("resultBtn").onclick = openResult;
$("loadSheetBtn").onclick = loadTabs;
$("sheetDate").onchange = loadMatches;
$("sheetMatch").onchange = applyMatch;
loadTabs();

$("startBtn").onclick = start;
$("undoBtn").onclick = undo;
$("resetBtn").onclick = () => { state = null; $("game").classList.add("hidden"); $("setup").classList.remove("hidden"); };
