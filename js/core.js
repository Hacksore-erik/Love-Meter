/* ============================================================
   CORE — состояние, localStorage, утилиты, математика
   ============================================================
   Этот файл отвечает только за данные и логику. Он не знает
   ни про DOM, ни про UI, ни про сервер. Все функции чистые
   или работают с APP.state. Загружается третьим, после
   logger.js и config.js.

   Все ошибки логируются через LM.record() с кодами:
   LM-001 — ошибка загрузки состояния
   LM-002 — ошибка сохранения состояния
   LM-027 — ошибка генерации UUID
   ============================================================ */

/* ============================================================
   ГЛОБАЛЬНОЕ СОСТОЯНИЕ
   ============================================================ */
const APP = {
  state: null,
  myId: null,
  coupleId: null,
  myRole: 'you',
  currentPeriod: 'month',
  calYear: null,
  calMonth: null,
  realtimeChannel: null,
  supabaseClient: null,
  supabaseLoading: null
};

/* ============================================================
   УТИЛИТЫ — DOM
   ============================================================ */
function $(id) {
  return document.getElementById(id);
}

/* ============================================================
   УТИЛИТЫ — ДАТЫ
   ============================================================ */
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function fmtDate(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function parseDate(s) {
  const parts = s.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function todayStr() {
  return fmtDate(new Date());
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

const MONTHS_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

/* ============================================================
   УТИЛИТЫ — МАТЕМАТИКА
   ============================================================ */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function avg(arr) {
  if (!arr.length) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

/* ============================================================
   УТИЛИТЫ — UUID
   ============================================================ */
function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-027', 'crypto.randomUUID недоступен, используется fallback', e.message || '');
    }
  }

  try {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-027', 'Не удалось сгенерировать UUID', e.message || '');
    }
    return 'fallback-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
  }
}

/* ============================================================
   УТИЛИТЫ — БЕЗОПАСНЫЙ LOCALSTORAGE
   ============================================================ */
function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-002', e.message || 'Не удалось сохранить в localStorage', key);
    }
    return false;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   СОСТОЯНИЕ — создание, загрузка, сохранение
   ============================================================ */
function defaultState() {
  return {
    names: CONFIG.DEFAULTS.names,
    startDate: todayStr(),
    votes: {},
    openMode: CONFIG.DEFAULTS.openMode,
    streak: 0,
    totalVotes: 0
  };
}

function loadState() {
  const raw = storageGet(CONFIG.STORAGE.state);

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (!parsed.votes || typeof parsed.votes !== 'object') {
          parsed.votes = {};
        }
        if (typeof parsed.names !== 'string' || !parsed.names) {
          parsed.names = CONFIG.DEFAULTS.names;
        }
        if (typeof parsed.startDate !== 'string') {
          parsed.startDate = todayStr();
        }
        if (typeof parsed.openMode !== 'boolean') {
          parsed.openMode = false;
        }
        return parsed;
      }
    } catch (e) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-001', e.message || 'Ошибка парсинга localStorage', CONFIG.STORAGE.state);
      }
    }
  }

  return defaultState();
}

function saveState() {
  if (!APP.state) return;
  storageSet(CONFIG.STORAGE.state, JSON.stringify(APP.state));
}

/* ============================================================
   МАТЕМАТИКА ДАННЫХ
   ============================================================ */
