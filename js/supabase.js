/* ============================================================
   SUPABASE — синхронизация между партнёрами
   ============================================================
   Файл полностью опционален. Если в js/config.js ключи пустые,
   всё работает вхолостую.

   Что синхронизируется:
   - голоса (таблица votes)
   - имена партнёров (couples.name_you, couples.name_partner)
   - дата старта (couples.start_date)
   - флаги скрытия оценок (couples.hide_you, couples.hide_partner)

   Про имена:
   - name_you     — имя того, кто создал пару (роль 'you')
   - name_partner — имя того, кто подключился (роль 'partner')

   Каждое устройство пишет в СВОЙ столбец:
   - если myRole='you'     → пишу в name_you
   - если myRole='partner' → пишу в name_partner

   При чтении берётся ЧУЖОЙ столбец и кладётся в state.partnerName.
   ============================================================ */

/* ============================================================
   КЛЮЧИ СТОЛБЦОВ ДЛЯ МОЕГО/ЧУЖОГО
   ============================================================ */
function myHideColumn() {
  return APP.myRole === 'you' ? 'hide_you' : 'hide_partner';
}

function partnerHideColumn() {
  return APP.myRole === 'you' ? 'hide_partner' : 'hide_you';
}

function myNameColumn() {
  return APP.myRole === 'you' ? 'name_you' : 'name_partner';
}

function partnerNameColumn() {
  return APP.myRole === 'you' ? 'name_partner' : 'name_you';
}

/* ============================================================
   ЗАГРУЗКА КЛИЕНТА
   ============================================================ */
function initSupabaseAsync() {
  if (!HAS_SUPABASE) return Promise.resolve(null);
  if (APP.supabaseLoading) return APP.supabaseLoading;

  APP.supabaseLoading = (async function () {
    try {
      const mod = await import('https://esm.sh/@supabase/supabase-js@2');
      APP.supabaseClient = mod.createClient(
        CONFIG.SUPABASE.url,
        CONFIG.SUPABASE.anonKey
      );
      return APP.supabaseClient;
    } catch (e) {
      APP.supabaseClient = null;
      return null;
    }
  })();

  return APP.supabaseLoading;
}

/* ============================================================
   ЗАГРУЗКА ДАННЫХ ПАРЫ
   ============================================================ */
async function loadFromSupabase() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const coupleRes = await APP.supabaseClient
      .from('couples')
      .select('*')
      .eq('id', APP.coupleId)
      .maybeSingle();

    if (coupleRes.error || !coupleRes.data) return false;

    const couple = coupleRes.data;

    /* --- Имена ---
       Читаем СВОЙ столбец в myName (на случай переустановки),
       ЧУЖОЙ столбец в partnerName. */
    const myNameCol = myNameColumn();
    const partnerNameCol = partnerNameColumn();

    const serverMyName = couple[myNameCol];
    const serverPartnerName = couple[partnerNameCol];

    if (serverMyName) {
      APP.state.myName = serverMyName;
    }
    if (serverPartnerName) {
      APP.state.partnerName = serverPartnerName;
    }

    /* --- Метаданные --- */
    APP.state.startDate = couple.start_date || APP.state.startDate;

    /* --- Флаги скрытия --- */
    const partnerCol = partnerHideColumn();
    APP.state.partnerHideFlag = !!couple[partnerCol];

    const myCol = myHideColumn();
    const serverMyFlag = !!couple[myCol];
    if (serverMyFlag !== APP.state.hideMyVotes) {
      APP.state.hideMyVotes = serverMyFlag;
    }

    /* --- Голоса --- */
    const votesRes = await APP.supabaseClient
      .from('votes')
      .select('*')
      .eq('couple_id', APP.coupleId);

    const votes = {};
    const rows = votesRes.data || [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!votes[r.date]) votes[r.date] = {};
      if (r.role === 'you') votes[r.date].you = r.value;
      else if (r.role === 'partner') votes[r.date].partner = r.value;
    }

    APP.state.votes = votes;
    recalcStats();
    saveState();

    return true;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   ОТПРАВКА ГОЛОСА
   ============================================================ */
