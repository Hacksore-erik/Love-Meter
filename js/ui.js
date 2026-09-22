let toastTimer = null;

function showToast(msg, duration) {
  try {
    const toast = $('toast');
    if (!toast) return;
    duration = duration || 2200;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, duration);
  } catch (e) {}
}

function updateSyncDot(status) {
  const dot = $('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot';
  if (status === 'on') { dot.classList.add('on'); dot.title = 'Синхронизировано'; }
  else if (status === 'off') { dot.classList.add('off'); dot.title = 'Нет связи'; }
  else { dot.classList.add('local'); dot.title = 'Локальный режим'; }
}

function switchTab(tab) {
  try {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('active', s.dataset.screen === tab);
    });
    document.querySelectorAll('.tab-item').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    if (tab === 'awards') renderAchievements();
    if (tab === 'calendar') renderCalendar();
    if (tab === 'chart') renderChart();
    if (tab === 'profile') { renderProfile(); updateErrorLogCount(); }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-029', e.message || 'Ошибка switchTab', 'tab=' + tab);
    }
  }
}

function isScreenActive(name) {
  const s = document.querySelector('.screen[data-screen="' + name + '"]');
  return !!(s && s.classList.contains('active'));
}

/* ---------- ПРОФИЛЬ ---------- */

function renderProfile() {
  const pn = $('profileNames');
  if (pn) pn.textContent = buildCoupleTitle();

  const days = daysBetween(parseDate(APP.state.startDate), new Date()) + 1;
  const sub = $('profileSub');
  if (sub) sub.textContent = 'Вместе • ' + days + ' дней в Love Meter';

  const youEmoji = $('profileYouIcon');
  if (youEmoji) youEmoji.textContent = getMyGenderEmoji();

  const partnerEmoji = $('profilePartnerIcon');
  if (partnerEmoji) partnerEmoji.textContent = getPartnerGenderEmoji();

  const youEl = $('profileYouName');
  if (youEl) youEl.textContent = getMyName();

  const partnerEl = $('profilePartnerName');
  if (partnerEl) partnerEl.textContent = getPartnerName();

  const pv = $('privacyValue');
  if (pv) pv.textContent = APP.state.hideMyVotes ? 'Скрыто' : 'Открыто';

  const cb = $('coupleBtnValue');
  if (cb) cb.textContent = APP.coupleId ? 'Код: ' + APP.coupleId : 'Не подключена';
}

function buildCoupleTitle() {
  const you = getMyName();
  const partner = getPartnerName();
  const youDefault = you === CONFIG.DEFAULTS.myName;
  const partnerDefault = partner === CONFIG.DEFAULTS.partnerName;

  if (youDefault && partnerDefault) return CONFIG.DEFAULTS.names;
  if (partnerDefault) return you;
  if (youDefault) return partner;
  return you + ' & ' + partner;
}

/* ---------- МОДАЛКА ---------- */

function openModal(htmlContent) {
  try {
    const modal = $('coupleModal');
    const content = $('coupleModalContent');
    if (!modal || !content) return;

    modal.classList.remove('show');
    content.innerHTML = htmlContent;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modal.classList.add('show');
      });
    });
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-013', e.message || 'Ошибка открытия модалки');
    }
  }
}

function closeModal() {
  const modal = $('coupleModal');
  if (modal) modal.classList.remove('show');
}

/* ---------- МОДАЛКА ПАРЫ ---------- */