function computeStreak(votes) {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = fmtDate(d);

    if (votes[key] && (votes[key].you || votes[key].partner)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

function computeTotalVotes(votes) {
  let total = 0;
  for (const k in votes) {
    if (votes[k].you) total++;
    if (votes[k].partner) total++;
  }
  return total;
}

function recalcStats() {
  if (!APP.state) return;
  APP.state.streak = computeStreak(APP.state.votes);
  APP.state.totalVotes = computeTotalVotes(APP.state.votes);
}

/* ============================================================
   МОЯ СЕГОДНЯШНЯЯ ОЦЕНКА
   ============================================================ */
function getTodayVote() {
  const v = APP.state.votes[todayStr()];
  if (!v) return null;
  return APP.myRole === 'you' ? (v.you || null) : (v.partner || null);
}

/* ============================================================
   ПРОЦЕНТ ДЛЯ СЕРДЦА
   ============================================================ */
function computePercent() {
  const today = new Date();
  const last7 = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = fmtDate(d);
    const v = APP.state.votes[key];

    if (v) {
      const vals = [];
      if (v.you) vals.push(v.you);
      if (v.partner) vals.push(v.partner);
      if (vals.length) last7.push(avg(vals));
    }
  }

  const avg7 = last7.length ? avg(last7) : 0;
  const myVote = getTodayVote() || 0;
  const streakPart = clamp(APP.state.streak, 0, 30) / 30 * 10;

  if (!last7.length && !myVote) {
    return 0;
  }

  const raw = avg7 * 20 * 0.6 + myVote * 20 * 0.3 + streakPart;
  return clamp(Math.round(raw), 0, 100);
}

/* ============================================================
   ДАННЫЕ ДЛЯ ГРАФИКА
   ============================================================ */
function getChartData(period) {
  const today = new Date();
  const points = [];

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = fmtDate(d);
      const v = APP.state.votes[key];

      let val = null;
      if (v) {
        const vals = [];
        if (v.you) vals.push(v.you);
        if (v.partner) vals.push(v.partner);
        if (vals.length) val = avg(vals);
      }

      points.push({
        date: d,
        key: key,
        value: val,
        label: d.getDate() + '.' + (d.getMonth() + 1)
      });
    }
  } else if (period === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = fmtDate(d);
      const v = APP.state.votes[key];

      let val = null;
      if (v) {
        const vals = [];
        if (v.you) vals.push(v.you);
        if (v.partner) vals.push(v.partner);
        if (vals.length) val = avg(vals);
      }

      points.push({
        date: d,
        key: key,
        value: val,
        label: d.getDate() + '.' + (d.getMonth() + 1)
      });
    }
  } else {
    for (let w = 11; w >= 0; w--) {
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() - w * 7);

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const vals = [];
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const v = APP.state.votes[fmtDate(d)];
        if (v) {
          if (v.you) vals.push(v.you);
          if (v.partner) vals.push(v.partner);
        }
      }

      points.push({
        date: weekEnd,
        key: null,
        value: vals.length ? avg(vals) : null,
        label: weekEnd.getDate() + '.' + (weekEnd.getMonth() + 1)
      });
    }
  }

  return points;
}

/* ============================================================
   АГРЕГИРОВАННАЯ СТАТИСТИКА ЗА ПЕРИОД
   ============================================================ */
function getPeriodStats(period) {
  const points = getChartData(period);
  const youValues = [];
  const partnerValues = [];
  let bothCount = 0;
  let validCount = 0;

  for (let i = 0; i < points.length; i++) {
    const key = points[i].key;
    if (!key) continue;

    const v = APP.state.votes[key];
    if (!v) continue;

    let hasVal = false;
    if (v.you) { youValues.push(v.you); hasVal = true; }
    if (v.partner) { partnerValues.push(v.partner); hasVal = true; }
    if (v.you && v.partner) bothCount++;
    if (hasVal) validCount++;
  }

  return {
    youAvg: youValues.length ? avg(youValues) : 0,
    partnerAvg: partnerValues.length ? avg(partnerValues) : 0,
    bothCount: bothCount,
    validCount: validCount,
    youValues: youValues,
    partnerValues: partnerValues
  };
}

/* ============================================================
   РЕКОРДЫ
   ============================================================ */
