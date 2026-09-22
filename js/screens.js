/* ============================================================
   SCREENS — логика экранов
   ============================================================ */


/* ============================================================
   ГЛАВНАЯ — СЕРДЦЕ
   ============================================================ */

const HEART_Y_TOP = -5;
const HEART_Y_BOTTOM = 195;

function percentToY(pct) {
  return HEART_Y_BOTTOM - (pct / 100) * (HEART_Y_BOTTOM - HEART_Y_TOP);
}

function wavePath(y) {
  return 'M -60 ' + y +
         ' Q -35 ' + (y - 4) + ', -10 ' + y +
         ' T 40 ' + y +
         ' T 90 ' + y +
         ' T 140 ' + y +
         ' T 190 ' + y +
         ' T 240 ' + y +
         ' L 260 200 L -60 200 Z';
}

function setStopColors(grad, colors) {
  if (!grad) return;
  const stops = grad.getElementsByTagName('stop');
  for (let i = 0; i < colors.length && i < stops.length; i++) {
    stops[i].setAttribute('stop-color', colors[i]);
  }
}

function heartPaletteFor(pct) {
  if (pct <= 20) {
    return {
      emptyColors:  ['#e8e8ee', '#d8d8e0'],
      liquidColors: ['#c7ccd6', '#a8b0bd', '#8e8e93'],
      glow: 'rgba(142,142,147,0.28)',
      status: 'Нужен тёплый разговор 💬',
      pillBg: '#f2f2f7', pillColor: '#6e6e73', ringColor: '#b8bcc7'
    };
  }
  if (pct <= 40) {
    return {
      emptyColors:  ['#eaf1ff', '#dbe6ff'],
      liquidColors: ['#a9c6ff', '#7aa7ff', '#5e7dff'],
      glow: 'rgba(94,125,255,0.3)',
      status: 'Немного прохладно ❄️',
      pillBg: '#eef2ff', pillColor: '#3d5eff', ringColor: '#7aa7ff'
    };
  }
  if (pct <= 60) {
    return {
      emptyColors:  ['#f5eeff', '#ebe0ff'],
      liquidColors: ['#d4b5ff', '#b98aff', '#a56bff'],
      glow: 'rgba(165,107,255,0.3)',
      status: 'Спокойно и стабильно 💜',
      pillBg: '#f5eeff', pillColor: '#7d3dff', ringColor: '#b98aff'
    };
  }
  if (pct <= 80) {
    return {
      emptyColors:  ['#ffe5eb', '#ffd0da'],
      liquidColors: ['#ffb1c1', '#ff7da1', '#ff2d55'],
      glow: 'rgba(255,94,125,0.35)',
      status: 'Между вами тепло 💗',
      pillBg: '#fff0f3', pillColor: '#ff2d55', ringColor: '#ff7da1'
    };
  }
  return {
    emptyColors:  ['#ffe0e8', '#ffc8d5'],
    liquidColors: ['#ff8fa3', '#ff5e7d', '#ff2d55'],
    glow: 'rgba(255,45,85,0.42)',
    status: 'Любовь пылает! ❤️‍🔥',
    pillBg: '#ffe9ec', pillColor: '#d62e4d', ringColor: '#ff2d55'
  };
}

function shortMoodLabel(pct) {
  if (pct <= 20) return 'прохладно';
  if (pct <= 40) return 'свежо';
  if (pct <= 60) return 'стабильно';
  if (pct <= 80) return 'тепло';
  return 'жарко';
}

function setHeartLevel(pct) {
  const waveFront = $('waveFront');
  const percentEl = $('heartPercent');
  const statusPill = $('statusPill');
  const heartGlow = $('heartGlow');
  const coupleRing = $('coupleStateRing');
  const emptyGrad = $('emptyGrad');
  const liquidGrad = $('liquidGrad');
  if (!waveFront || !percentEl) return;

  const p = heartPaletteFor(pct);

  waveFront.setAttribute('d', wavePath(percentToY(pct)));
  percentEl.textContent = pct + '%';

  setStopColors(emptyGrad, p.emptyColors);
  setStopColors(liquidGrad, p.liquidColors);

  if (heartGlow) heartGlow.style.setProperty('--glow-color', p.glow);
  if (statusPill) {
    statusPill.textContent = p.status;
    statusPill.style.background = p.pillBg;
    statusPill.style.color = p.pillColor;
  }
  if (coupleRing) coupleRing.style.borderColor = p.ringColor;
}