function openCoupleModal() {
  if (APP.coupleId) {
    openModal(
      '<h3>Ваша пара</h3>' +
      '<p>Партнёр должен ввести этот код на своём устройстве, чтобы видеть ваши оценки.</p>' +
      '<div class="code-display">' +
        '<div class="code">' + APP.coupleId + '</div>' +
        '<div class="hint">Поделитесь кодом с партнёром</div>' +
      '</div>' +
      '<button type="button" class="modal-btn primary" data-action="copy-code">Скопировать код</button>' +
      '<button type="button" class="modal-btn danger" data-action="disconnect">Отключить пару</button>' +
      '<button type="button" class="modal-btn secondary" data-action="close">Закрыть</button>'
    );
    return;
  }

  if (!HAS_SUPABASE) {
    openModal(
      '<h3>Одиночный режим</h3>' +
      '<p>Приложение работает локально. Чтобы синхронизироваться с партнёром, добавьте ключи Supabase в js/config.js.</p>' +
      '<button type="button" class="modal-btn primary" data-action="close">Понятно</button>'
    );
    return;
  }

  openModal(
    '<h3>Подключить пару</h3>' +
    '<p>Создайте новую пару или введите код, который прислал партнёр.</p>' +
    '<button type="button" class="modal-btn primary" data-action="create">Создать новую пару</button>' +
    '<input type="text" id="joinCodeInput" placeholder="ABC123" maxlength="6" ' +
      'autocapitalize="characters" autocomplete="off" inputmode="text">' +
    '<button type="button" class="modal-btn secondary" data-action="join">Подключиться к паре</button>' +
    '<button type="button" class="modal-btn secondary" data-action="close">Отмена</button>'
  );
}

async function onCoupleModalAction(action) {
  if (action === 'close') { closeModal(); return; }

  if (action === 'copy-code') {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(APP.coupleId);
        showToast('Код скопирован 💌');
      } else {
        showToast('Код: ' + APP.coupleId, 4000);
      }
    } catch (e) {
      showToast('Код: ' + APP.coupleId, 4000);
    }
    return;
  }

  if (action === 'disconnect') {
    if (!confirm('Отключить пару? Локальные данные сохранятся.')) return;
    const oldCode = APP.coupleId;
    storageRemove(CONFIG.STORAGE.couple);
    if (oldCode) storageRemove(CONFIG.STORAGE.creator + oldCode);
    APP.coupleId = null;
    APP.state.partnerHideFlag = false;
    APP.state.partnerName = CONFIG.DEFAULTS.partnerName;
    APP.state.partnerGender = '';
    unsubscribeRealtime();
    updateSyncDot('local');
    closeModal();
    renderProfile();
    renderAll();
    showToast('Пара отключена');
    return;
  }

  if (action === 'create') {
    await initSupabaseAsync();
    if (!APP.supabaseClient) {
      showToast('Не удалось подключиться к Supabase');
      return;
    }

    /* Роль 'you' — ДО создания пары, чтобы owner_id и имя писались корректно */
    APP.myRole = 'you';

    const code = generateCoupleCode();
    const ok = await createCoupleInSupabase(code);
    if (!ok) {
      if (typeof LM !== 'undefined') {
        LM.record('LM-020', 'createCoupleInSupabase вернул false', 'code=' + code);
      }
      showToast('Не удалось создать пару');
      return;
    }

    APP.coupleId = code;
    storageSet(CONFIG.STORAGE.couple, code);
    storageSet(CONFIG.STORAGE.creator + code, APP.myId);

    await syncAllLocalVotesToSupabase();
    subscribeRealtime();
    updateSyncDot('on');
    closeModal();
    renderProfile();
    showToast('Пара создана! Код: ' + code, 3500);
    return;
  }

  if (action === 'join') {
    await initSupabaseAsync();
    if (!APP.supabaseClient) {
      showToast('Не удалось подключиться к Supabase');
      return;
    }

    const input = $('joinCodeInput');
    const code = (input ? input.value : '').trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      showToast('Код — 6 символов (A–Z, 0–9)');
      return;
    }

    const exists = await checkCoupleExists(code);
    if (!exists) {
      showToast('Пара с таким кодом не найдена');
      return;
    }

    APP.coupleId = code;
    storageSet(CONFIG.STORAGE.couple, code);

    /* determineMyRole смотрит owner_id на сервере */
    await determineMyRole(code);
    await loadFromSupabase();
    await pushMyName();

    subscribeRealtime();
    updateSyncDot('on');
    closeModal();
    renderProfile();
    renderAll();
    renderAchievements();
    showToast('Подключено к паре ' + code + ' 💕');
    return;
  }
}

function generateCoupleCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ---------- МОДАЛКА «МОЁ ИМЯ» ---------- */