function computeRecords() {
  let best = null, bestVal = 0;
  let worst = null, worstVal = 6;

  const sorted = Object.keys(APP.state.votes).sort();

  for (let i = 0; i < sorted.length; i++) {
    const k = sorted[i];
    const v = APP.state.votes[k];
    const vals = [];
    if (v.you) vals.push(v.you);
    if (v.partner) vals.push(v.partner);

    if (vals.length) {
      const a = avg(vals);
      if (a > bestVal) { bestVal = a; best = k; }
      if (a < worstVal) { worstVal = a; worst = k; }
    }
  }

  let longest = 0;
  let current = 0;
  for (let i = 0; i < sorted.length; i++) {
    const v = APP.state.votes[sorted[i]];
    if (v.you === 5 || v.partner === 5) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }

  return {
    bestDate: best,
    bestValue: bestVal,
    worstDate: worst,
    worstValue: worstVal,
    longestFive: longest
  };
}

/* ============================================================
   ИНСАЙТ ДЛЯ МЕСЯЦА
   ============================================================ */
function computeMonthlyInsight(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let sum = 0;
  let count = 0;
  let bestDay = null;
  let bestVal = 0;
  let bothDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const key = year + '-' + pad(month + 1) + '-' + pad(d);
    const v = APP.state.votes[key];
    if (!v) continue;

    const vals = [];
    if (v.you) vals.push(v.you);
    if (v.partner) vals.push(v.partner);

    if (vals.length) {
      const a = avg(vals);
      sum += a;
      count++;
      if (a > bestVal) { bestVal = a; bestDay = d; }
    }

    if (v.you && v.partner) bothDays++;
  }

  return {
    avgMonth: count ? (sum / count).toFixed(1) : null,
    bestDay: bestDay,
    bothDays: bothDays,
    daysInMonth: daysInMonth,
    count: count
  };
}

/* ============================================================
   ПРОГРЕСС ДОСТИЖЕНИЙ
   ============================================================ */
function getAchievementProgress(a) {
  const votes = APP.state.votes;
  const today = new Date();

  switch (a.id) {
    case 'first':
      return APP.state.totalVotes > 0 ? 1 : 0;

    case 'week':
      return Math.min(APP.state.streak, 7);

    case 'month':
      return Math.min(APP.state.streak, 30);

    case 'perfect':
      for (const k in votes) {
        if (votes[k].you === 5 && votes[k].partner === 5) return 1;
      }
      return 0;

    case 'romantic': {
      let c = 0;
      for (const k in votes) {
        if (votes[k].you === 5 || votes[k].partner === 5) c++;
      }
      return Math.min(c, 10);
    }

    case 'historian': {
      const start = parseDate(APP.state.startDate);
      const days = daysBetween(start, today) + 1;
      return Math.min(days, 100);
    }

    case 'rainbow': {
      const levels = new Set();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const v = votes[fmtDate(d)];
        if (v) {
          if (v.you) levels.add(v.you);
          if (v.partner) levels.add(v.partner);
        }
      }
      return levels.size;
    }

    case 'sync': {
      let c = 0;
      for (const k in votes) {
        if (votes[k].you && votes[k].partner && votes[k].you === votes[k].partner) c++;
      }
      return Math.min(c, 14);
    }

    case 'burning': {
      let c = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const v = votes[fmtDate(d)];
        if (v) {
          const vals = [];
          if (v.you) vals.push(v.you);
          if (v.partner) vals.push(v.partner);
          if (vals.length && avg(vals) >= 4.5) c++;
        }
      }
      return c;
    }

    case 'anniversary': {
      const start = parseDate(APP.state.startDate);
      const days = daysBetween(start, today) + 1;
      return Math.min(days, 365);
    }

    default:
      return 0;
  }
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ STATE И myId
   ============================================================ */
function initCore() {
  /* Мой ID */
  APP.myId = storageGet(CONFIG.STORAGE.myId);
  if (!APP.myId) {
    APP.myId = uuid();
    storageSet(CONFIG.STORAGE.myId, APP.myId);
  }

  /* Код пары (если сохранён ранее) */
  APP.coupleId = storageGet(CONFIG.STORAGE.couple) || null;

  /* Загружаем состояние */
  APP.state = loadState();

  /* Пересчитываем статистику */
  recalcStats();

  /* Сохраняем — на случай, если поля были добавлены впервые */
  saveState();
}