function setHeartEmpty(hidden) {
  const waveFront = $('waveFront');
  const percentEl = $('heartPercent');
  const statusPill = $('statusPill');
  const heartGlow = $('heartGlow');
  const coupleRing = $('coupleStateRing');
  const emptyGrad = $('emptyGrad');
  const liquidGrad = $('liquidGrad');

  setStopColors(emptyGrad, ['#e8e8ee', '#d8d8e0']);
  setStopColors(liquidGrad, ['#c7ccd6', '#a8b0bd', '#8e8e93']);

  if (waveFront) waveFront.setAttribute('d', wavePath(percentToY(0)));
  if (heartGlow) heartGlow.style.setProperty('--glow-color', 'rgba(142,142,147,0.28)');
  if (coupleRing) coupleRing.style.borderColor = '#b8bcc7';

  if (percentEl) {
    percentEl.textContent = hidden ? '🔒' : '—%';
  }
  if (statusPill) {
    statusPill.textContent = hidden
      ? 'Партнёр скрыл свои оценки'
      : 'Партнёр пока не отмечал настроение';
    statusPill.style.background = '#f2f2f7';
    statusPill.style.color = '#6e6e73';
  }
}

function setPartnerOnline(on) {
  const heartContainer = $('heartContainer');
  const partnerDot = $('partnerDot');
  const partnerStatus = $('partnerStatus');
  const isOn = !!on;

  if (heartContainer) heartContainer.classList.toggle('online', isOn);
  if (partnerDot) partnerDot.classList.toggle('online', isOn);
  if (partnerStatus) {
    const name = getPartnerName();
    const label = (name && name !== CONFIG.DEFAULTS.partnerName) ? name : 'партнёр';
    partnerStatus.textContent = isOn ? (label + ' в сети') : (label + ' не в сети');
    partnerStatus.classList.toggle('online', isOn);
  }
}

let _updateHintSeconds = 2;

function updateUpdatedHint() {
  const el = $('updatedHint');
  if (!el) return;

  let txt;
  if (_updateHintSeconds < 10) txt = 'обновлено только что';
  else if (_updateHintSeconds < 60) txt = 'обновлено ' + _updateHintSeconds + ' сек назад';
  else {
    const m = Math.floor(_updateHintSeconds / 60);
    txt = 'обновлено ' + m + ' мин назад';
  }
  el.textContent = txt;

  _updateHintSeconds += 12;
  if (_updateHintSeconds > 600) _updateHintSeconds = 2;
}

function updateHeart() {
  try {
    const partner = computePartnerPercent();

    if (partner.hidden || !partner.hasData) {
      setHeartEmpty(partner.hidden);
      updateUpdatedHint();
      return;
    }

    setHeartLevel(partner.percent);

    if (!partner.votedToday && partner.lastVoteDaysAgo !== null) {
      const statusPill = $('statusPill');
      if (statusPill) {
        const days = partner.lastVoteDaysAgo;
        let daysText;
        if (days === 1) daysText = 'вчера';
        else if (days === 2) daysText = '2 дня назад';
        else if (days < 7) daysText = days + ' дней назад';
        else daysText = 'давно';

        statusPill.textContent = statusPill.textContent + ' • последний голос ' + daysText;
      }
    }

    updateUpdatedHint();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-006', e.message || 'updateHeart failed',
        (e.stack || '').substring(0, 300));
    }
  }
}


/* ============================================================
   ГЛАВНАЯ — БЛОК «ОБЩЕЕ СОСТОЯНИЕ ПАРЫ»
   ============================================================ */

function renderCoupleState() {
  try {
    const percentEl = $('coupleStatePercent');
    const statusEl = $('coupleStateStatus');
    const segBtns = document.querySelectorAll('.couple-state-period');
    const ringEl = $('coupleStateRing');

    if (!percentEl || !statusEl) return;

    segBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.period === APP.coupleStatePeriod);
    });

    const result = computeCouplePercent(APP.coupleStatePeriod);

    percentEl.textContent = result.hasData ? (result.percent + '%') : '—';

    if (ringEl) {
      let ringColor = '#b8bcc7';
      if (result.hasData) {
        ringColor = heartPaletteFor(result.percent).ringColor;
      }
      ringEl.style.borderColor = ringColor;
    }

    let status;
    if (!result.hasData) {
      status = result.anyHidden
        ? 'Недостаточно данных — часть оценок скрыта'
        : 'Пока нет оценок за этот период';
    } else {
      status = heartPaletteFor(result.percent).status;

      if (result.iHide && result.partnerHide) {
        status += ' • часть оценок скрыта у обоих';
      } else if (result.iHide) {
        status += ' • твои оценки скрыты';
      } else if (result.partnerHide) {
        status += ' • оценки партнёра скрыты';
      }
    }

    statusEl.textContent = status;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-004', e.message || 'renderCoupleState failed', '');
    }
  }
}


