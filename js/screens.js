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

      html += '<button type="button" class="cal-cell" '
           + 'data-date="' + dateKey + '" '
           + 'data-day="' + d + '" '
           + 'aria-label="' + d + ' число">';
      html += '<div class="cal-day'
           + (v ? ' has-data' : ' empty')
           + bothClass
           + '" style="' + circleStyle + '">' + d + '</div>';
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
   ДИНАМИКА — ГРАФИК
   ============================================================ */

function renderChart() {
  try {
    const svg = $('chartSvg');
    if (!svg) return;

    const points = getChartData(APP.currentPeriod);
    const validPoints = points.filter(function (p) { return p.value !== null; });

    const avgVal = validPoints.length
      ? avg(validPoints.map(function (p) { return p.value; }))
      : 0;

    const avgEl = $('chartAvg');
    if (avgEl) avgEl.textContent = validPoints.length ? avgVal.toFixed(1) : '—';

    renderDelta(validPoints);

    const W = 320, H = 180, padL = 28, padR = 8, padT = 10, padB = 10;
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

    let c = '';

    [1, 3, 5].forEach(function (v) {
      const y = padT + plotH - ((v - 1) / 4) * plotH;
      c += '<line x1="' + padL + '" y1="' + y + '" '
         + 'x2="' + (W - padR) + '" y2="' + y + '" '
         + 'stroke="#f2f2f7" stroke-width="1" stroke-dasharray="4,4"/>';
      c += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" '
         + 'font-size="9" fill="#8e8e93" text-anchor="end">' + v + '</text>';
    });

    c += '<defs>'
       + '<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">'
       + '<stop offset="0%" stop-color="rgba(255,45,85,0.25)"/>'
       + '<stop offset="100%" stop-color="rgba(255,45,85,0)"/>'
       + '</linearGradient>'
       + '</defs>';

    if (validMapped.length >= 2) {
      const pathD = catmullRomPath(validMapped);
      const areaD = pathD
        + ' L ' + validMapped[validMapped.length - 1].x + ',' + (padT + plotH)
        + ' L ' + validMapped[0].x + ',' + (padT + plotH)
        + ' Z';

      c += '<path d="' + areaD + '" fill="url(#areaGrad)"/>';
      c += '<path class="chart-line" d="' + pathD + '" '
         + 'fill="none" stroke="#ff2d55" stroke-width="3" '
         + 'stroke-linecap="round" stroke-linejoin="round"/>';
    } else if (validMapped.length === 1) {
      c += '<circle cx="' + validMapped[0].x + '" cy="' + validMapped[0].y + '" '
         + 'r="4" fill="#ff2d55"/>';
    }

    validMapped.forEach(function (p) {
      c += '<circle class="chart-dot" cx="' + p.x + '" cy="' + p.y + '" '
         + 'r="3" fill="#fff" stroke="#ff2d55" stroke-width="2"/>';
    });

    mapped.forEach(function (p) {
      if (p.y === null) return;
      c += '<rect class="chart-hover" '
         + 'x="' + (p.x - stepX / 2) + '" y="0" '
         + 'width="' + stepX + '" height="' + H + '" '
         + 'fill="transparent" '
         + 'data-label="' + p.label + '" '
         + 'data-value="' + p.value.toFixed(1) + '" '
         + 'data-y="' + p.y + '"/>';
    });

    svg.innerHTML = c;

    renderXLabels(mapped);
    renderCompare();
    renderRecords();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record('LM-011', e.message || 'renderChart failed', '');
    }
  }
}

function renderDelta(validPoints) {
  const deltaEl = $('chartDelta');
  if (!deltaEl) return;

  if (validPoints.length < 2) {
    deltaEl.className = 'chart-delta delta-same';
    deltaEl.textContent = '= без изменений';
    return;
  }

  const half = Math.floor(validPoints.length / 2);
  const firstHalf = validPoints.slice(0, half);
  const secondHalf = validPoints.slice(half);

  const avg1 = avg(firstHalf.map(function (p) { return p.value; }));
  const avg2 = avg(secondHalf.map(function (p) { return p.value; }));

  if (avg1 === 0) {
    deltaEl.className = 'chart-delta delta-same';
    deltaEl.textContent = '= без изменений';
    return;
  }

  const pctDiff = Math.round(((avg2 - avg1) / avg1) * 100);

  if (pctDiff > 0) {
    deltaEl.className = 'chart-delta delta-up';
    deltaEl.textContent = '+' + pctDiff + '% к прошлому';
  } else if (pctDiff < 0) {
    deltaEl.className = 'chart-delta delta-down';
    deltaEl.textContent = pctDiff + '% к прошлому';
  } else {
    deltaEl.className = 'chart-delta delta-same';
    deltaEl.textContent = '= без изменений';
  }
}

