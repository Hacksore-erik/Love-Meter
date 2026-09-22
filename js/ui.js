/* ============================================================
   UI — тосты, табы, модалки, события, свайп-карусель
   ============================================================ */

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
  try {
    const dot = $('syncDot');
    if (!dot) return;
    dot.className = 'sync-dot';
    if (status === 'on') { dot.classList.add('on'); dot.title = 'Синхронизировано'; }
    else if (status === 'off') { dot.classList.add('off'); dot.title = 'Нет связи'; }
    else { dot.classList.add('local'); dot.title = 'Локальный режим'; }
  } catch (e) {}
}


/* ============================================================
   СВАЙП-КАРУСЕЛЬ
   ============================================================ */

const TAB_ORDER = ['home', 'awards', 'stats', 'profile'];
let currentTab = 0;

let swipe = {
  active: false,
  startX: 0,
  startY: 0,
  deltaX: 0,
  deltaY: 0,
  locked: false,
  horizontal: false
};

function goToTab(index, animate) {
  try {
    const screensTrack = $('screensTrack');
    const tabBar = $('tabBar');
    const screens = $('screens');
    if (!screensTrack || !tabBar || !screens) return;

    if (index < 0) index = 0;
    if (index > TAB_ORDER.length - 1) index = TAB_ORDER.length - 1;
    currentTab = index;

    const offset = -(index * (100 / TAB_ORDER.length));

    if (animate === false) {
      screensTrack.classList.add('no-anim');
      screensTrack.style.transform = 'translateX(' + offset + '%)';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          screensTrack.classList.remove('no-anim');
        });
      });
    } else {
      screensTrack.style.transform = 'translateX(' + offset + '%)';
    }

    const allTabs = tabBar.querySelectorAll('.tab-item');
    for (let i = 0; i < allTabs.length; i++) {
      allTabs[i].classList.toggle('active', i === index);
    }

    // Сброс скролла у нового экрана
    const allScreens = screens.querySelectorAll('.screen');
    const activeScreen = allScreens[index];
    if (activeScreen) activeScreen.scrollTop = 0;

    // Ленивая отрисовка
    const tab = TAB_ORDER[index];
    if (tab === 'awards' && typeof renderAchievements === 'function') renderAchievements();
    if (tab === 'stats' && typeof renderStats === 'function') renderStats();
    if (tab === 'profile') {
      if (typeof renderProfile === 'function') renderProfile();
      if (typeof updateErrorLogCount === 'function') updateErrorLogCount();
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-029', e.message || 'goToTab failed', 'index=' + index);
    }
  }
}

function switchTab(tab) {
  const idx = TAB_ORDER.indexOf(tab);
  if (idx < 0) return;
  goToTab(idx, true);
}

function isScreenActive(name) {
  return TAB_ORDER[currentTab] === name;
}

function onTouchStart(e) {
  const t = e.touches[0];
  if (!t) return;
  swipe.active = true;
  swipe.startX = t.clientX;
  swipe.startY = t.clientY;
  swipe.deltaX = 0;
  swipe.deltaY = 0;
  swipe.locked = false;
  swipe.horizontal = false;
  const track = $('screensTrack');
  if (track) track.classList.add('no-anim');
}

function onTouchMove(e) {
  if (!swipe.active) return;
  const track = $('screensTrack');
  const screens = $('screens');
  if (!track || !screens) return;

  const t = e.touches[0];
  if (!t) return;

  swipe.deltaX = t.clientX - swipe.startX;
  swipe.deltaY = t.clientY - swipe.startY;

  if (!swipe.locked) {
    if (Math.abs(swipe.deltaX) < 8 && Math.abs(swipe.deltaY) < 8) return;
    swipe.horizontal = Math.abs(swipe.deltaX) > Math.abs(swipe.deltaY);
    swipe.locked = true;
  }

  if (!swipe.horizontal) return;

  const w = screens.clientWidth;
  const baseOffset = -(currentTab * w);
  let next = baseOffset + swipe.deltaX;

  if (next > 0) next = next * 0.35;
  else if (next < -(TAB_ORDER.length - 1) * w) {
    next = -(TAB_ORDER.length - 1) * w + (next + (TAB_ORDER.length - 1) * w) * 0.35;
  }

  track.style.transform = 'translateX(' + next + 'px)';
}

function onTouchEnd() {
  if (!swipe.active) return;
  swipe.active = false;
  const track = $('screensTrack');
  const screens = $('screens');
  if (!track || !screens) return;

  track.classList.remove('no-anim');

  if (!swipe.horizontal) return;

  const w = screens.clientWidth;
  const threshold = w * 0.22;

  if (swipe.deltaX <= -threshold && currentTab < TAB_ORDER.length - 1) {
    goToTab(currentTab + 1, true);
  } else if (swipe.deltaX >= threshold && currentTab > 0) {
    goToTab(currentTab - 1, true);
  } else {
    goToTab(currentTab, true);
  }
}


