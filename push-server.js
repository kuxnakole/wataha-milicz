// ═══════════════════════════════════════════════════════════════
// PUSH SERVER — minimalny przyklad dla Wataha Milicz
//
// Uruchomienie:
//   1. npm init -y
//   2. npm install web-push express cors
//   3. node push-server.js
//
// VAPID keys generujesz raz:
//   npx web-push generate-vapid-keys
// ═══════════════════════════════════════════════════════════════

import express from "express";
import cors from "cors";
import webpush from "web-push";
import fs from "fs";

// 🔑 PODMIEN NA SWOJE KLUCZE VAPID
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || "TU_WKLEJ_PUBLIC_KEY";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || "TU_WKLEJ_PRIVATE_KEY";
const CONTACT       = process.env.VAPID_CONTACT || "mailto:kontakt@watahamilicz.pl";

webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Prosta baza JSON do trzymania subskrypcji
const DB_FILE = "./subscriptions.json";
function loadSubs()  { try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { return []; } }
function saveSubs(s) { fs.writeFileSync(DB_FILE, JSON.stringify(s, null, 2)); }

// ── Klucz publiczny VAPID dla frontu ─────────────────────────
app.get("/api/vapid-key", (req, res) => res.json({ key: VAPID_PUBLIC }));

// ── Subskrypcja: front wysyla tu PushSubscription po zgodzie ─
app.post("/api/subscribe", (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: "invalid" });
  const subs = loadSubs();
  if (!subs.find(s => s.endpoint === sub.endpoint)) {
    subs.push({ ...sub, createdAt: Date.now() });
    saveSubs(subs);
  }
  res.json({ ok: true });
});

// ── Wyrejestrowanie ──────────────────────────────────────────
app.post("/api/unsubscribe", (req, res) => {
  const { endpoint } = req.body;
  saveSubs(loadSubs().filter(s => s.endpoint !== endpoint));
  res.json({ ok: true });
});

// ── Wyslij push do wszystkich (admin endpoint) ───────────────
app.post("/api/send", async (req, res) => {
  const { title, body, url, tag } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });

  const payload = JSON.stringify({ title, body: body || "", url: url || "/", tag: tag || "wataha" });
  const subs = loadSubs();
  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification(s, payload))
  );

  // Usun martwe subskrypcje (410 Gone, 404)
  const valid = subs.filter((s, i) => {
    const r = results[i];
    if (r.status === "rejected" && r.reason && (r.reason.statusCode === 410 || r.reason.statusCode === 404)) return false;
    return true;
  });
  if (valid.length !== subs.length) saveSubs(valid);

  const sent = results.filter(r => r.status === "fulfilled").length;
  res.json({ sent, total: subs.length });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Push server na :${PORT}`));