function renderXLabels(mapped) {
  const el = $('chartXLabels');
  if (!el) return;

  let step;
  if (APP.currentPeriod === 'month') step = 5;
  else if (APP.currentPeriod === 'year') step = 2;
  else step = 1;

  let html = '';
  for (let i = 0; i < mapped.length; i += step) {
    html += '<span class="chart-x-label">' + mapped[i].label + '</span>';
  }
  el.innerHTML = html;
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

    d += ' C ' + cp1x + ',' + cp1y + ' '
       + cp2x + ',' + cp2y + ' '
       + p2.x + ',' + p2.y;
  }

  return d;
}

function onChartHover(el) {
  try {
    const tooltip = $('chartTooltip');
    const wrap = $('chartWrap');
    const svg = $('chartSvg');
    if (!tooltip || !wrap || !svg) return;

    const label = el.dataset.label;
    const value = el.dataset.value;
    const x = parseFloat(el.getAttribute('x')) + parseFloat(el.getAttribute('width')) / 2;
    const y = parseFloat(el.dataset.y);

    tooltip.textContent = label + ' — ' + value;

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
   ДИНАМИКА — СРАВНЕНИЕ
   ============================================================ */

function renderCompare() {
  try {
    const youLabelEl = $('compareYouLabel');
    if (youLabelEl) {
      const me = getMyName();
      youLabelEl.textContent = (me && me !== CONFIG.DEFAULTS.myName) ? me : 'Ты';
    }

    const partnerLabelEl = $('comparePartnerLabel');
    if (partnerLabelEl) {
      const p = getPartnerName();
      partnerLabelEl.textContent = (p && p !== CONFIG.DEFAULTS.partnerName) ? p : 'Партнёр';
    }

    const stats = getPeriodStats(APP.currentPeriod);

    const youEl = $('compareYouVal');
    if (youEl) {
      youEl.textContent = stats.iHide
        ? '•••'
        : (stats.youValues.length ? stats.youAvg.toFixed(1) : '—');
    }

    const partnerRow = $('comparePartner');
    const partnerValEl = $('comparePartnerVal');
    if (partnerRow && partnerValEl) {
      if (stats.partnerHide) {
        partnerRow.classList.add('compare-blur');
        partnerValEl.textContent = stats.partnerValues.length ? '•••' : '—';
      } else {
        partnerRow.classList.remove('compare-blur');
        partnerValEl.textContent = stats.partnerValues.length
          ? stats.partnerAvg.toFixed(1)
          : '—';
      }
    }

    drawSparkline('sparkYou', stats.iHide ? [] : stats.youValues, '#ff2d55');
    drawSparkline('sparkPartner', stats.partnerHide ? [] : stats.partnerValues, '#5e7dff');
  } catch (e) {}
}

function drawSparkline(id, vals, color) {
  const svg = $(id);
  if (!svg) return;

  const W = 60, H = 20;

  if (vals.length < 2) {
    svg.innerHTML = '';
    return;
  }

  const min = Math.min.apply(null, vals);
  const max = Math.max.apply(null, vals);
  const range = max - min || 1;
  const stepX = W / (vals.length - 1);

  const pts = vals.map(function (v, i) {
    return { x: i * stepX, y: H - 2 - ((v - min) / range) * (H - 4) };
  });

  let d = 'M ' + pts[0].x + ',' + pts[0].y;
  for (let i = 1; i < pts.length; i++) d += ' L ' + pts[i].x + ',' + pts[i].y;

  svg.innerHTML = '<path d="' + d + '" fill="none" stroke="' + color
                + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
}


/* ============================================================
   ДИНАМИКА — РЕКОРДЫ
   ============================================================ */

function renderRecords() {
  try {
    const rec = computeRecords();

    const bestDayEl = $('bestDay');
    if (bestDayEl) {
      bestDayEl.textContent = rec.bestDate
        ? formatShortDate(rec.bestDate) + ' (' + rec.bestValue.toFixed(1) + ')'
        : '—';
    }

    const worstDayEl = $('worstDay');
    if (worstDayEl) {
      worstDayEl.textContent = rec.worstDate
        ? formatShortDate(rec.worstDate) + ' (' + rec.worstValue.toFixed(1) + ')'
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