/* ============================================================
   ГЛАВНАЯ — ГОЛОСОВАНИЕ
   ============================================================ */

function renderVoteButtons() {
  try {
    const myVote = getTodayVote();
    const btns = document.querySelectorAll('.vote-btn');
    const question = $('voteQuestion');
    const hint = $('voteHint');
    const changeBtn = $('voteChange');
    if (!btns.length || !question || !hint) return;

    btns.forEach(function (btn, i) {
      const v = i + 1;
      if (myVote && v <= myVote) {
        btn.textContent = '❤️';
        btn.classList.add('active');
      } else {
        btn.textContent = '🤍';
        btn.classList.remove('active');
      }
      btn.disabled = false;
      btn.style.opacity = '1';
    });

    if (myVote) {
      question.textContent = 'Спасибо! Партнёр тоже может проголосовать 💕';
      hint.textContent = 'Твой голос: ' + myVote + ' из 5';
      btns.forEach(function (b) { b.disabled = true; b.style.opacity = '0.75'; });
      if (changeBtn) changeBtn.classList.add('visible');
    } else {
      question.textContent = 'Как ты себя чувствуешь сегодня в отношениях?';
      hint.textContent = 'Можно менять один раз в день';
      if (changeBtn) changeBtn.classList.remove('visible');
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-007', e.message || 'renderVoteButtons failed', '');
    }
  }
}

function unlockVoteButtons() {
  try {
    const btns = document.querySelectorAll('.vote-btn');
    const question = $('voteQuestion');
    const hint = $('voteHint');
    const changeBtn = $('voteChange');

    btns.forEach(function (b) { b.disabled = false; b.style.opacity = '1'; });
    if (question) question.textContent = 'Как ты себя чувствуешь сегодня в отношениях?';
    if (hint) hint.textContent = 'Можно менять один раз в день';
    if (changeBtn) changeBtn.classList.remove('visible');
  } catch (e) {}
}

async function handleVote(vote) {
  try {
    const current = getTodayVote();
    const key = todayStr();

    if (current === vote) return;

    if (!APP.state.votes[key]) APP.state.votes[key] = {};
    APP.state.votes[key][APP.myRole] = vote;

    recalcStats();
    saveState();

    const btns = document.querySelectorAll('.vote-btn');
    btns.forEach(function (btn, i) {
      const v = i + 1;
      if (v <= vote) {
        btn.textContent = '❤️';
        btn.classList.add('active', 'pop');
        setTimeout(function () { btn.classList.remove('pop'); }, 400);
      } else {
        btn.textContent = '🤍';
        btn.classList.remove('active');
      }
    });

    if (vote === 5) {
      spawnConfetti();
      if (navigator.vibrate) {
        try { navigator.vibrate([30, 50, 30, 50, 60]); } catch (e) {}
      }
    } else {
      if (navigator.vibrate) {
        try { navigator.vibrate(20); } catch (e) {}
      }
    }

    updateHeart();
    renderVoteButtons();
    renderCoupleState();
    renderAll();

    if (APP.supabaseClient && APP.coupleId) {
      const ok = await pushVoteToSupabase(key, APP.myRole, vote);
      if (ok) showToast('Голос отправлен партнёру 💕');
      else showToast('Сохранено локально ⏳');
    } else {
      showToast('Голос учтён! 💕');
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-008', e.message || 'handleVote failed', 'vote=' + vote);
    }
    showToast('Не удалось сохранить голос');
  }
}

function onVoteChangeClick() {
  try {
    unlockVoteButtons();
  } catch (e) {}
}


/* ============================================================
   КОНФЕТТИ
   ============================================================ */

function spawnConfetti() {
  try {
    const emojis = ['✨', '💖', '💕', '💗', '⭐️', '💫'];
    const wrap = $('voteButtons');
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();

    for (let i = 0; i < 14; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-particle';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

      el.style.left = (rect.left + Math.random() * rect.width) + 'px';
      el.style.top = rect.top + 'px';

      const dx = (Math.random() - 0.5) * 220;
      const dy = -150 - Math.random() * 220;
      const rot = (Math.random() - 0.5) * 720;

      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      el.style.setProperty('--rot', rot + 'deg');

      document.body.appendChild(el);

      setTimeout(function () {
        try { el.remove(); } catch (e) {}
      }, 2000);
    }
  } catch (e) {}
}


/* ============================================================
   НАГРАДЫ
   ============================================================ */

