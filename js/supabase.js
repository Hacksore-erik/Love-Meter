/* ============================================================
   SUPABASE — синхронизация пары, realtime, presence, роли
   ============================================================ */

/* ---------- КОЛОНКИ (зависят от роли) ---------- */

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

function myGenderColumn() {
  return APP.myRole === 'you' ? 'gender_you' : 'gender_partner';
}

function partnerGenderColumn() {
  return APP.myRole === 'you' ? 'gender_partner' : 'gender_you';
}

/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */

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
      if (typeof LM !== 'undefined') {
        LM.record('LM-016', e.message || 'import supabase failed',
          (e.stack || '').substring(0, 300));
      }
      return null;
    }
  })();

  return APP.supabaseLoading;
}

/* ---------- РОЛЬ ---------- */

async function determineMyRole(code) {
  if (!APP.supabaseClient) {
    APP.myRole = 'partner';
    return;
  }

  try {
    const res = await APP.supabaseClient
      .from('couples')
      .select('owner_id')
      .eq('id', code)
      .maybeSingle();

    if (res.data && res.data.owner_id) {
      APP.myRole = (res.data.owner_id === APP.myId) ? 'you' : 'partner';
      return;
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-021', e.message || 'determineMyRole failed', 'code=' + code);
    }
  }

  APP.myRole = 'partner';
}

/* ---------- ЗАГРУЗКА ---------- */

async function loadFromSupabase() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const coupleRes = await APP.supabaseClient
      .from('couples')
      .select('*')
      .eq('id', APP.coupleId)
      .maybeSingle();

    if (coupleRes.error || !coupleRes.data) {
      if (typeof LM !== 'undefined' && coupleRes.error) {
        LM.record('LM-017',
          coupleRes.error.message || 'couples.select failed',
          'code=' + APP.coupleId);
      }
      return false;
    }

    const couple = coupleRes.data;

    const sName = couple[myNameColumn()];
    const sPN = couple[partnerNameColumn()];
    const sGen = couple[myGenderColumn()];
    const sPGen = couple[partnerGenderColumn()];

    if (sName) APP.state.myName = sName;
    if (sPN) APP.state.partnerName = sPN;
    if (sGen === 'f' || sGen === 'm') APP.state.myGender = sGen;
    if (sPGen === 'f' || sPGen === 'm') APP.state.partnerGender = sPGen;

    APP.state.startDate = couple.start_date || APP.state.startDate;
    APP.state.partnerHideFlag = !!couple[partnerHideColumn()];

    const serverMyFlag = !!couple[myHideColumn()];
    if (serverMyFlag !== APP.state.hideMyVotes) {
      APP.state.hideMyVotes = serverMyFlag;
    }

    const votesRes = await APP.supabaseClient
      .from('votes')
      .select('*')
      .eq('couple_id', APP.coupleId);

    if (votesRes.error) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-017',
          votesRes.error.message || 'votes.select failed',
          'code=' + APP.coupleId);
      }
      return false;
    }

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
    if (typeof LM !== 'undefined') {
      LM.record('LM-017', e.message || 'loadFromSupabase crashed',
        (e.stack || '').substring(0, 300));
    }
    return false;
  }
}

/* ---------- ОТПРАВКА ---------- */

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

    if (res.error) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-018', res.error.message || 'upsert failed',
          'date=' + date + ' role=' + role);
      }
      return false;
    }
    return true;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-018', e.message || 'pushVote crashed', 'date=' + date);
    }
    return false;
  }
}

async function pushMyName() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const update = {};
    update[myNameColumn()] = getMyName();
    update[myGenderColumn()] = getMyGender() || '';
    update.updated_at = new Date().toISOString();

    const res = await APP.supabaseClient
      .from('couples')
      .update(update)
      .eq('id', APP.coupleId);

    if (res.error) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-022', res.error.message || 'pushMyName failed',
          'code=' + APP.coupleId);
      }
      return false;
    }
    return true;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-022', e.message || 'pushMyName crashed', '');
    }
    return false;
  }
}

