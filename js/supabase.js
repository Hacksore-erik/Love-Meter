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

/* Определение роли по owner_id — кто создал пару, тот 'you' */
async function determineMyRole(code) {
  const localCreator = storageGet(CONFIG.STORAGE.creator + code);
  if (localCreator && localCreator === APP.myId) {
    APP.myRole = 'you';
    return;
  }

  if (APP.supabaseClient) {
    try {
      const res = await APP.supabaseClient
        .from('couples')
        .select('owner_id')
        .eq('id', code)
        .maybeSingle();

      if (res.data && res.data.owner_id) {
        if (res.data.owner_id === APP.myId) {
          APP.myRole = 'you';
          storageSet(CONFIG.STORAGE.creator + code, APP.myId);
        } else {
          APP.myRole = 'partner';
          storageSet(CONFIG.STORAGE.creator + code, res.data.owner_id);
        }
        return;
      }
    } catch (e) {}
  }

  /* Fallback: если владелец неизвестен — мы партнёр */
  APP.myRole = 'partner';
}

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

    return !res.error;
  } catch (e) {
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

    return !res.error;
  } catch (e) {
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

    return !res.error;
  } catch (e) {
    return false;
  }
}

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

    return !res.error;
  } catch (e) {
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

function subscribeRealtime() {
  if (!APP.supabaseClient || !APP.coupleId) return;

  if (APP.realtimeChannel) {
    try { APP.supabaseClient.removeChannel(APP.realtimeChannel); } catch (e) {}
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
  } catch (e) {}
}

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

    const partnerRole = APP.myRole === 'you' ? 'partner' : 'you';
    if (role === partnerRole && !getPartnerHideFlag()) {
      if (typeof showToast === 'function') {
        showToast(getPartnerName() + ' ' + getPartnerVerb() + ' оценку ' + value + ' 💕');
      }
    }
  } catch (e) {}
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
    if (changed && typeof renderCoupleState === 'function') {
      renderCoupleState();
    }
  } catch (e) {}
}

function unsubscribeRealtime() {
  if (!APP.supabaseClient || !APP.realtimeChannel) return;
  try { APP.supabaseClient.removeChannel(APP.realtimeChannel); } catch (e) {}
  APP.realtimeChannel = null;
}