function renderAchievements() {
  try {
    const grid = $('achievementsGrid');
    if (!grid) return;

    let unlockedCount = 0;
    let html = '';

    CONFIG.ACHIEVEMENTS.forEach(function (a) {
      const progress = getAchievementProgress(a);
      const isUnlocked = progress >= a.max;
      if (isUnlocked) unlockedCount++;

      const pct = clamp((progress / a.max) * 100, 0, 100);
      const shown = Math.min(progress, a.max);

      html += '<div class="ach-card ' + (isUnlocked ? 'unlocked' : 'locked') + '">';
      if (isUnlocked) {
        html += '<div class="ach-check" aria-hidden="true">✓</div>';
      }
      html += '<div class="ach-emoji" aria-hidden="true">' + a.emoji + '</div>';
      html += '<div class="ach-name">' + a.name + '</div>';
      html += '<div class="ach-desc">' + a.desc + '</div>';
      html += '<div class="ach-progress-row">';
      html += '<div class="ach-bar-bg">';
      html += '<div class="ach-bar-fill" style="width:' + pct + '%"></div>';
      html += '</div>';
      html += '<div class="ach-progress-text">' + shown + '/' + a.max + '</div>';
      html += '</div>';
      html += '</div>';
    });

    grid.innerHTML = html;

    const sub = $('awardsSubtitle');
    if (sub) sub.textContent = 'Открыто ' + unlockedCount + ' из ' + CONFIG.ACHIEVEMENTS.length;
    const ss = $('statStreak');
    if (ss) ss.textContent = APP.state.streak;
    const st = $('statTotal');
    if (st) st.textContent = APP.state.totalVotes;
    const sm = $('statMedals');
    if (sm) sm.textContent = unlockedCount;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-009', e.message || 'renderAchievements failed', '');
    }
  }
}


/* ============================================================
   СТАТИСТИКА — ГЛАВНЫЙ РЕНДЕР
   ============================================================ */

function renderStats() {
  try {
    renderStatsHero();
    renderChart();
    renderCompare();
    renderRecords();
    renderCalendar();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-011', e.message || 'renderStats failed', '');
    }
  }
}

function renderStatsHero() {
  try {
    const avgEl = $('heroAvg');
    const monthEl = $('heroMonth');
    const deltaEl = $('heroDelta');
    const metaEl = $('heroMeta');
    const svg = $('heroChartSvg');
    if (!avgEl || !svg) return;

    const now = new Date();
    if (monthEl) monthEl.textContent = MONTHS_FULL[now.getMonth()];

    const points = getChartData(APP.currentPeriod);
    const valid = points.filter(function (p) { return p.value !== null; });

    // Среднее
    let avgVal = 0;
    if (valid.length) {
      let sum = 0;
      for (let i = 0; i < valid.length; i++) sum += valid[i].value;
      avgVal = sum / valid.length;
    }
    avgEl.textContent = valid.length ? avgVal.toFixed(1) : '—';

    // Delta
    if (deltaEl) {
      if (valid.length >= 4) {
        const half = Math.floor(valid.length / 2);
        let s1 = 0, s2 = 0;
        for (let i = 0; i < half; i++) s1 += valid[i].value;
        for (let i = half; i < valid.length; i++) s2 += valid[i].value;
        const a1 = s1 / half;
        const a2 = s2 / (valid.length - half);
        const diff = a1 > 0 ? Math.round(((a2 - a1) / a1) * 100) : 0;

        if (diff > 0) {
          deltaEl.className = 'stats-hero-delta delta-up';
          deltaEl.textContent = '▲ +' + diff + '%';
        } else if (diff < 0) {
          deltaEl.className = 'stats-hero-delta delta-down';
          deltaEl.textContent = '▼ ' + diff + '%';
        } else {
          deltaEl.className = 'stats-hero-delta delta-same';
          deltaEl.textContent = '= 0%';
        }
      } else {
        deltaEl.className = 'stats-hero-delta delta-same';
        deltaEl.textContent = '—';
      }
    }

    // Meta
    if (metaEl) {
      const filled = valid.length;
      const total = points.length;
      const unit = APP.currentPeriod === 'year' ? 'недель' : 'дней';
      metaEl.textContent = filled + ' из ' + total + ' ' + unit + ' с оценками';
    }

    // Мини-график в hero
    const W = 320, H = 110;
    const padL = 4, padR = 4, padT = 12, padB = 12;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    if (valid.length < 2) {
      svg.innerHTML = '<defs><linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,45,85,0.35)"/><stop offset="100%" stop-color="rgba(255,45,85,0)"/></linearGradient></defs>';
      return;
    }

    const n = points.length;
    const stepX = n > 1 ? plotW / (n - 1) : plotW;

    const mapped = points.map(function (p, i) {
      return {
        x: padL + i * stepX,
        y: p.value !== null ? padT + plotH - ((p.value - 1) / 4) * plotH : null
      };
    }).filter(function (p) { return p.y !== null; });

    if (mapped.length < 2) {
      svg.innerHTML = '<defs><linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,45,85,0.35)"/><stop offset="100%" stop-color="rgba(255,45,85,0)"/></linearGradient></defs>';
      return;
    }

    let d = 'M ' + mapped[0].x.toFixed(1) + ' ' + mapped[0].y.toFixed(1);
    for (let i = 0; i < mapped.length - 1; i++) {
      const p0 = mapped[i - 1] || mapped[i];
      const p1 = mapped[i];
      const p2 = mapped[i + 1];
      const p3 = mapped[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C ' + cp1x.toFixed(1) + ' ' + cp1y.toFixed(1) + ', '
         + cp2x.toFixed(1) + ' ' + cp2y.toFixed(1) + ', '
         + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }

    const areaD = d + ' L ' + mapped[mapped.length - 1].x.toFixed(1) + ' ' + (padT + plotH)
                + ' L ' + mapped[0].x.toFixed(1) + ' ' + (padT + plotH) + ' Z';

    let c = '<defs><linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,45,85,0.35)"/><stop offset="100%" stop-color="rgba(255,45,85,0)"/></linearGradient></defs>';
    c += '<path d="' + areaD + '" fill="url(#heroArea)"/>';
    c += '<path d="' + d + '" fill="none" stroke="#ff2d55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    c += '<circle cx="' + mapped[mapped.length - 1].x.toFixed(1) + '" cy="' + mapped[mapped.length - 1].y.toFixed(1) + '" r="4" fill="#fff" stroke="#ff2d55" stroke-width="2.5"/>';

    svg.innerHTML = c;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-011', e.message || 'renderStatsHero failed', '');
    }
  }
}