async function pushMyHideFlag() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const update = {};
    update[myHideColumn()] = !!APP.state.hideMyVotes;
    update.updated_at = new Date().toISOString();

    const res = await APP.supabaseClient
      .from('couples')
      .update(update)
      .eq('id', APP.coupleId);

    if (res.error) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-023', res.error.message || 'pushMyHideFlag failed',
          'code=' + APP.coupleId);
      }
      return false;
    }
    return true;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-023', e.message || 'pushMyHideFlag crashed', '');
    }
    return false;
  }
}

async function pushCoupleMeta() {
  if (!APP.supabaseClient || !APP.coupleId) return false;

  try {
    const payload = {
      id: APP.coupleId,
      start_date: APP.state.startDate,
      updated_at: new Date().toISOString()
    };
    payload[myNameColumn()] = getMyName();
    payload[myGenderColumn()] = getMyGender() || '';
    payload[myHideColumn()] = !!APP.state.hideMyVotes;

    const res = await APP.supabaseClient
      .from('couples')
      .upsert(payload);

    if (res.error) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-022', res.error.message || 'pushCoupleMeta failed',
          'code=' + APP.coupleId);
      }
      return false;
    }
    return true;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-022', e.message || 'pushCoupleMeta crashed', '');
    }
    return false;
  }
}

/* ---------- СОЗДАНИЕ / ПРОВЕРКА ПАРЫ ---------- */

async function createCoupleInSupabase(code) {
  if (!APP.supabaseClient) return false;

  try {
    const payload = {
      id: code,
      owner_id: APP.myId,
      start_date: APP.state.startDate,
      name_you: getMyName(),
      name_partner: '',
      gender_you: getMyGender() || '',
      gender_partner: '',
      hide_you: false,
      hide_partner: false
    };

    const res = await APP.supabaseClient
      .from('couples')
      .insert(payload);

    if (res.error) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-020', res.error.message || 'insert failed', 'code=' + code);
      }
      return false;
    }
    return true;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-020', e.message || 'createCouple crashed', 'code=' + code);
    }
    return false;
  }
}

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

/* ---------- МАССОВАЯ СИНХРОНИЗАЦИЯ ---------- */

async function syncAllLocalVotesToSupabase() {
  if (!APP.supabaseClient || !APP.coupleId) return;

  const promises = [];
  const votes = APP.state.votes;

  for (const date in votes) {
    const v = votes[date];
    if (v.you) promises.push(pushVoteToSupabase(date, 'you', v.you));
    if (v.partner) promises.push(pushVoteToSupabase(date, 'partner', v.partner));
  }

  try { await Promise.all(promises); } catch (e) {}

  await pushCoupleMeta();
}

/* ---------- REALTIME + PRESENCE ---------- */

function subscribeRealtime() {
  if (!APP.supabaseClient || !APP.coupleId) return;

  if (APP.realtimeChannel) {
    try { APP.supabaseClient.removeChannel(APP.realtimeChannel); } catch (e) {}
    APP.realtimeChannel = null;
  }

  try {
    APP.realtimeChannel = APP.supabaseClient
      .channel('couple:' + APP.coupleId, {
        config: { presence: { key: APP.myId || 'me' } }
      })
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
      .on('presence', { event: 'sync' }, function () {
        handlePresenceSync();
      })
      .on('presence', { event: 'join' }, function () {
        handlePresenceSync();
      })
      .on('presence', { event: 'leave' }, function () {
        handlePresenceSync();
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          if (typeof updateSyncDot === 'function') updateSyncDot('on');
          // Регистрируем себя в presence — чтобы партнёр видел нас онлайн
          try {
            APP.realtimeChannel.track({
              online_at: new Date().toISOString(),
              my_id: APP.myId
            });
          } catch (e) {}
        } else {
          if (typeof updateSyncDot === 'function') updateSyncDot('off');
        }
      });
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-019', e.message || 'subscribeRealtime failed',
        'code=' + APP.coupleId);
    }
  }
}