function openMyNameModal() {
  const myGender = getMyGender();
  const canSave = myGender === 'f' || myGender === 'm';

  openModal(
    '<h3>Как тебя зовут?</h3>' +
    '<p>Это увидят только вы вдвоём. Имя партнёра подтянется автоматически.</p>' +
    '<input type="text" id="myNameInput" placeholder="Твоё имя" maxlength="30" ' +
      'autocomplete="off" value="' + escapeHtml(getMyName()) + '">' +
    '<div class="gender-label">Твой пол</div>' +
    '<div class="gender-select" id="genderSelect">' +
      '<button type="button" class="gender-btn' + (myGender === 'f' ? ' active' : '') + '" data-gender="f">' +
        '<span class="gender-emoji">👩</span>' +
        '<span class="gender-text">Она</span>' +
      '</button>' +
      '<button type="button" class="gender-btn' + (myGender === 'm' ? ' active' : '') + '" data-gender="m">' +
        '<span class="gender-emoji">👨</span>' +
        '<span class="gender-text">Он</span>' +
      '</button>' +
    '</div>' +
    '<button type="button" class="modal-btn primary" data-action="save-my-name" id="saveMyNameBtn"' +
      (canSave ? '' : ' disabled') + '>Сохранить</button>' +
    '<button type="button" class="modal-btn secondary" data-action="close">Отмена</button>'
  );

  setTimeout(function () {
    const inp = $('myNameInput');
    if (inp) { inp.focus(); inp.select(); }
  }, 150);
}

function onGenderBtnClick(gender) {
  if (gender !== 'f' && gender !== 'm') return;
  document.querySelectorAll('.gender-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.gender === gender);
  });
  const btn = $('saveMyNameBtn');
  if (btn) btn.disabled = false;
}

async function onMyNameModalAction(action) {
  if (action === 'close') { closeModal(); return; }

  if (action === 'save-my-name') {
    const inp = $('myNameInput');
    const val = (inp ? inp.value : '').trim();

    if (!val) { showToast('Введи своё имя'); return; }

    const activeGenderBtn = document.querySelector('.gender-btn.active');
    const gender = activeGenderBtn ? activeGenderBtn.dataset.gender : '';

    if (gender !== 'f' && gender !== 'm') {
      showToast('Выбери пол');
      return;
    }

    setMyName(val);
    setMyGender(gender);

    if (APP.supabaseClient && APP.coupleId) {
      try { await pushMyName(); } catch (e) {}
    }

    closeModal();
    renderProfile();
    renderAll();
    showToast('Сохранено 💕');
    return;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- ИНФО ---------- */

function openAboutModal() {
  const mode = HAS_SUPABASE
    ? (APP.coupleId ? 'с синхронизацией' : 'локальный, Supabase доступен')
    : 'локальный';

  openModal(
    '<h3>Love Meter</h3>' +
    '<p>Трекер эмоционального состояния пары.<br>Версия 1.4 • Режим: ' + mode + '</p>' +
    '<p style="font-size:12px;margin-bottom:20px;">Данные хранятся в браузере.</p>' +
    '<button type="button" class="modal-btn primary" data-action="close">Закрыть</button>'
  );
}

/* ---------- ПРИВАТНОСТЬ ---------- */

async function togglePrivacy() {
  try {
    APP.state.hideMyVotes = !APP.state.hideMyVotes;
    saveState();

    if (APP.supabaseClient && APP.coupleId) {
      const ok = await pushMyHideFlag();
      if (!ok) showToast('Сохранено локально ⏳');
      else showToast(APP.state.hideMyVotes ? 'Оценки скрыты 🔒' : 'Оценки видны 👀');
    } else {
      showToast(APP.state.hideMyVotes ? 'Оценки скрыты 🔒' : 'Оценки видны 👀');
    }

    renderProfile();
    renderAll();
    if (isScreenActive('chart')) renderChart();
  } catch (e) {}
}

/* ---------- СБРОС ---------- */

function resetAllData() {
  if (!confirm('Сбросить ВСЕ данные приложения? Это необратимо.')) return;
  storageRemove(CONFIG.STORAGE.state);
  storageRemove(CONFIG.STORAGE.couple);
  location.reload();
}

function onCoupleStatePeriodClick(period) {
  if (period !== 'week' && period !== 'month') return;
  APP.coupleStatePeriod = period;
  storageSet(CONFIG.STORAGE.coupleStatePeriod, period);
  renderCoupleState();
}

/* ---------- PDF ---------- */

let html2pdfLoading = null;

function ensureHtml2Pdf() {
  if (typeof window.html2pdf !== 'undefined') return Promise.resolve(window.html2pdf);
  if (html2pdfLoading) return html2pdfLoading;

  html2pdfLoading = new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = function () {
      if (typeof window.html2pdf !== 'undefined') resolve(window.html2pdf);
      else reject(new Error('html2pdf не определён'));
    };
    script.onerror = function () { reject(new Error('Ошибка загрузки html2pdf')); };
    document.head.appendChild(script);
  });

  return html2pdfLoading;
}