/* ============================================================
   ГРАФИК — ИНТЕРАКТИВНЫЙ
   ============================================================ */

function renderChart() {
  try {
    const svg = $('chartSvg');
    if (!svg) return;

    const points = getChartData(APP.currentPeriod);
    const validPoints = points.filter(function (p) { return p.value !== null; });

    const emptyEl = $('chartEmpty');
    const xLabelsEl = $('chartXLabels');

    if (!validPoints.length) {
      if (emptyEl) emptyEl.style.display = 'flex';
      svg.innerHTML = '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,45,85,0.25)"/><stop offset="100%" stop-color="rgba(255,45,85,0)"/></linearGradient></defs>';
      if (xLabelsEl) xLabelsEl.innerHTML = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    const W = 320, H = 180;
    const padL = 28, padR = 12, padT = 12, padB = 12;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const n = points.length;
    const stepX = n > 1 ? plotW / (n - 1) : plotW;

    const mapped = points.map(function (p, i) {
      return {
        x: padL + i * stepX,
        y: p.value !== null
          ? padT + plotH - ((p.value - 1) / 4) * plotH
          : null,
        value: p.value,
        label: p.label
      };
    });

    const validMapped = mapped.filter(function (p) { return p.y !== null; });

    let c = '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,45,85,0.25)"/><stop offset="100%" stop-color="rgba(255,45,85,0)"/></linearGradient></defs>';

    // Сетка
    [1, 2, 3, 4, 5].forEach(function (v) {
      const y = padT + plotH - ((v - 1) / 4) * plotH;
      c += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#f2f2f7" stroke-width="1" stroke-dasharray="4,4"/>';
      if (v === 1 || v === 3 || v === 5) {
        c += '<text x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" font-size="9" fill="#8e8e93" text-anchor="end">' + v + '</text>';
      }
    });

    // Линия
    if (validMapped.length >= 2) {
      const pathD = catmullRomPath(validMapped);
      const areaD = pathD + ' L ' + validMapped[validMapped.length - 1].x.toFixed(1) + ',' + (padT + plotH)
                  + ' L ' + validMapped[0].x.toFixed(1) + ',' + (padT + plotH) + ' Z';
      c += '<path class="chart-area" d="' + areaD + '" fill="url(#areaGrad)"/>';
      c += '<path class="chart-line" d="' + pathD + '" fill="none" stroke="#ff2d55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    } else if (validMapped.length === 1) {
      c += '<circle cx="' + validMapped[0].x.toFixed(1) + '" cy="' + validMapped[0].y.toFixed(1) + '" r="5" fill="#ff2d55"/>';
    }

    // Точки
    validMapped.forEach(function (p) {
      c += '<circle class="chart-dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5" fill="#fff" stroke="#ff2d55" stroke-width="2.5"/>';
    });

    // Зоны тапа
    mapped.forEach(function (p, i) {
      if (p.y === null) return;
      let zoneX = p.x - stepX / 2;
      let zoneW = stepX;
      if (i === 0) { zoneX = padL; zoneW = stepX / 2 + stepX / 2; }
      if (i === mapped.length - 1) { zoneW = stepX / 2 + padR; }

      c += '<rect class="chart-hover" '
         + 'x="' + zoneX.toFixed(1) + '" y="0" '
         + 'width="' + zoneW.toFixed(1) + '" height="' + H + '" '
         + 'fill="transparent" '
         + 'data-label="' + p.label + '" '
         + 'data-value="' + p.value.toFixed(1) + '" '
         + 'data-x="' + p.x.toFixed(1) + '" '
         + 'data-y="' + p.y.toFixed(1) + '"/>';
    });

    svg.innerHTML = c;

    // Подписи X
    if (xLabelsEl) {
      let step = 1;
      if (mapped.length > 10) step = Math.ceil(mapped.length / 6);
      let html = '';
      for (let i = 0; i < mapped.length; i += step) {
        html += '<span>' + mapped[i].label + '</span>';
      }
      xLabelsEl.innerHTML = html;
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-011', e.message || 'renderChart failed', '');
    }
  }
}

function catmullRomPath(points) {
  if (points.length < 2) return '';

  let d = 'M ' + points[0].x + ',' + points[0].y;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ' C ' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + p2.x + ',' + p2.y;
  }

  return d;
}