/* Проверяет presence-состояние канала: есть ли кто-то кроме нас */
function handlePresenceSync() {
  try {
    if (!APP.realtimeChannel) return;

    const state = APP.realtimeChannel.presenceState() || {};
    let partnerOnline = false;

    for (const key in state) {
      const metas = state[key];
      if (!Array.isArray(metas)) continue;
      for (let i = 0; i < metas.length; i++) {
        const m = metas[i];
        if (m && m.my_id && m.my_id !== APP.myId) {
          partnerOnline = true;
          break;
        }
      }
      if (partnerOnline) break;
    }

    if (typeof setPartnerOnline === 'function') {
      setPartnerOnline(partnerOnline);
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-019', e.message || 'handlePresenceSync failed', '');
    }
  }
}

function handleRealtimeVote(payload) {
  try {
    const row = payload.new || payload.old;
    if (!row) return;

    const date = row.date;
    const role = row.role;
    const value = row.value;

    if (!date || !role) return;
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
    if (typeof isScreenActive === 'function' && isScreenActive('calendar') &&
        typeof renderCalendar === 'function') {
      renderCalendar();
    }
    if (typeof isScreenActive === 'function' && isScreenActive('chart') &&
        typeof renderChart === 'function') {
      renderChart();
    }

    const partnerRole = APP.myRole === 'you' ? 'partner' : 'you';
    if (role === partnerRole && !getPartnerHideFlag()) {
      if (typeof showToast === 'function') {
        showToast(getPartnerName() + ' ' + getPartnerVerb() + ' оценку ' + value + ' 💕');
      }
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-019', e.message || 'handleRealtimeVote crashed', '');
    }
  }
}

function handleRealtimeCouple(payload) {
  try {
    const row = payload.new;
    if (!row) return;

    let changed = false;

    const newPN = row[partnerNameColumn()];
    if (newPN && newPN !== APP.state.partnerName) {
      APP.state.partnerName = newPN;
      changed = true;
      if (typeof showToast === 'function') {
        showToast('Партнёр: ' + newPN + ' 💕');
      }
    }

    const newPG = row[partnerGenderColumn()];
    if ((newPG === 'f' || newPG === 'm') && newPG !== APP.state.partnerGender) {
      APP.state.partnerGender = newPG;
      changed = true;
    }

    const newMN = row[myNameColumn()];
    if (newMN && newMN !== APP.state.myName) {
      APP.state.myName = newMN;
      changed = true;
    }

    const newMG = row[myGenderColumn()];
    if ((newMG === 'f' || newMG === 'm') && newMG !== APP.state.myGender) {
      APP.state.myGender = newMG;
      changed = true;
    }

    if (row.start_date) APP.state.startDate = row.start_date;

    const newPH = !!row[partnerHideColumn()];
    if (newPH !== APP.state.partnerHideFlag) {
      APP.state.partnerHideFlag = newPH;
      changed = true;
    }

    const newMH = !!row[myHideColumn()];
    if (newMH !== APP.state.hideMyVotes) {
      APP.state.hideMyVotes = newMH;
      changed = true;
    }

    saveState();

    if (typeof renderAll === 'function') renderAll();
    if (typeof renderProfile === 'function') renderProfile();
    if (changed && typeof renderCoupleState === 'function') renderCoupleState();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-019', e.message || 'handleRealtimeCouple crashed', '');
    }
  }
}

function unsubscribeRealtime() {
  if (!APP.supabaseClient || !APP.realtimeChannel) return;
  try { APP.realtimeChannel.untrack(); } catch (e) {}
  try { APP.supabaseClient.removeChannel(APP.realtimeChannel); } catch (e) {}
  APP.realtimeChannel = null;
  if (typeof setPartnerOnline === 'function') {
    setPartnerOnline(false);
  }
}