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
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
// макс. приріст за ОДИН запис (трохи вище найбільшої чесної разової нагороди:
// експедиція ~2800🪙, тижневий приз 1000🪙+200❤️, набір 2000🪙). Усе понад — це накрутка.
const MAX_DELTA = { coins: 6000, hearts: 3000, butterflies: 600 };
const MAX_LEVEL_JUMP = 3; // за один запис рівень не може стрибнути більше ніж на 3

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
  let lvl = Math.max(1, Math.min(CAP.level, Math.floor(after.level || 1)));
  // ── КРИСТАЛИ: захист від прямої накрутки в базі ──
  // легальний приріст іде через обмін монет (а монети вже обмежені вище),
  // тож великий стрибок кристалів за один запис — підозрілий → відкат
  if (before && typeof before.crystals === "number" && typeof after.crystals === "number") {
    if (after.crystals - before.crystals > 1200) fix.crystals = before.crystals;
    if (after.crystals > 200000) fix.crystals = before.crystals;
  }
  // рівень не може стрибнути більше ніж на MAX_LEVEL_JUMP за один запис
  if (before && typeof before.level === "number" && lvl - before.level > MAX_LEVEL_JUMP) {
    lvl = before.level + MAX_LEVEL_JUMP;
  }
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

// ════════ СЕРВЕРНА ЕКОНОМІКА: авторитетне нарахування тижневого призу ════════
// Це перший крок переносу економіки на сервер: приз за тижневий турнір рахується
// і нараховується НА СЕРВЕРІ за реальним рейтингом, тож його не можна підробити
// на клієнті. Захист від повторного отримання — через поле weekClaimedKey.
function weekPrize(rank) {
  if (rank === 1) return { coins: 1000, hearts: 200, rare: true, t: "🥇 1 місце" };
  if (rank <= 3) return { coins: 500, hearts: 100, t: "🥈 Топ-3" };
  if (rank <= 10) return { coins: 200, hearts: 50, t: "🏅 Топ-10" };
  return { coins: 50, t: "🎖️ Учасник" };
}
export const claimWeeklyReward = onCall(async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Потрібен вхід");
  const ref = db.collection("players").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Гравця не знайдено");
  const p = snap.data();
  const wk = p.lastWeekKey || "";
  if (!wk || (p.lastWeekScore || 0) <= 0) throw new HttpsError("failed-precondition", "Немає призу");
  if (p.weekClaimedKey === wk) throw new HttpsError("already-exists", "Приз за цей тиждень уже отримано");

  // рахуємо ранг на сервері за реальним рейтингом
  const top = await db.collection("players")
    .where("lastWeekKey", "==", wk)
    .orderBy("lastWeekScore", "desc").limit(200).get();
  let rank = 1;
  for (const d of top.docs) {
    if (d.id === uid) break;
    if ((d.data().lastWeekScore || 0) > (p.lastWeekScore || 0)) rank++;
  }
  const pr = weekPrize(rank);
  await ref.set({
    coins: (p.coins || 0) + (pr.coins || 0),
    hearts: (p.hearts || 0) + (pr.hearts || 0),
    weekRewardPending: false,
    weekClaimedKey: wk,
  }, { merge: true });
  return { ok: true, rank, coins: pr.coins || 0, hearts: pr.hearts || 0, rare: !!pr.rare, title: pr.t };
});