async function pushVoteToSupabase(date, role, value) {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const res = await APP.supabaseClient
      .from('votes')
      .upsert(
        {
          couple_id: APP.coupleId,
          date: date,
          role: role,
          value: value,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'couple_id,date,role' }
      );

    return !res.error;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   ОБНОВЛЕНИЕ МЕТАДАННЫХ ПАРЫ
   ============================================================
   Отправляем: своё имя, дату старта, свой флаг скрытия.
   Чужие столбцы не трогаем.
   ============================================================ */
async function pushCoupleMeta() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const myNameCol = myNameColumn();
    const myCol = myHideColumn();

    const payload = {
      id: APP.coupleId,
      start_date: APP.state.startDate,
      updated_at: new Date().toISOString()
    };

    payload[myNameCol] = getMyName();
    payload[myCol] = !!APP.state.hideMyVotes;

    const res = await APP.supabaseClient
      .from('couples')
      .upsert(payload);

    return !res.error;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   ОБНОВЛЕНИЕ ТОЛЬКО МОЕГО ИМЕНИ
   ============================================================
   Отдельная функция для редактора имён, чтобы не перезаписать
   чужие поля (например, партнёр параллельно меняет свой флаг).
   ============================================================ */
async function pushMyName() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const myNameCol = myNameColumn();
    const update = {};
    update[myNameCol] = getMyName();
    update.updated_at = new Date().toISOString();

    const res = await APP.supabaseClient
      .from('couples')
      .update(update)
      .eq('id', APP.coupleId);

    return !res.error;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   ОБНОВЛЕНИЕ ТОЛЬКО ФЛАГА СКРЫТИЯ
   ============================================================ */
async function pushMyHideFlag() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const myCol = myHideColumn();
    const update = {};
    update[myCol] = !!APP.state.hideMyVotes;
    update.updated_at = new Date().toISOString();

    const res = await APP.supabaseClient
      .from('couples')
      .update(update)
      .eq('id', APP.coupleId);

    return !res.error;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   СОЗДАНИЕ ПАРЫ
   ============================================================
   Оба столбца имён и флагов создаются пустыми.
   Партнёр 'you' сразу записывает своё имя.
   ============================================================ */
async function createCoupleInSupabase(code) {
  if (!APP.supabaseClient) return false;

  try {
    const myNameCol = myNameColumn();
    const myCol = myHideColumn();

    const payload = {
      id: code,
      start_date: APP.state.startDate,
      hide_you: false,
      hide_partner: false,
      name_you: '',
      name_partner: ''
    };

    payload[myNameCol] = getMyName();
    payload[myCol] = !!APP.state.hideMyVotes;

    const res = await APP.supabaseClient
      .from('couples')
      .insert(payload);

    return !res.error;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   ПРОВЕРКА СУЩЕСТВОВАНИЯ ПАРЫ
   ============================================================ */
async function checkCoupleExists(code) {
  if (!APP.supabaseClient) return false;

  try {
    const res = await APP.supabaseClient
      .from('couples')
      .select('id')
      .eq('id', code)
      .maybeSingle();

    return !!res.data && !res.error;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   ЗАЛИВКА ЛОКАЛЬНЫХ ГОЛОСОВ НА СЕРВЕР
   ============================================================ */
async function syncAllLocalVotesToSupabase() {
  if (!APP.supabaseClient || !APP.coupleId) return;

  const promises = [];
  const votes = APP.state.votes;

  for (const date in votes) {
    const v = votes[date];
    if (v.you) promises.push(pushVoteToSupabase(date, 'you', v.you));
    if (v.partner) promises.push(pushVoteToSupabase(date, 'partner', v.partner));
  }

  try {
    await Promise.all(promises);
  } catch (e) { /* игнорируем */ }

  await pushCoupleMeta();
}

/* ============================================================
   ПОДПИСКА НА REALTIME
   ============================================================ */
function subscribeRealtime() {
  if (!APP.supabaseClient || !APP.coupleId) return;

  if (APP.realtimeChannel) {
    try {
      APP.supabaseClient.removeChannel(APP.realtimeChannel);
    } catch (e) { /* игнорируем */ }
    APP.realtimeChannel = null;
  }

  try {
    APP.realtimeChannel = APP.supabaseClient
      .channel('couple:' + APP.coupleId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: 'couple_id=eq.' + APP.coupleId
        },
        handleRealtimeVote
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couples',
          filter: 'id=eq.' + APP.coupleId
        },
        handleRealtimeCouple
      )
      .subscribe(function (status) {
        if (typeof updateSyncDot === 'function') {
          updateSyncDot(status === 'SUBSCRIBED' ? 'on' : 'off');
        }
      });
  } catch (e) { /* игнорируем */ }
}

/* ============================================================
   ОБРАБОТЧИКИ REALTIME
   ============================================================ */
function handleRealtimeVote(payload) {
  try {
    const row = payload.new || payload.old;
    if (!row) return;

    const date = row.date;
    const role = row.role;
    const value = row.value;

    if (!APP.state.votes[date]) APP.state.votes[date] = {};

    if (payload.eventType === 'DELETE') {
      delete APP.state.votes[date][role];
    } else {
      APP.state.votes[date][role] = value;
    }

    recalcStats();
    saveState();

    if (typeof renderAll === 'function') renderAll();
    if (typeof renderAchievements === 'function') renderAchievements();
    if (typeof renderCalendar === 'function' &&
        typeof isScreenActive === 'function' &&
        isScreenActive('calendar')) {
      renderCalendar();
    }
    if (typeof renderChart === 'function' &&
        typeof isScreenActive === 'function' &&
        isScreenActive('chart')) {
      renderChart();
    }

    /* Toast — только если партнёр не скрыл оценки */
    const partnerRole = APP.myRole === 'you' ? 'partner' : 'you';
    if (role === partnerRole && !getPartnerHideFlag()) {
      if (typeof showToast === 'function') {
        const name = getPartnerName();
        showToast(name + ' поставил(а) оценку ' + value + ' 💕');
      }
    }
  } catch (e) { /* игнорируем */ }
}

function handleRealtimeCouple(payload) {
  try {
    const row = payload.new;
    if (!row) return;

    let changed = false;

    /* Имя партнёра — из чужого столбца */
    const partnerNameCol = partnerNameColumn();
    const newPartnerName = row[partnerNameCol];
    if (newPartnerName && newPartnerName !== APP.state.partnerName) {
      APP.state.partnerName = newPartnerName;
      changed = true;
      if (typeof showToast === 'function') {
        showToast('Партнёр: ' + newPartnerName + ' 💕');
      }
    }

    /* Моё имя — из своего столбца (на случай смены на другом устройстве) */
    const myNameCol = myNameColumn();
    const newMyName = row[myNameCol];
    if (newMyName && newMyName !== APP.state.myName) {
      APP.state.myName = newMyName;
      changed = true;
    }

    /* Дата старта */
    if (row.start_date) {
      APP.state.startDate = row.start_date;
    }

    /* Флаги скрытия */
    const partnerCol = partnerHideColumn();
    const newPartnerHide = !!row[partnerCol];
    if (newPartnerHide !== APP.state.partnerHideFlag) {
      APP.state.partnerHideFlag = newPartnerHide;
      changed = true;
    }

    const myCol = myHideColumn();
    const newMyHide = !!row[myCol];
    if (newMyHide !== APP.state.hideMyVotes) {
      APP.state.hideMyVotes = newMyHide;
      changed = true;
    }

    saveState();

    if (typeof renderAll === 'function') renderAll();
    if (typeof renderProfile === 'function') renderProfile();
    if (changed && typeof renderCoupleState === 'function') {
      renderCoupleState();
    }
  } catch (e) { /* игнорируем */ }
}

/* ============================================================
   ОТПИСКА
   ============================================================ */
function unsubscribeRealtime() {
  if (!APP.supabaseClient || !APP.realtimeChannel) return;

  try {
    APP.supabaseClient.removeChannel(APP.realtimeChannel);
  } catch (e) { /* игнорируем */ }

  APP.realtimeChannel = null;
}

/* ============================================================
   ОПРЕДЕЛЕНИЕ МОЕЙ РОЛИ В ПАРЕ
   ============================================================
   ВАЖНО: должна быть определена ДО первого вызова
   myNameColumn() / partnerNameColumn() / loadFromSupabase().
   ============================================================ */
function determineMyRole(code) {
  const creator = storageGet(CONFIG.STORAGE.creator + code);

  /* Случай 1: это устройство создавало пару — роль 'you' */
  if (creator && creator === APP.myId) {
    APP.myRole = 'you';
    return;
  }

  /* Случай 2: сохранённый creator — чужой ID, значит я 'partner' */
  if (creator && creator !== APP.myId && creator !== 'other-device') {
    APP.myRole = 'partner';
    return;
  }

  /* Случай 3: смотрим на состояние пары НА СЕРВЕРЕ, а не локально.
     Функция станет async — вызывающий код уже её await'ит. */
  APP.myRole = 'you'; /* временно, перезапишем ниже */
}