function onChartHover(el) {
  try {
    const tooltip = $('chartTooltip');
    const wrap = $('chartWrap');
    const svg = $('chartSvg');
    if (!tooltip || !wrap || !svg) return;

    const label = el.getAttribute('data-label');
    const value = el.getAttribute('data-value');
    const x = parseFloat(el.getAttribute('data-x'));
    const y = parseFloat(el.getAttribute('data-y'));

    const ttLabel = $('ttLabel');
    const ttValue = $('ttValue');
    if (ttLabel) ttLabel.textContent = label;
    if (ttValue) ttValue.textContent = value + ' из 5';

    const rect = wrap.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const scaleX = svgRect.width / 320;
    const scaleY = svgRect.height / 180;

    tooltip.style.left = (x * scaleX + (svgRect.left - rect.left)) + 'px';
    tooltip.style.top = (y * scaleY + (svgRect.top - rect.top)) + 'px';
    tooltip.classList.add('show');
  } catch (e) {}
}

function hideChartTooltip() {
  const tooltip = $('chartTooltip');
  if (tooltip) tooltip.classList.remove('show');
}


/* ============================================================
   СРАВНЕНИЕ
   ============================================================ */

function renderCompare() {
  try {
    const stats = getPeriodStats(APP.currentPeriod);

    const meName = getMyName();
    const pName = getPartnerName();
    const myDisplayName = (meName && meName !== CONFIG.DEFAULTS.myName) ? meName : 'Ты';
    const partnerDisplayName = (pName && pName !== CONFIG.DEFAULTS.partnerName) ? pName : 'Партнёр';

    const youHasData = !stats.iHide && stats.youValues.length > 0;
    const partnerHasData = !stats.partnerHide && stats.partnerValues.length > 0;

    // Ты
    const youNameEl = $('duoYouName');
    if (youNameEl) youNameEl.textContent = myDisplayName;

    const youAvatarEl = $('duoYouAvatar');
    if (youAvatarEl) youAvatarEl.textContent = getMyGenderEmoji();

    const youValueEl = $('duoYouValue');
    if (youValueEl) {
      if (stats.iHide) youValueEl.textContent = '•••';
      else if (youHasData) youValueEl.textContent = stats.youAvg.toFixed(1);
      else youValueEl.textContent = '—';
    }

    const youBarEl = $('duoYouBar');
    if (youBarEl) {
      youBarEl.style.width = (youHasData ? Math.round((stats.youAvg / 5) * 100) : 0) + '%';
    }

    const youStatusEl = $('duoYouStatus');
    if (youStatusEl) {
      if (youHasData) {
        youStatusEl.textContent = shortMoodLabel(Math.round(stats.youAvg * 20));
        youStatusEl.className = 'duo-status mood-' + Math.min(5, Math.max(1, Math.round(stats.youAvg)));
      } else {
        youStatusEl.textContent = '—';
        youStatusEl.className = 'duo-status';
      }
    }

    // Партнёр
    const partnerNameEl = $('duoPartnerName');
    if (partnerNameEl) partnerNameEl.textContent = partnerDisplayName;

    const partnerAvatarEl = $('duoPartnerAvatar');
    if (partnerAvatarEl) partnerAvatarEl.textContent = getPartnerGenderEmoji();

    const partnerValueEl = $('duoPartnerValue');
    if (partnerValueEl) {
      if (stats.partnerHide) partnerValueEl.textContent = '•••';
      else if (partnerHasData) partnerValueEl.textContent = stats.partnerAvg.toFixed(1);
      else partnerValueEl.textContent = '—';
    }

    const partnerBarEl = $('duoPartnerBar');
    if (partnerBarEl) {
      partnerBarEl.style.width = (partnerHasData ? Math.round((stats.partnerAvg / 5) * 100) : 0) + '%';
    }

    const partnerStatusEl = $('duoPartnerStatus');
    if (partnerStatusEl) {
      if (partnerHasData) {
        partnerStatusEl.textContent = shortMoodLabel(Math.round(stats.partnerAvg * 20));
        partnerStatusEl.className = 'duo-status mood-' + Math.min(5, Math.max(1, Math.round(stats.partnerAvg)));
      } else {
        partnerStatusEl.textContent = '—';
        partnerStatusEl.className = 'duo-status';
      }
    }

    // Итоговая строка
    const summaryEl = $('compareSummary');
    if (summaryEl) {
      summaryEl.innerHTML = buildCompareSummary(stats, myDisplayName, partnerDisplayName);
    }
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-011', e.message || 'renderCompare failed', '');
    }
  }
}