/* ============================================================
   ПРОФИЛЬ
   ============================================================ */

function renderProfile() {
  try {
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
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-012', e.message || 'renderProfile failed', '');
    }
  }
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


/* ============================================================
   МОДАЛКА
   ============================================================ */

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
      LM.record('LM-013', e.message || 'openModal failed', '');
    }
  }
}

function closeModal() {
  const modal = $('coupleModal');
  if (modal) modal.classList.remove('show');
}


/* ============================================================
   МОДАЛКА ПАРЫ
   ============================================================ */

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
      if (typeof LM !== 'undefined') LM.record('LM-030', e.message || 'copy failed', '');
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
    if (typeof unsubscribeRealtime === 'function') unsubscribeRealtime();
    updateSyncDot('local');
    closeModal();
    renderProfile();
    renderAll();
    showToast('Пара отключена');
    return;
  }

  if (action === 'create') {
    try {
      await initSupabaseAsync();
    } catch (e) {}
    if (!APP.supabaseClient) {
      showToast('Не удалось подключиться к Supabase');
      return;
    }

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

    await syncAllLocalVotesToSupabase();
    subscribeRealtime();
    updateSyncDot('on');
    closeModal();
    renderProfile();
    showToast('Пара создана! Код: ' + code, 3500);
    return;
  }

  if (action === 'join') {
    try {
      await initSupabaseAsync();
    } catch (e) {}
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


/* ============================================================
   ИНФО О СЕРДЦЕ
   ============================================================ */

function openHeartInfo() {
  const body = ''
    + '<div class="info-block">'
    + '<p>Мы берём оценки, которые партнёр поставил за последние <b>7 дней</b>, и находим среднее. Затем умножаем на 20 — получаем процент от 0 до 100%.</p>'
    + '<div class="info-formula">среднее × 20 = <span class="info-accent">процент</span></div>'
    + '<p>Например: <b>4 из 5</b> → <span class="info-accent">80%</span>.</p>'
    + '<p><b>Что это значит:</b> чем выше процент, тем теплее партнёр чувствует себя рядом с тобой в последнюю неделю. Это не «оценка тебя», а его/её собственное состояние.</p>'
    + '<p>Если партнёр не голосовал — процент не считается.</p>'
    + '</div>'
    + '<button type="button" class="modal-btn primary" data-action="close">Понятно</button>';

  openModal('<h3>Как считается состояние партнёра</h3>' + body);
}


/* ============================================================
   МОДАЛКА «МОЁ ИМЯ»
   ============================================================ */

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
    try {
      const inp = $('myNameInput');
      if (inp) { inp.focus(); inp.select(); }
    } catch (e) {}
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

    if (APP.supabaseClient && APP.coupleId && typeof pushMyName === 'function') {
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


/* ============================================================
   ИНФО «О ПРИЛОЖЕНИИ»
   ============================================================ */

function openAboutModal() {
  const mode = HAS_SUPABASE
    ? (APP.coupleId ? 'с синхронизацией' : 'локальный, Supabase доступен')
    : 'локальный';

  openModal(
    '<h3>Love Meter</h3>' +
    '<p>Трекер эмоционального состояния пары.<br>Версия ' + (CONFIG.VERSION || '1.6') + ' • Режим: ' + mode + '</p>' +
    '<p style="font-size:12px;margin-bottom:20px;">Данные хранятся в браузере.</p>' +
    '<button type="button" class="modal-btn primary" data-action="close">Закрыть</button>'
  );
}


/* ============================================================
   ПРИВАТНОСТЬ
   ============================================================ */

async function togglePrivacy() {
  try {
    APP.state.hideMyVotes = !APP.state.hideMyVotes;
    saveState();

    if (APP.supabaseClient && APP.coupleId && typeof pushMyHideFlag === 'function') {
      const ok = await pushMyHideFlag();
      if (!ok) showToast('Сохранено локально ⏳');
      else showToast(APP.state.hideMyVotes ? 'Оценки скрыты 🔒' : 'Оценки видны 👀');
    } else {
      showToast(APP.state.hideMyVotes ? 'Оценки скрыты 🔒' : 'Оценки видны 👀');
    }

    renderProfile();
    renderAll();
    if (isScreenActive('stats') && typeof renderStats === 'function') renderStats();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-023', e.message || 'togglePrivacy failed', '');
    }
  }
}


/* ============================================================
   СБРОС
   ============================================================ */

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


/* ============================================================
   ПЕРИОД (график) + ПАНЕЛЬ (Динамика/Календарь)
   ============================================================ */

function onStatsPanelChange(panel) {
  try {
    const seg = $('statsSeg');
    if (seg) seg.setAttribute('data-active', panel);

    document.querySelectorAll('.stats-seg-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.stats === panel);
    });

    document.querySelectorAll('.stats-panel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === panel);
    });

    if (panel === 'dynamics' && typeof renderChart === 'function') {
      renderStatsHero();
      renderChart();
      renderCompare();
      renderRecords();
    }
    if (panel === 'calendar' && typeof renderCalendar === 'function') {
      renderCalendar();
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-011', e.message || 'onStatsPanelChange failed', 'panel=' + panel);
    }
  }
}

