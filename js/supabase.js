/* ============================================================
   SUPABASE — синхронизация между партнёрами
   ============================================================
   Файл полностью опционален. Если в js/config.js ключи пустые,
   всё работает вхолостую.

   Что синхронизируется:
   - голоса (таблица votes)
   - имена пары (couples.names)
   - дата старта (couples.start_date)
   - флаги скрытия оценок (couples.hide_you, couples.hide_partner)

   Как устроены флаги скрытия:
   - hide_you     = true, если партнёр 'you' скрыл СВОИ оценки
   - hide_partner = true, если партнёр 'partner' скрыл СВОИ оценки

   Каждое устройство знает только свой флаг (hideMyVotes) и
   определяет свой столбец через APP.myRole:
   - если myRole='you'   → пишу в hide_you
   - если myRole='partner' → пишу в hide_partner

   При чтении:
   - если myRole='you'     → чужой флаг это hide_partner
   - если myRole='partner' → чужой флаг это hide_you
   ============================================================ */

/* ============================================================
   КЛЮЧИ СТОЛБЦОВ ДЛЯ МОЕГО/ЧУЖОГО ФЛАГА
   ============================================================ */
function myHideColumn() {
  return APP.myRole === 'you' ? 'hide_you' : 'hide_partner';
}

function partnerHideColumn() {
  return APP.myRole === 'you' ? 'hide_partner' : 'hide_you';
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

    APP.state.names = couple.names || APP.state.names;
    APP.state.startDate = couple.start_date || APP.state.startDate;

    /* Читаем флаг партнёра — тот столбец, который НЕ мой */
    const partnerCol = partnerHideColumn();
    APP.state.partnerHideFlag = !!couple[partnerCol];

    /* Мой флаг тоже восстанавливаем с сервера — на случай,
       если я переустановил приложение, а флаг уже был включён */
    const myCol = myHideColumn();
    const serverMyFlag = !!couple[myCol];
    if (serverMyFlag !== APP.state.hideMyVotes) {
      APP.state.hideMyVotes = serverMyFlag;
    }

    /* Голоса */
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
   Отправляем на сервер:
   - names
   - start_date
   - СВОЙ столбец флага скрытия (только свой, не чужой!)

   Другой столбец не трогаем — за него отвечает партнёр.
   ============================================================ */
async function pushCoupleMeta() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const myCol = myHideColumn();

    const payload = {
      id: APP.coupleId,
      names: APP.state.names,
      start_date: APP.state.startDate,
      updated_at: new Date().toISOString()
    };

    /* Устанавливаем только свой столбец */
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
   ОБНОВЛЕНИЕ ТОЛЬКО ФЛАГА СКРЫТИЯ
   ============================================================
   Отдельная функция для togglePrivacy, чтобы не перезаписывать
   лишние поля (например, names — если партнёр изменил имена,
   а я одновременно меняю флаг, я их не затрону).
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
   Оба столбца флагов создаются со значением false.
   ============================================================ */
async function createCoupleInSupabase(code) {
  if (!APP.supabaseClient) return false;

  try {
    const myCol = myHideColumn();

    const payload = {
      id: code,
      names: APP.state.names,
      start_date: APP.state.startDate,
      hide_you: false,
      hide_partner: false
    };

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

    if (role === 'partner' && APP.myRole === 'you' && !getPartnerHideFlag()) {
      if (typeof showToast === 'function') {
        showToast('Партнёр поставил оценку ' + value + ' 💕');
      }
    }
    if (role === 'you' && APP.myRole === 'partner' && !getPartnerHideFlag()) {
      if (typeof showToast === 'function') {
        showToast('Партнёр поставил оценку ' + value + ' 💕');
      }
    }
  } catch (e) { /* игнорируем */ }
}

function handleRealtimeCouple(payload) {
  try {
    const row = payload.new;
    if (!row) return;

    APP.state.names = row.names || APP.state.names;
    APP.state.startDate = row.start_date || APP.state.startDate;

    /* Флаг партнёра — из чужого столбца */
    const partnerCol = partnerHideColumn();
    const newPartnerHide = !!row[partnerCol];

    /* Флаг мой — из своего столбца. Если он пришёл другим
       (например, я включил на другом устройстве) — применяем. */
    const myCol = myHideColumn();
    const newMyHide = !!row[myCol];

    let changed = false;

    if (newPartnerHide !== APP.state.partnerHideFlag) {
      APP.state.partnerHideFlag = newPartnerHide;
      changed = true;
    }
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
   ВАЖНО: роль должна быть определена ДО первого вызова
   myHideColumn() / partnerHideColumn() / loadFromSupabase(),
   иначе мы будем читать/писать не тот столбец.
   ============================================================ */
function determineMyRole(code) {
  const creator = storageGet(CONFIG.STORAGE.creator + code);

  if (creator && creator === APP.myId) {
    APP.myRole = 'you';
    return;
  }

  if (creator && creator !== 'other-device') {
    APP.myRole = 'partner';
    return;
  }

  /* Информации о создателе нет — определяем по первому
     свободному слоту в сегодняшнем дне */
  const today = APP.state.votes[todayStr()];
  if (today) {
    if (today.you && !today.partner) {
      APP.myRole = 'partner';
      storageSet(CONFIG.STORAGE.creator + code, 'other-device');
      return;
    }
    if (today.partner && !today.you) {
      APP.myRole = 'you';
      storageSet(CONFIG.STORAGE.creator + code, APP.myId);
      return;
    }
  }

  APP.myRole = 'partner';
}