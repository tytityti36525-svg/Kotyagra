/**
 * КотяГра — серверний анти-чіт (Firebase Cloud Functions, 2nd gen).
 *
 * Що робить:
 *  1) onPlayerWrite  — на КОЖЕН запис у players/{uid} перевіряє значення й, якщо
 *     вони неможливі (накручені), ВИПРАВЛЯЄ їх назад. Це працює навіть якщо
 *     гравець змінює дані напряму в Firestore — сервер однаково підрівняє.
 *  2) onMailCreate   — захист пошти/подарунків від спаму й завищених сум.
 *  3) weeklySweep    — раз на годину чистить рейтинг від явних читерів
 *     (обнуляє неможливо великий weekScore/lastWeekScore).
 *
 * ВАЖЛИВО: повний серверний контроль економіки (щоб гравець ВЗАГАЛІ не міг
 * писати монети напряму) потребує переносу всіх нарахувань у callable-функції.
 * Це великий рефакторинг. Тут — практичний максимум без переписування клієнта:
 * сервер не дає зберегти неможливі значення.
 */
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

// ── Межі (підбери під свою економіку) ──
const CAP = {
  coins: 50_000_000,
  hearts: 50_000_000,
  butterflies: 5_000_000,
  level: 500,
  refCount: 100000,
};
// тижневий рахунок не може бути більшим за розумну межу для рівня
const weekCap = (lvl) => (lvl || 1) * 8000 + 30000;
// скільки монет/сердечок максимум можна додати за ОДИН запис (захист від стрибків)
const MAX_DELTA = { coins: 200000, hearts: 200000, butterflies: 50000 };

function clampNum(v, max) {
  v = Number(v);
  if (!isFinite(v) || v < 0) return 0;
  return Math.min(v, max);
}

/**
 * Перевіряє документ гравця. Повертає об'єкт виправлень або null, якщо все ок.
 */
function validate(before, after) {
  const fix = {};
  const lvl = Math.max(1, Math.min(CAP.level, Math.floor(after.level || 1)));
  if (after.level !== lvl) fix.level = lvl;

  for (const key of ["coins", "hearts", "butterflies"]) {
    let v = clampNum(after[key], CAP[key]);
    // захист від різкого стрибка за один запис
    if (before && typeof before[key] === "number") {
      const delta = v - before[key];
      if (delta > MAX_DELTA[key]) v = before[key] + MAX_DELTA[key];
    }
    if (after[key] !== v) fix[key] = v;
  }

  const wc = weekCap(lvl);
  for (const key of ["weekScore", "lastWeekScore"]) {
    const v = clampNum(after[key], wc);
    if (after[key] !== undefined && after[key] !== v) fix[key] = v;
  }

  if (after.refCount !== undefined) {
    const v = clampNum(after.refCount, CAP.refCount);
    if (after.refCount !== v) fix.refCount = v;
  }
  // вірність клубу 0..100
  if (after.clubLoyalty !== undefined) {
    const v = Math.max(0, Math.min(100, Number(after.clubLoyalty) || 0));
    if (after.clubLoyalty !== v) fix.clubLoyalty = v;
  }

  return Object.keys(fix).length ? fix : null;
}

export const onPlayerWrite = onDocumentWritten("players/{uid}", async (event) => {
  const after = event.data?.after?.data();
  if (!after) return; // видалення — ігноруємо
  const before = event.data?.before?.data() || null;

  const fix = validate(before, after);
  if (!fix) return; // усе в межах — нічого не робимо (немає рекурсії)

  // лог підозрілої активності
  await db.collection("cheatLog").add({
    uid: event.params.uid,
    fix,
    at: Date.now(),
  }).catch(() => {});

  // повертаємо коректні значення
  await event.data.after.ref.set(fix, { merge: true });
});

export const onMailCreate = onDocumentCreated("mail/{id}", async (event) => {
  const m = event.data?.data();
  if (!m) return;
  const fix = {};
  // довжина тексту
  if (typeof m.body === "string" && m.body.length > 1000) fix.body = m.body.slice(0, 1000);
  // подарунки не можуть нести завищені суми
  if (typeof m.giftCoins === "number" && m.giftCoins > 5000) fix.giftCoins = 5000;
  if (typeof m.giftHearts === "number" && m.giftHearts > 5000) fix.giftHearts = 5000;
  if (Object.keys(fix).length) await event.data.ref.set(fix, { merge: true }).catch(() => {});
});

// раз на годину прибираємо явних читерів із рейтингу
export const weeklySweep = onSchedule("every 60 minutes", async () => {
  const snap = await db.collection("players")
    .orderBy("weekScore", "desc").limit(200).get();
  const batch = db.batch();
  let n = 0;
  snap.forEach((d) => {
    const p = d.data();
    const cap = weekCap(p.level || 1);
    const fix = {};
    if ((p.weekScore || 0) > cap) fix.weekScore = cap;
    if ((p.lastWeekScore || 0) > cap) fix.lastWeekScore = cap;
    if (Object.keys(fix).length) { batch.set(d.ref, fix, { merge: true }); n++; }
  });
  if (n) await batch.commit();
  console.log("weeklySweep виправив", n, "записів");
});