function onPeriodChange(period) {
  try {
    if (period !== 'week' && period !== 'month' && period !== 'year') return;
    APP.currentPeriod = period;

    const seg = $('periodSeg');
    if (seg) seg.setAttribute('data-active', period);

    document.querySelectorAll('.period-seg-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.period === period);
    });

    renderStatsHero();
    renderChart();
    renderCompare();
    renderRecords();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-011', e.message || 'onPeriodChange failed', 'period=' + period);
    }
  }
}


/* ============================================================
   PDF
   ============================================================ */

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


/* ============================================================
   ЖУРНАЛ ОШИБОК
   ============================================================ */

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
  try {
    const el = $('errorLogCount');
    if (!el) return;
    if (typeof LM === 'undefined') { el.textContent = '—'; return; }
    const count = LM.getAll().length;
    el.textContent = count === 0 ? 'Ошибок нет' : String(count);
    el.style.color = count > 0 ? 'var(--danger)' : '';
  } catch (e) {}
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


/* ============================================================
   PWA — без Service Worker на iOS
   ============================================================ */

function setupPWA() {
  try {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) return;

    const swCode =
      "self.addEventListener('install',function(e){self.skipWaiting();});" +
      "self.addEventListener('activate',function(e){e.waitUntil(clients.claim());});" +
      "self.addEventListener('fetch',function(e){" +
      "if(e.request.method!=='GET')return;" +
      "e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request);}));" +
      "});";

    const blob = new Blob([swCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    try {
      const reg = navigator.serviceWorker.register(url);
      if (reg && typeof reg.catch === 'function') {
        reg.catch(function () { /* тихо */ });
      }
    } catch (e) { /* синхронное исключение */ }
  } catch (e) { /* внешний предохранитель */ }
}

let deferredInstallPrompt = null;

function setupInstallPrompt() {
  try {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = $('installBtn');
      if (btn) btn.style.display = 'flex';
    });

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


/* ============================================================
   СОБЫТИЯ
   ============================================================ */

function safeBind(label, fn) {
  try {
    fn();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-005', (label || 'bind failed') + ': ' + (e.message || ''),
        (e.stack || '').substring(0, 200));
    }
  }
}

