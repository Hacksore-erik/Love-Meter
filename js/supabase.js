/* ============================================================
   SUPABASE — синхронизация между партнёрами
   ============================================================
   Этот файл полностью опционален. Если в js/config.js
   переменная CONFIG.SUPABASE.url и .anonKey пустые,
   весь модуль работает вхолостую и не мешает приложению.

   Что делает:
   - Ленивая загрузка клиента Supabase через ESM
   - Загрузка данных пары и голосов с сервера
   - Отправка новых голосов
   - Подписка на realtime-обновления от партнёра
   - Обновление метаданных пары (имена, startDate, openMode)

   Все функции обёрнуты в try/catch. Любая ошибка сети или
   отсутствие ключей не должны ломать приложение — оно
   продолжит работать в локальном режиме.
   ============================================================ */

/* ============================================================
   ЗАГРУЗКА КЛИЕНТА
   ============================================================
   Динамический import() грузим только если ключи заданы.
   Один раз — сохраняем Promise в APP.supabaseLoading,
   чтобы повторные вызовы не запускали загрузку заново.
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
   ============================================================
   Тянет метаданные пары + все голоса. Заменяет APP.state.votes
   на полученные с сервера. Сохраняет локально.
   Возвращает true, если удалось.
   ============================================================ */
async function loadFromSupabase() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    /* --- Метаданные пары --- */
    const coupleRes = await APP.supabaseClient
      .from('couples')
      .select('*')
      .eq('id', APP.coupleId)
      .maybeSingle();

    if (coupleRes.error || !coupleRes.data) return false;

    const couple = coupleRes.data;
    APP.state.names = couple.names || APP.state.names;
    APP.state.startDate = couple.start_date || APP.state.startDate;
    APP.state.openMode = !!couple.open_mode;

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
   ============================================================
   Upsert (insert или update) одной записи.
   onConflict — по (couple_id, date, role), чтобы повторный
   голос в тот же день просто перезаписал существующий.
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
   Используется при смене имён, openMode, startDate.
   ============================================================ */
async function pushCoupleMeta() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const res = await APP.supabaseClient
      .from('couples')
      .upsert({
        id: APP.coupleId,
        names: APP.state.names,
        start_date: APP.state.startDate,
        open_mode: APP.state.openMode,
        updated_at: new Date().toISOString()
      });

    return !res.error;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   СОЗДАНИЕ ПАРЫ
   ============================================================
   Вставляет новую строку в таблицу couples. Если пара с таким
   кодом уже существует — insert вернёт ошибку, и мы вернём false.
   ============================================================ */
async function createCoupleInSupabase(code) {
  if (!APP.supabaseClient) return false;

  try {
    const res = await APP.supabaseClient
      .from('couples')
      .insert({
        id: code,
        names: APP.state.names,
        start_date: APP.state.startDate,
        open_mode: false
      });

    return !res.error;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   ПРОВЕРКА СУЩЕСТВОВАНИЯ ПАРЫ
   ============================================================
   Возвращает true, если пара с таким кодом есть.
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
   ============================================================
   Когда пользователь создаёт пару, все оценки, что он ставил
   до этого в локальном режиме, нужно перенести на сервер.
   Иначе при подключении партнёра они пропадут.
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
  } catch (e) { /* игнорируем — важен сам факт попытки */ }

  await pushCoupleMeta();
}

/* ============================================================
   ПОДПИСКА НА REALTIME
   ============================================================
   Слушаем изменения в двух таблицах:
   - votes, где couple_id = наш код
   - couples, где id = наш код

   Всё, что приходит, применяется к APP.state через
   handleRealtimeVote / handleRealtimeCouple.
   ============================================================ */
function subscribeRealtime() {
  if (!APP.supabaseClient || !APP.coupleId) return;

  /* Отписываемся от предыдущего канала, если был */
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
   ОБРАБОТЧИКИ REALTIME-СОБЫТИЙ
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

    /* Перерисовка интерфейса, если функции доступны */
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

    /* Уведомление, если это партнёр проголосовал */
    if (role === 'partner' && APP.myRole === 'you') {
      if (typeof showToast === 'function') {
        showToast('Партнёр поставил оценку ' + value + ' 💕');
      }
    }
  } catch (e) { /* не роняем приложение */ }
}

function handleRealtimeCouple(payload) {
  try {
    const row = payload.new;
    if (!row) return;

    APP.state.names = row.names || APP.state.names;
    APP.state.startDate = row.start_date || APP.state.startDate;
    APP.state.openMode = !!row.open_mode;

    saveState();

    if (typeof renderAll === 'function') renderAll();
    if (typeof renderProfile === 'function') renderProfile();
  } catch (e) { /* игнорируем */ }
}

/* ============================================================
   ОТПИСКА
   ============================================================
   Вызывается при отключении пары или перед закрытием.
   ============================================================ */
function unsubscribeRealtime() {
  if (!APP.supabaseClient || !APP.realtimeChannel) return;

  try {
    APP.supabaseClient.removeChannel(APP.realtimeChannel);
  } catch (e) { /* игнорируем */ }

  APP.realtimeChannel = null;
}

/* ============================================================
   ПРОВЕРКА МОЕЙ РОЛИ В ПАРЕ
   ============================================================
   Роль определяется так:
   - Если это устройство создавало пару (сохранили свой myId
     в ключе creator_of_<code>) — роль 'you'.
   - Иначе — роль 'partner'.

   Это нужно, чтобы два устройства одной пары писали свои
   оценки в разные поля (you / partner).
   ============================================================ */
function determineMyRole(code) {
  const creator = storageGet(CONFIG.STORAGE.creator + code);
  if (creator && creator === APP.myId) {
    APP.myRole = 'you';
  } else if (creator) {
    APP.myRole = 'partner';
  } else {
    APP.myRole = 'you';
  }
}