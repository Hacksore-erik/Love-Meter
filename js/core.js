const APP = {
  state: null,
  myId: null,
  coupleId: null,
  myRole: 'you',
  currentPeriod: 'month',
  coupleStatePeriod: 'week',
  calYear: null,
  calMonth: null,
  realtimeChannel: null,
  supabaseClient: null,
  supabaseLoading: null
};

function $(id) {
  return document.getElementById(id);
}

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
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
];

const MONTHS_GENITIVE = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря'
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function avg(arr) {
  if (!arr.length) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-027', 'crypto.randomUUID недоступен', e.message || '');
    }
  }
  try {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  } catch (e) {
    return 'fallback-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
  }
}

function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-002', e.message || 'Ошибка localStorage', key);
    }
    return false;
  }
}

function storageRemove(key) {
  try { localStorage.removeItem(key); return true; } catch (e) { return false; }
}

/* ---------- СОСТОЯНИЕ ---------- */

function defaultState() {
  return {
    names: CONFIG.DEFAULTS.names,
    myName: CONFIG.DEFAULTS.myName,
    partnerName: CONFIG.DEFAULTS.partnerName,
    myGender: CONFIG.DEFAULTS.myGender,
    partnerGender: CONFIG.DEFAULTS.partnerGender,
    startDate: todayStr(),
    votes: {},
    hideMyVotes: CONFIG.DEFAULTS.hideMyVotes,
    partnerHideFlag: false,
    streak: 0,
    totalVotes: 0
  };
}

function loadState() {
  const raw = storageGet(CONFIG.STORAGE.state);

  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        if (!p.votes || typeof p.votes !== 'object') p.votes = {};
        if (typeof p.names !== 'string' || !p.names) p.names = CONFIG.DEFAULTS.names;
        if (typeof p.myName !== 'string' || !p.myName) p.myName = CONFIG.DEFAULTS.myName;
        if (typeof p.partnerName !== 'string' || !p.partnerName) p.partnerName = CONFIG.DEFAULTS.partnerName;
        if (typeof p.myGender !== 'string') p.myGender = '';
        if (typeof p.partnerGender !== 'string') p.partnerGender = '';
        if (typeof p.startDate !== 'string') p.startDate = todayStr();
        if (typeof p.hideMyVotes !== 'boolean') p.hideMyVotes = false;
        if (typeof p.partnerHideFlag !== 'boolean') p.partnerHideFlag = false;
        if ('openMode' in p) delete p.openMode;
        return p;
      }
    } catch (e) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-001', e.message || 'Ошибка парсинга localStorage');
      }
    }
  }

  return defaultState();
}

function saveState() {
  if (!APP.state) return;
  storageSet(CONFIG.STORAGE.state, JSON.stringify(APP.state));
}

/* ---------- ИМЕНА ---------- */

function getMyName() {
  return APP.state.myName || CONFIG.DEFAULTS.myName;
}

function getPartnerName() {
  return APP.state.partnerName || CONFIG.DEFAULTS.partnerName;
}

function setMyName(name) {
  const trimmed = String(name || '').trim().substring(0, 30);
  if (!trimmed) return false;
  APP.state.myName = trimmed;
  saveState();
  return true;
}

/* ---------- ПОЛ ---------- */

function getMyGender() {
  return APP.state.myGender || '';
}

function getPartnerGender() {
  return APP.state.partnerGender || '';
}

function setMyGender(g) {
  if (g !== 'f' && g !== 'm') return false;
  APP.state.myGender = g;
  saveState();
  return true;
}

function setPartnerGender(g) {
  APP.state.partnerGender = (g === 'f' || g === 'm') ? g : '';
  saveState();
}

function getMyGenderEmoji() {
  const g = getMyGender();
  return (g && CONFIG.GENDERS[g]) ? CONFIG.GENDERS[g].emoji : '🧑';
}

function getPartnerGenderEmoji() {
  const g = getPartnerGender();
  return (g && CONFIG.GENDERS[g]) ? CONFIG.GENDERS[g].emoji : '🧑';
}

function getPartnerVerb() {
  const g = getPartnerGender();
  return (g && CONFIG.GENDERS[g]) ? CONFIG.GENDERS[g].verb : 'поставил(а)';
}

/* ---------- МАТЕМАТИКА ---------- */

function computeStreak(votes) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = fmtDate(d);
    if (votes[key] && (votes[key].you || votes[key].partner)) streak++;
    else if (i > 0) break;
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

function getTodayVote() {
  const v = APP.state.votes[todayStr()];
  if (!v) return null;
  return APP.myRole === 'you' ? (v.you || null) : (v.partner || null);
}

function getMyHideFlag() {
  return !!APP.state.hideMyVotes;
}

function getPartnerHideFlag() {
  return !!APP.state.partnerHideFlag;
}