async function exportPDF() {
  showToast('Готовим PDF...');

  try { await ensureHtml2Pdf(); }
  catch (e) {
    if (typeof LM !== 'undefined') LM.record('LM-015', e.message || 'Ошибка html2pdf');
    showToast('Не удалось загрузить библиотеку PDF');
    return;
  }

  try {
    const couple = computeCouplePercent('week');
    const days = daysBetween(parseDate(APP.state.startDate), new Date()) + 1;

    setText('pdfNames', buildCoupleTitle());
    setText('pdfDays', days + ' дней в Love Meter');
    setText('pdfAvg', couple.hasData ? (couple.percent + '%') : '—');
    setText('pdfTotalDays', days);
    setText('pdfStreak', APP.state.streak);

    const moments = collectMoments();
    const pm = $('pdfMoments');
    if (pm) pm.innerHTML = moments.map(function (m) { return '<li>' + m + '</li>'; }).join('');

    const unlocked = CONFIG.ACHIEVEMENTS.filter(function (a) {
      return getAchievementProgress(a) >= a.max;
    });
    const pa = $('pdfAchievements');
    if (pa) {
      pa.innerHTML = unlocked.length
        ? unlocked.map(function (a) { return '<div class="pdf-ach">' + a.emoji + ' ' + a.name + '</div>'; }).join('')
        : '<div class="pdf-ach">🌱 Первый шаг — в процессе</div>';
    }

    const pdfTemplate = $('pdfTemplate');
    if (!pdfTemplate) { showToast('Шаблон PDF не найден'); return; }

    pdfTemplate.classList.add('pdf-rendering');
    pdfTemplate.getBoundingClientRect();

    await new Promise(function (resolve) {
      requestAnimationFrame(function () { requestAnimationFrame(resolve); });
    });

    const opt = {
      margin: 0,
      filename: 'love-meter-' + todayStr() + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 794,
        width: 794,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' }
    };

    try {
      await window.html2pdf().set(opt).from(pdfTemplate).save();
      showToast('PDF сохранён 💕');
    } finally {
      pdfTemplate.classList.remove('pdf-rendering');
    }
  } catch (e) {
    if (typeof LM !== 'undefined') LM.record('LM-014', e.message || 'Ошибка html2pdf', e.stack || '');
    showToast('Ошибка при создании PDF');
  }
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function collectMoments() {
  const moments = [];
  const today = new Date();
  const iHide = getMyHideFlag();
  const partnerHide = getPartnerHideFlag();

  for (let i = 0; i < 30 && moments.length < 4; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const v = APP.state.votes[fmtDate(d)];
    if (!v) continue;
    const vals = [];
    if (v.you && !iHide) vals.push(v.you);
    if (v.partner && !partnerHide) vals.push(v.partner);
    if (vals.length && Math.max.apply(null, vals) === 5) {
      moments.push('❤️ ' + d.getDate() + '.' + (d.getMonth() + 1) + ' — идеальный день с оценкой 5');
    }
  }

  if (moments.length < 4) {
    for (let i = 0; i < 30 && moments.length < 4; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const label = d.getDate() + '.' + (d.getMonth() + 1);
      if (moments.some(function (m) { return m.indexOf(label) !== -1; })) continue;
      const v = APP.state.votes[fmtDate(d)];
      if (!v) continue;
      const vals = [];
      if (v.you && !iHide) vals.push(v.you);
      if (v.partner && !partnerHide) vals.push(v.partner);
      if (vals.length && Math.max.apply(null, vals) === 4) {
        moments.push('💕 ' + label + ' — тёплый день');
      }
    }
  }

  if (!moments.length) moments.push('✨ Начните голосовать, чтобы увидеть моменты');
  return moments;
}

/* ---------- ЖУРНАЛ ОШИБОК ---------- */

function openErrorLog() {
  if (typeof LM === 'undefined') { showToast('Журнал недоступен'); return; }

  const entries = LM.getAll();
  let listHtml;

  if (!entries.length) {
    listHtml = '<div class="error-log-empty">Ошибок не было — всё работает 🎉</div>';
  } else {
    listHtml = entries.map(function (e) {
      let html = '<div class="error-log-item">';
      html += '<div class="error-log-item-head">';
      html += '<span class="error-log-item-code">' + escapeHtml(e.code) + '</span>';
      html += '<span class="error-log-item-time">' + escapeHtml(e.time) + '</span>';
      html += '</div>';
      html += '<div class="error-log-item-desc">' + escapeHtml(LM.describe(e.code)) + '</div>';
      html += '<div class="error-log-item-msg">' + escapeHtml(e.message) + '</div>';
      if (e.extra) html += '<div class="error-log-item-extra">' + escapeHtml(e.extra) + '</div>';
      html += '</div>';
      return html;
    }).join('');
  }

  const hint = entries.length
    ? 'Тапните «Скопировать всё» и пришлите разработчику.'
    : 'Как только возникнет ошибка, она появится здесь.';

  openModal(
    '<h3>Журнал ошибок</h3>' +
    '<p>Всего: ' + entries.length + '. ' + hint + '</p>' +
    '<div class="error-log-list">' + listHtml + '</div>' +
    '<button type="button" class="modal-btn primary" data-action="copy-log">Скопировать всё</button>' +
    '<button type="button" class="modal-btn secondary" data-action="clear-log">Очистить журнал</button>' +
    '<button type="button" class="modal-btn secondary" data-action="close">Закрыть</button>'
  );

  updateErrorLogCount();
}

function updateErrorLogCount() {
  const el = $('errorLogCount');
  if (!el) return;
  if (typeof LM === 'undefined') { el.textContent = '—'; return; }
  const count = LM.getAll().length;
  el.textContent = count === 0 ? 'Ошибок нет' : String(count);
  el.style.color = count > 0 ? 'var(--danger)' : '';
}

function onErrorLogAction(action) {
  if (action === 'close') { closeModal(); return; }

  if (action === 'copy-log') {
    if (typeof LM === 'undefined') return;
    const text = LM.toText();
    const fallback = function () {
      try { window.prompt('Скопируйте текст:', text); } catch (e) { showToast('Не удалось'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { showToast('Журнал скопирован 📋'); })
        .catch(fallback);
    } else fallback();
    return;
  }

  if (action === 'clear-log') {
    if (typeof LM === 'undefined') return;
    LM.clear();
    updateErrorLogCount();
    closeModal();
    showToast('Журнал очищен');
    return;
  }
}

/* ---------- PWA ---------- */

function setupPWA() {
  try {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      const swCode =
        "self.addEventListener('install',function(e){self.skipWaiting();});" +
        "self.addEventListener('activate',function(e){e.waitUntil(clients.claim());});" +
        "self.addEventListener('fetch',function(e){" +
        "if(e.request.method!=='GET')return;" +
        "e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request);}));" +
        "});";
      const blob = new Blob([swCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      navigator.serviceWorker.register(url).catch(function () {});
    }
  } catch (e) {}
}

let deferredInstallPrompt = null;

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = $('installBtn');
    if (btn) btn.style.display = 'flex';
  });

  try {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && navigator.standalone);
    if (isIOS && !isStandalone) {
      const btn = $('installBtn');
      if (btn) btn.style.display = 'flex';
    }
  } catch (e) {}
}