function buildCompareSummary(stats, myName, partnerName) {
  const youHasData = !stats.iHide && stats.youValues.length > 0;
  const partnerHasData = !stats.partnerHide && stats.partnerValues.length > 0;

  if (!youHasData && !partnerHasData) {
    if (stats.iHide || stats.partnerHide) {
      return '<span class="cmp-emoji">🔒</span><span>Недостаточно данных — часть оценок скрыта.</span>';
    }
    return '<span class="cmp-emoji">💗</span><span>Пока нет данных за этот период.</span>';
  }

  if (youHasData && !partnerHasData) {
    if (stats.partnerHide) {
      return '<span class="cmp-emoji">🔒</span><span><b>' + partnerName + '</b> скрыл(а) свои оценки за этот период.</span>';
    }
    return '<span class="cmp-emoji">⏳</span><span><b>' + partnerName + '</b> пока не голосовал(а) за этот период.</span>';
  }

  if (!youHasData && partnerHasData) {
    if (stats.iHide) {
      return '<span class="cmp-emoji">🔒</span><span>Твои оценки за этот период скрыты.</span>';
    }
    return '<span class="cmp-emoji">⏳</span><span>Ты пока не голосовал(а) за этот период.</span>';
  }

  const diff = stats.youAvg - stats.partnerAvg;
  const absDiff = Math.abs(diff);

  if (absDiff < 0.15) {
    return '<span class="cmp-emoji">🤝</span><span>Вы чувствуете себя <b>одинаково</b> — средний уровень <span class="cmp-accent">' + stats.youAvg.toFixed(1) + ' из 5</span>.</span>';
  }

  if (diff > 0) {
    return '<span class="cmp-emoji">💗</span><span><b>' + myName + '</b> в среднем чувствуешь себя на <span class="cmp-accent">' + absDiff.toFixed(1) + '</span> теплее, чем <b>' + partnerName + '</b>.</span>';
  }

  return '<span class="cmp-emoji">💙</span><span><b>' + partnerName + '</b> в среднем чувствует себя на <span class="cmp-accent">' + absDiff.toFixed(1) + '</span> теплее, чем <b>' + myName + '</b>.</span>';
}


/* ============================================================
   РЕКОРДЫ
   ============================================================ */

function renderRecords() {
  try {
    const rec = computeRecords();

    const bestDayEl = $('bestDay');
    if (bestDayEl) {
      bestDayEl.textContent = rec.bestDate
        ? formatShortDate(rec.bestDate) + ' · ' + rec.bestValue.toFixed(1)
        : '—';
    }

    const worstDayEl = $('worstDay');
    if (worstDayEl) {
      worstDayEl.textContent = rec.worstDate
        ? formatShortDate(rec.worstDate) + ' · ' + rec.worstValue.toFixed(1)
        : '—';
    }

    const longestFiveEl = $('longestFive');
    if (longestFiveEl) longestFiveEl.textContent = rec.longestFive + ' дн.';
  } catch (e) {}
}

function formatShortDate(key) {
  if (!key) return '—';
  const d = parseDate(key);
  return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
}


/* ============================================================
   КАЛЕНДАРЬ
   ============================================================ */

function initCalendar() {
  const now = new Date();
  APP.calYear = now.getFullYear();
  APP.calMonth = now.getMonth();
}