/* ---------- РАСЧЁТЫ ДЛЯ ЭКРАНОВ ---------- */
function computePartnerPercent() {
  const result = {
    percent: 0,
    hasData: false,
    votedToday: false,
    lastVoteValue: null,
    lastVoteDaysAgo: null,
    hidden: getPartnerHideFlag()
  };

  if (result.hidden) return result;

  const partnerKey = APP.myRole === 'you' ? 'partner' : 'you';
  const today = new Date();
  const partnerVals = [];
  let lastValue = null;
  let lastDate = null;

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = fmtDate(d);
    const v = APP.state.votes[key];

    if (v && v[partnerKey]) {
      partnerVals.push(v[partnerKey]);
      if (!lastDate) { lastDate = d; lastValue = v[partnerKey]; }
      if (i === 0) result.votedToday = true;
    }
  }

  if (partnerVals.length) {
    result.hasData = true;
    result.lastVoteValue = lastValue;
    result.lastVoteDaysAgo = lastDate ? daysBetween(lastDate, today) : null;
    result.percent = clamp(Math.round(avg(partnerVals) * 20), 0, 100);
  }

  return result;
}

function computeCouplePercent(period) {
  period = period || APP.coupleStatePeriod;
  const daysBack = period === 'month' ? 30 : 7;
  const iHide = getMyHideFlag();
  const partnerHide = getPartnerHideFlag();
  const today = new Date();
  const allVals = [];

  for (let i = 0; i < daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const v = APP.state.votes[fmtDate(d)];
    if (!v) continue;
    if (v.you && !iHide) allVals.push(v.you);
    if (v.partner && !partnerHide) allVals.push(v.partner);
  }

  const result = {
    percent: 0,
    count: allVals.length,
    hasData: allVals.length > 0,
    daysBack: daysBack,
    anyHidden: iHide || partnerHide,
    iHide: iHide,
    partnerHide: partnerHide
  };

  if (allVals.length) {
    result.percent = clamp(Math.round(avg(allVals) * 20), 0, 100);
  }

  return result;
}

function getChartData(period) {
  const today = new Date();
  const points = [];
  const iHide = getMyHideFlag();
  const partnerHide = getPartnerHideFlag();

  if (period === 'week' || period === 'month') {
    const daysBack = period === 'week' ? 6 : 29;
    for (let i = daysBack; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const v = APP.state.votes[fmtDate(d)];
      let val = null;
      if (v) {
        const vals = [];
        if (v.you && !iHide) vals.push(v.you);
        if (v.partner && !partnerHide) vals.push(v.partner);
        if (vals.length) val = avg(vals);
      }
      points.push({
        date: d,
        key: fmtDate(d),
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
          if (v.you && !iHide) vals.push(v.you);
          if (v.partner && !partnerHide) vals.push(v.partner);
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
    partnerValues: partnerValues,
    iHide: getMyHideFlag(),
    partnerHide: getPartnerHideFlag()
  };
}

function computeRecords() {
  let best = null, bestVal = 0;
  let worst = null, worstVal = 6;
  const sorted = Object.keys(APP.state.votes).sort();

  for (let i = 0; i < sorted.length; i++) {
    const v = APP.state.votes[sorted[i]];
    const vals = [];
    if (v.you) vals.push(v.you);
    if (v.partner) vals.push(v.partner);
    if (vals.length) {
      const a = avg(vals);
      if (a > bestVal) { bestVal = a; best = sorted[i]; }
      if (a < worstVal) { worstVal = a; worst = sorted[i]; }
    }
  }

  let longest = 0, current = 0;
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
    bestDate: best, bestValue: bestVal,
    worstDate: worst, worstValue: worstVal,
    longestFive: longest
  };
}

function computeMonthlyInsight(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let sum = 0, count = 0, bestDay = null, bestVal = 0, bothDays = 0;

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
    case 'historian':
      return Math.min(daysBetween(parseDate(APP.state.startDate), today) + 1, 100);
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
    case 'anniversary':
      return Math.min(daysBetween(parseDate(APP.state.startDate), today) + 1, 365);
    default:
      return 0;
  }
}

/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */

function initCore() {
  APP.myId = storageGet(CONFIG.STORAGE.myId);
  if (!APP.myId) {
    APP.myId = uuid();
    storageSet(CONFIG.STORAGE.myId, APP.myId);
  }

  APP.coupleId = storageGet(CONFIG.STORAGE.couple) || null;
  APP.state = loadState();

  const savedPeriod = storageGet(CONFIG.STORAGE.coupleStatePeriod);
  if (savedPeriod === 'week' || savedPeriod === 'month') {
    APP.coupleStatePeriod = savedPeriod;
  }

  recalcStats();
  saveState();
}