async function onInstallClick() {
  if (deferredInstallPrompt) {
    try { deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; } catch (e) {}
    deferredInstallPrompt = null;
    const btn = $('installBtn');
    if (btn) btn.style.display = 'none';
    return;
  }
  showToast('iOS: Поделиться → «На экран Домой»', 3500);
}

/* ---------- СОБЫТИЯ ---------- */

function bindEvents() {

  const tabBar = $('tabBar');
  if (tabBar) {
    tabBar.addEventListener('click', function (e) {
      const tab = e.target.closest('.tab-item');
      if (!tab) return;
      switchTab(tab.dataset.tab);
    });
  }

  document.querySelectorAll('.vote-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      const v = parseInt(btn.dataset.vote, 10);
      if (v >= 1 && v <= 5) handleVote(v);
    });
  });

  const calGrid = $('calGrid');
  if (calGrid) {
    calGrid.addEventListener('click', function (e) {
      const cell = e.target.closest('.cal-cell');
      if (!cell || !cell.dataset.date) return;
      onCalCellClick(cell.dataset.date, parseInt(cell.dataset.day, 10));
    });
  }

  const calPrev = $('calPrev');
  if (calPrev) calPrev.addEventListener('click', prevMonth);
  const calNext = $('calNext');
  if (calNext) calNext.addEventListener('click', nextMonth);

  const coupleStateSeg = $('coupleStateSegmented');
  if (coupleStateSeg) {
    coupleStateSeg.addEventListener('click', function (e) {
      const btn = e.target.closest('.couple-state-period');
      if (!btn) return;
      onCoupleStatePeriodClick(btn.dataset.period);
    });
  }

  const segmented = $('segmented');
  if (segmented) {
    segmented.addEventListener('click', function (e) {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      document.querySelectorAll('#segmented .seg-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      APP.currentPeriod = btn.dataset.period;
      renderChart();
    });
  }

  const chartSvg = $('chartSvg');
  if (chartSvg) {
    chartSvg.addEventListener('mouseover', function (e) {
      const hover = e.target.closest('.chart-hover');
      if (hover) onChartHover(hover);
    });
    chartSvg.addEventListener('mouseout', function (e) {
      if (e.target.closest('.chart-hover')) hideChartTooltip();
    });
    chartSvg.addEventListener('touchstart', function (e) {
      const hover = e.target.closest('.chart-hover');
      if (!hover) return;
      e.preventDefault();
      onChartHover(hover);
      setTimeout(hideChartTooltip, 2000);
    }, { passive: false });
  }

  const modalContent = $('coupleModalContent');
  if (modalContent) {
    modalContent.addEventListener('click', function (e) {
      const gBtn = e.target.closest('.gender-btn');
      if (gBtn) { onGenderBtnClick(gBtn.dataset.gender); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'save-my-name') onMyNameModalAction(action);
      else if (action === 'copy-log' || action === 'clear-log') onErrorLogAction(action);
      else onCoupleModalAction(action);
    });

    modalContent.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      const t = e.target;
      if (t && t.id === 'joinCodeInput') { e.preventDefault(); onCoupleModalAction('join'); }
      if (t && t.id === 'myNameInput') { e.preventDefault(); onMyNameModalAction('save-my-name'); }
    });
  }

  const modalBackdrop = $('coupleModal');
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', function (e) {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  const coupleBtn = $('coupleBtn');
  if (coupleBtn) coupleBtn.addEventListener('click', openCoupleModal);

  const namesBtn = $('namesBtn');
  if (namesBtn) namesBtn.addEventListener('click', openMyNameModal);

  const errorLogBtn = $('errorLogBtn');
  if (errorLogBtn) errorLogBtn.addEventListener('click', openErrorLog);

  const exportBtn = $('exportPdfBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportPDF);

  const privacyBtn = $('privacyBtn');
  if (privacyBtn) privacyBtn.addEventListener('click', togglePrivacy);

  const installBtn = $('installBtn');
  if (installBtn) installBtn.addEventListener('click', onInstallClick);

  const aboutBtn = $('aboutBtn');
  if (aboutBtn) aboutBtn.addEventListener('click', openAboutModal);

  const resetBtn = $('resetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetAllData);

  window.addEventListener('lm:error', function () { updateErrorLogCount(); });
  window.addEventListener('online', function () {
    updateSyncDot(HAS_SUPABASE && APP.coupleId ? 'on' : 'local');
  });
  window.addEventListener('offline', function () { updateSyncDot('off'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  updateErrorLogCount();
}