function renderCalendar() {
  try {
    const label = $('calMonthLabel');
    const grid = $('calGrid');
    if (!label || !grid) return;

    label.textContent = MONTHS_FULL[APP.calMonth] + ' ' + APP.calYear;

    const firstDay = new Date(APP.calYear, APP.calMonth, 1);
    const daysInMonth = new Date(APP.calYear, APP.calMonth + 1, 0).getDate();

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const iHide = getMyHideFlag();
    const partnerHide = getPartnerHideFlag();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === APP.calYear && today.getMonth() === APP.calMonth;
    const todayDay = today.getDate();

    let html = '';

    for (let i = 0; i < startDow; i++) {
      html += '<div class="cal-cell" aria-hidden="true"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = APP.calYear + '-' + pad(APP.calMonth + 1) + '-' + pad(d);
      const v = APP.state.votes[dateKey];

      let circleStyle = '';
      let bothClass = '';

      if (v) {
        const visibleVals = [];
        if (v.you && !iHide) visibleVals.push(v.you);
        if (v.partner && !partnerHide) visibleVals.push(v.partner);

        if (visibleVals.length) {
          const moodVal = Math.round(avg(visibleVals));

          if (v.you && v.partner && !iHide && !partnerHide) bothClass = ' both';
          else if (v.you && v.partner && (iHide || partnerHide)) bothClass = ' both hidden-some';

          circleStyle = 'background:' + CONFIG.MOODS[moodVal - 1] + ';color:#fff;';
        } else if (v.you || v.partner) {
          circleStyle = 'background:#f2f2f7;color:#8e8e93;';
        }
      }

      const isToday = isCurrentMonth && d === todayDay;

      html += '<button type="button" class="cal-cell" '
           + 'data-date="' + dateKey + '" '
           + 'data-day="' + d + '" '
           + 'aria-label="' + d + ' число">';
      html += '<div class="cal-day'
           + (isToday ? ' today' : (v ? ' has-data' : ' empty'))
           + bothClass
           + '" style="' + (isToday ? '' : circleStyle) + '">' + d + '</div>';
      html += '</button>';
    }

    grid.innerHTML = html;

    renderInsight();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-010', e.message || 'renderCalendar failed', '');
    }
  }
}

function onCalCellClick(dateKey, day) {
  try {
    const v = APP.state.votes[dateKey];
    const monthName = MONTHS_GENITIVE[APP.calMonth];

    if (!v) {
      showToast(day + ' ' + monthName + ': нет данных');
      return;
    }

    const iHide = getMyHideFlag();
    const partnerHide = getPartnerHideFlag();

    const parts = [];
    if (v.you) parts.push(iHide ? 'ты •••' : 'ты ' + v.you);
    if (v.partner) parts.push(partnerHide ? 'партнёр •••' : 'партнёр ' + v.partner);

    showToast(day + ' ' + monthName + ': ' + parts.join(', '));
  } catch (e) {}
}

function renderInsight() {
  try {
    const el = $('insightText');
    if (!el) return;

    const insight = computeMonthlyInsight(APP.calYear, APP.calMonth);

    if (!insight.count) {
      el.textContent = 'Пока нет данных за этот месяц.';
      return;
    }

    let html = 'Средняя оценка месяца — <b>' + insight.avgMonth + ' из 5</b>. ';

    if (insight.bestDay) {
      html += 'Лучший день — <b>' + insight.bestDay + ' число</b>. ';
    }

    html += 'Оба партнёра голосовали <b>'
         + insight.bothDays + ' из ' + insight.daysInMonth
         + '</b> дней.';

    el.innerHTML = html;
  } catch (e) {}
}

function prevMonth() {
  try {
    APP.calMonth--;
    if (APP.calMonth < 0) { APP.calMonth = 11; APP.calYear--; }
    renderCalendar();
  } catch (e) {}
}

function nextMonth() {
  try {
    APP.calMonth++;
    if (APP.calMonth > 11) { APP.calMonth = 0; APP.calYear++; }
    renderCalendar();
  } catch (e) {}
}


/* ============================================================
   ОБЩАЯ ПЕРЕРИСОВКА ГЛАВНОЙ
   ============================================================ */

function renderAll() {
  try {
    updateHeart();
    renderVoteButtons();
    renderCoupleState();

    const sp = $('streakValue');
    if (sp) sp.textContent = APP.state.streak;

    const pn = $('profileNames');
    if (pn) pn.textContent = APP.state.names;

    const nbv = $('namesBtnValue');
    if (nbv) nbv.textContent = APP.state.names;
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-004', e.message || 'renderAll failed', '');
    }
  }
}