function bindEvents() {

  /* --- ТАБЫ --- */
  safeBind('tabBar', function () {
    const tabBar = $('tabBar');
    if (!tabBar) return;
    tabBar.addEventListener('click', function (e) {
      const tab = e.target.closest('.tab-item');
      if (!tab) return;
      const idx = TAB_ORDER.indexOf(tab.dataset.tab);
      if (idx >= 0) goToTab(idx, true);
    });
  });

  /* --- СВАЙП + СКРОЛЛ ШАПКИ --- */
  safeBind('swipe', function () {
    const screens = $('screens');
    const appHeader = $('appHeader');
    if (!screens) return;

    screens.addEventListener('touchstart', onTouchStart, { passive: true });
    screens.addEventListener('touchmove', onTouchMove, { passive: true });
    screens.addEventListener('touchend', onTouchEnd, { passive: true });
    screens.addEventListener('touchcancel', onTouchEnd, { passive: true });

    screens.addEventListener('scroll', function () {
      const allScreens = screens.querySelectorAll('.screen');
      let scrolled = false;
      for (let i = 0; i < allScreens.length; i++) {
        if (allScreens[i].scrollTop > 4) { scrolled = true; break; }
      }
      if (appHeader) appHeader.classList.toggle('scrolled', scrolled);
    }, true);
  });

  /* --- ГОЛОСОВАНИЕ --- */
  safeBind('vote', function () {
    document.querySelectorAll('.vote-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        const v = parseInt(btn.dataset.vote, 10);
        if (v >= 1 && v <= 5) handleVote(v);
      });
    });
  });

  safeBind('voteChange', function () {
    const voteChange = $('voteChange');
    if (voteChange) voteChange.addEventListener('click', onVoteChangeClick);
  });

  /* --- ПЕРЕКЛЮЧАТЕЛЬ ДИНАМИКА / КАЛЕНДАРЬ --- */
  safeBind('statsSeg', function () {
    const seg = $('statsSeg');
    if (!seg) return;
    seg.addEventListener('click', function (e) {
      const btn = e.target.closest('.stats-seg-btn');
      if (!btn) return;
      const target = btn.dataset.stats;
      if (!target) return;
      onStatsPanelChange(target);
    });
  });

  /* --- ПЕРИОДЫ ГРАФИКА --- */
  safeBind('periodSeg', function () {
    const seg = $('periodSeg');
    if (!seg) return;
    seg.addEventListener('click', function (e) {
      const btn = e.target.closest('.period-seg-btn');
      if (!btn) return;
      const target = btn.dataset.period;
      if (!target) return;
      onPeriodChange(target);
    });
  });

  /* --- ГРАФИК: HOVER / TAP --- */
  safeBind('chartHover', function () {
    const chartSvg = $('chartSvg');
    if (!chartSvg) return;

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
      setTimeout(hideChartTooltip, 2500);
    }, { passive: false });
  });

  /* --- КАЛЕНДАРЬ --- */
  safeBind('calGrid', function () {
    const calGrid = $('calGrid');
    if (calGrid) {
      calGrid.addEventListener('click', function (e) {
        const cell = e.target.closest('.cal-cell');
        if (!cell || !cell.dataset.date) return;
        onCalCellClick(cell.dataset.date, parseInt(cell.dataset.day, 10));
      });
    }
  });

  safeBind('calNav', function () {
    const calPrev = $('calPrev');
    if (calPrev) calPrev.addEventListener('click', prevMonth);
    const calNext = $('calNext');
    if (calNext) calNext.addEventListener('click', nextMonth);
  });

  /* --- ПЕРИОД ОБЩЕГО СОСТОЯНИЯ (главная) --- */
  safeBind('coupleStateSeg', function () {
    const seg = $('coupleStateSegmented');
    if (seg) {
      seg.addEventListener('click', function (e) {
        const btn = e.target.closest('.couple-state-period');
        if (!btn) return;
        onCoupleStatePeriodClick(btn.dataset.period);
      });
    }
  });

  /* --- ИНФО О СЕРДЦЕ --- */
  safeBind('heartInfo', function () {
    const btn = $('heartInfoBtn');
    if (btn) btn.addEventListener('click', openHeartInfo);
  });

  /* --- МОДАЛЬНЫЕ КНОПКИ --- */
  safeBind('modalContent', function () {
    const modalContent = $('coupleModalContent');
    if (!modalContent) return;

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
  });

  safeBind('modalBackdrop', function () {
    const modalBackdrop = $('coupleModal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', function (e) {
        if (e.target === modalBackdrop) closeModal();
      });
    }
  });

  /* --- КНОПКИ ПРОФИЛЯ --- */
  safeBind('coupleBtn', function () {
    const b = $('coupleBtn');
    if (b) b.addEventListener('click', openCoupleModal);
  });

  safeBind('namesBtn', function () {
    const b = $('namesBtn');
    if (b) b.addEventListener('click', openMyNameModal);
  });

  safeBind('errorLogBtn', function () {
    const b = $('errorLogBtn');
    if (b) b.addEventListener('click', openErrorLog);
  });

  safeBind('exportPdfBtn', function () {
    const b = $('exportPdfBtn');
    if (b) b.addEventListener('click', exportPDF);
  });

  safeBind('privacyBtn', function () {
    const b = $('privacyBtn');
    if (b) b.addEventListener('click', togglePrivacy);
  });

  safeBind('installBtn', function () {
    const b = $('installBtn');
    if (b) b.addEventListener('click', onInstallClick);
  });

  safeBind('aboutBtn', function () {
    const b = $('aboutBtn');
    if (b) b.addEventListener('click', openAboutModal);
  });

  safeBind('resetBtn', function () {
    const b = $('resetBtn');
    if (b) b.addEventListener('click', resetAllData);
  });

  /* --- ГЛОБАЛЬНЫЕ --- */
  safeBind('global', function () {
    window.addEventListener('lm:error', function () { updateErrorLogCount(); });
    window.addEventListener('online', function () {
      updateSyncDot(HAS_SUPABASE && APP.coupleId ? 'on' : 'local');
    });
    window.addEventListener('offline', function () { updateSyncDot('off'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  });

  safeBind('final', function () {
    updateErrorLogCount();
    goToTab(0, false);
    setInterval(updateUpdatedHint, 12000);
  });
}