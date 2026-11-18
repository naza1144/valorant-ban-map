// เว็บ + หลังบ้านเล็กๆ สำหรับ Render (Web Service, ไม่ต้องติดตั้งแพ็กเกจ)
// เก็บ URL/TOKEN ของ Apps Script ไว้เป็น Environment Variable จึงไม่ถูกส่งไปที่เบราว์เซอร์กรรมการ
//   SHEET_URL = Web app URL ของ Apps Script (ลงท้ายด้วย /exec)
//   TOKEN     = รหัสลับเดียวกับที่ตั้งใน Code.gs
//   REF_PIN   = รหัสกรรมการ (ถ้าตั้ง เว็บจะขอรหัสนี้ก่อนเขียนชีต/บันทึกผล)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8765;
const SHEET_URL = process.env.SHEET_URL || "";
const TOKEN = process.env.TOKEN || "";
const REF_PIN = process.env.REF_PIN || "";   // รหัสกรรมการ (ไม่บังคับ แต่แนะนำ) ใช้ป้องกันการเขียนชีต

// ไฟล์ที่เปิดให้ดาวน์โหลดได้ (ไม่รวม server.js, apps-script, .git)
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/logo.png": ["logo.png", "image/png"],
};

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function callSheet(params, body) {
  if (!SHEET_URL || !TOKEN) throw new Error("server ยังไม่ได้ตั้งค่า SHEET_URL/TOKEN");
  let r;
  if (body) {
    r = await fetch(SHEET_URL, { method: "POST", body: JSON.stringify({ ...body, token: TOKEN }) });
  } else {
    r = await fetch(SHEET_URL + "?" + new URLSearchParams({ ...params, token: TOKEN }));
  }
  return r.json();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("X-App", "valorant-ban-map");   // ไว้เช็กว่าคำขอมาถึงโปรแกรมนี้จริง
  res.on("finish", () => console.log(req.method, url.pathname, res.statusCode));
  try {
    if (req.method === "GET" && url.pathname === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
    if (req.method === "GET" && url.pathname === "/api/standings") return send(res, 200, await callSheet({ action: "standings" }));
    if (req.method === "GET" && url.pathname === "/api/tabs") return send(res, 200, await callSheet({ action: "tabs" }));
    if (req.method === "GET" && url.pathname === "/api/matches")
      return send(res, 200, await callSheet({ action: "matches", date: url.searchParams.get("date") || "" }));
    if (req.method === "POST" && (url.pathname === "/api/sync" || url.pathname === "/api/result")) {
      if (REF_PIN && req.headers["x-pin"] !== REF_PIN) return send(res, 200, { ok: false, error: "pin" });
      const b = JSON.parse(await readBody(req));
      if (url.pathname === "/api/result")
        return send(res, 200, await callSheet(null, { action: "result", date: b.date, match: b.match, maps: b.maps, forfeit: b.forfeit }));
      // ส่งต่อเฉพาะข้อมูลที่จำเป็น
      return send(res, 200, await callSheet(null, { date: b.date, match: b.match, maps: b.maps }));
    }
    const f = req.method === "GET" && STATIC[url.pathname];
    if (f) {
      res.writeHead(200, { "Content-Type": f[1] });
      return res.end(fs.readFileSync(path.join(__dirname, f[0])));
    }
    res.writeHead(404, { "Content-Type": "text/plain" }); res.end("ban-map: not found");
  } catch (e) {
    send(res, 200, { ok: false, error: String(e.message || e) });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log("listening on " + PORT + " sheet=" + (SHEET_URL ? "set" : "missing") + " token=" + (TOKEN ? "set" : "missing")));
