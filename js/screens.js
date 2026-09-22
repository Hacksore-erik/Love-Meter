/* ============================================================
   SCREENS — логика экранов
   ============================================================
   Файл отвечает за отрисовку и интерактив четырёх экранов:
   - Главная: сердце + голосование
   - Награды: достижения
   - Календарь
   - Динамика: график + сравнение + рекорды

   Все функции вызываются из app.js через renderAll() или
   напрямую через switchTab(). Файл не инициализирует
   приложение, он только рисует.
   ============================================================ */


/* ============================================================
   ГЛАВНАЯ — СЕРДЦЕ
   ============================================================ */

/* Обновление сердца: заполнение + процент + статус */
function updateHeart(animated) {
  const fill = $('heartFill');
  const pctEl = $('heartPercent');
  const statusEl = $('heartStatus');
  if (!fill || !pctEl || !statusEl) return;

  const pct = computePercent();
  const y = 195 - (pct / 100) * 190;

  /* Плавный переход только когда значение меняется */
  fill.style.transition = animated
    ? 'y 1s cubic-bezier(0.4, 0, 0.2, 1)'
    : 'none';

  fill.setAttribute('y', y);
  pctEl.textContent = pct + '%';

  /* Статусный текст и цвет в зависимости от уровня */
  let status, color;
  if (pct === 0) {
    status = 'Начните отмечать настроение';
    color = '#8e8e93';
  } else if (pct <= 20) {
    status = 'Нужен тёплый разговор 💬';
    color = '#8e8e93';
  } else if (pct <= 40) {
    status = 'Немного прохладно ❄️';
    color = '#5e7dff';
  } else if (pct <= 60) {
    status = 'Спокойно и стабильно 💜';
    color = '#a56bff';
  } else if (pct <= 80) {
    status = 'Между вами тепло 💗';
    color = '#ff5e7d';
  } else {
    status = 'Любовь пылает! ❤️‍🔥';
    color = '#ff2d55';
  }

  statusEl.textContent = status;
  statusEl.style.color = color;
}


/* ============================================================
   ГЛАВНАЯ — ГОЛОСОВАНИЕ
   ============================================================ */

/* Отрисовка состояния кнопок голосования */
function renderVoteButtons() {
  const myVote = getTodayVote();
  const btns = document.querySelectorAll('.vote-btn');
  const question = $('voteQuestion');
  const hint = $('voteHint');
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
  });

  if (myVote) {
    question.textContent = 'Спасибо! Партнёр тоже может проголосовать 💕';
    hint.textContent = 'Ваш голос: ' + myVote + ' из 5';
    btns.forEach(function (b) {
      b.disabled = true;
      b.style.opacity = '0.7';
    });
  } else {
    question.textContent = 'Как вы себя чувствуете сегодня в отношениях?';
    hint.textContent = 'Можно менять один раз в день';
    btns.forEach(function (b) {
      b.disabled = false;
      b.style.opacity = '1';
    });
  }
}

/* Обработчик клика по кнопке голосования */
async function handleVote(vote) {
  try {
    if (getTodayVote()) {
      showToast('Сегодня вы уже голосовали 💕');
      return;
    }

    const key = todayStr();
    if (!APP.state.votes[key]) APP.state.votes[key] = {};
    APP.state.votes[key][APP.myRole] = vote;

    recalcStats();
    saveState();

    /* Анимация кнопок до выбранной */
    const btns = document.querySelectorAll('.vote-btn');
    btns.forEach(function (btn, i) {
      const v = i + 1;
      if (v <= vote) {
        btn.textContent = '❤️';
        btn.classList.add('active', 'pop');
        setTimeout(function () {
          btn.classList.remove('pop');
        }, 400);
      }
    });

    /* Конфетти и вибрация при пятёрке */
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

    updateHeart(true);
    renderVoteButtons();
    renderAll();

    /* Отправка на сервер */
    if (APP.supabaseClient && APP.coupleId) {
      const ok = await pushVoteToSupabase(key, APP.myRole, vote);
      if (ok) {
        showToast('Голос отправлен партнёру 💕');
      } else {
        showToast('Сохранено локально ⏳');
      }
    } else {
      showToast('Голос учтён! 💕');
    }
  } catch (e) {
    showToast('Не удалось сохранить голос');
  }
}


/* ============================================================
   КОНФЕТТИ — 14 частиц, вылетают вверх
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

      /* Убираем из DOM после окончания анимации */
      setTimeout(function () {
        try { el.remove(); } catch (e) {}
      }, 2000);
    }
  } catch (e) { /* игнорируем */ }
}


/* ============================================================
   НАГРАДЫ — достижения
   ============================================================ */
function renderAchievements() {
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

  /* Обновляем сводку сверху */
  const sub = $('awardsSubtitle');
  if (sub) {
    sub.textContent = 'Открыто ' + unlockedCount + ' из ' + CONFIG.ACHIEVEMENTS.length;
  }
  const ss = $('statStreak');
  if (ss) ss.textContent = APP.state.streak;
  const st = $('statTotal');
  if (st) st.textContent = APP.state.totalVotes;
  const sm = $('statMedals');
  if (sm) sm.textContent = unlockedCount;
}
/* ============================================================
   КАЛЕНДАРЬ
   ============================================================ */

/* Инициализация календаря — выставляем текущий месяц */
function initCalendar() {
  const now = new Date();
  APP.calYear = now.getFullYear();
  APP.calMonth = now.getMonth();
}

/* Отрисовка календаря */
function renderCalendar() {
  const label = $('calMonthLabel');
  const grid = $('calGrid');
  if (!label || !grid) return;

  /* Заголовок месяца */
  label.textContent = MONTHS_FULL[APP.calMonth] + ' ' + APP.calYear;

  /* Сколько дней в месяце и с какого дня недели начинается */
  const firstDay = new Date(APP.calYear, APP.calMonth, 1);
  const daysInMonth = new Date(APP.calYear, APP.calMonth + 1, 0).getDate();

  /* Приводим воскресенье (0) к 6, понедельник (1) к 0 */
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  let html = '';

  /* Пустые ячейки до первого числа */
  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-cell" aria-hidden="true"></div>';
  }

  /* Дни месяца */
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = APP.calYear + '-' + pad(APP.calMonth + 1) + '-' + pad(d);
    const v = APP.state.votes[dateKey];

    let circleStyle = '';
    let bothClass = '';

    if (v) {
      let moodVal = 0;
      if (v.you && v.partner) {
        moodVal = Math.round((v.you + v.partner) / 2);
        bothClass = ' both';
      } else if (v.you) {
        moodVal = v.you;
      } else if (v.partner) {
        moodVal = v.partner;
      }

      if (moodVal > 0) {
        circleStyle = 'background:' + CONFIG.MOODS[moodVal - 1] + ';color:#fff;';
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
}

/* Обработчик тапа по ячейке календаря */
function onCalCellClick(dateKey, day) {
  const v = APP.state.votes[dateKey];
  const monthName = MONTHS_GENITIVE[APP.calMonth];

  if (v) {
    const parts = [];
    if (v.you) parts.push('ты ' + v.you);
    if (v.partner) parts.push('партнёр ' + v.partner);
    showToast(day + ' ' + monthName + ': ' + parts.join(', '));
  } else {
    showToast(day + ' ' + monthName + ': нет данных');
  }
}

/* Инсайт месяца — три строки под календарём */
function renderInsight() {
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
}

/* Навигация по месяцам */
function prevMonth() {
  APP.calMonth--;
  if (APP.calMonth < 0) {
    APP.calMonth = 11;
    APP.calYear--;
  }
  renderCalendar();
}

function nextMonth() {
  APP.calMonth++;
  if (APP.calMonth > 11) {
    APP.calMonth = 0;
    APP.calYear++;
  }
  renderCalendar();
}


/* ============================================================
   ДИНАМИКА — ГРАФИК
   ============================================================ */

/* Обновление графика для текущего периода */
function renderChart() {
  const svg = $('chartSvg');
  if (!svg) return;

  const points = getChartData(APP.currentPeriod);
  const validPoints = points.filter(function (p) { return p.value !== null; });

  /* Среднее значение за период — в заголовке карточки */
  const avgVal = validPoints.length
    ? avg(validPoints.map(function (p) { return p.value; }))
    : 0;

  const avgEl = $('chartAvg');
  if (avgEl) {
    avgEl.textContent = validPoints.length ? avgVal.toFixed(1) : '—';
  }

  /* Дельта — сравнение первой и второй половины периода */
  renderDelta(validPoints);

  /* Размеры SVG-вьюбокса */
  const W = 320;
  const H = 180;
  const padL = 28;
  const padR = 8;
  const padT = 10;
  const padB = 10;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  /* Сколько точек и расстояние между ними */
  const n = points.length;
  const stepX = n > 1 ? plotW / (n - 1) : plotW;

  /* Преобразуем значения (1..5) в координаты (y в пикселях) */
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

  /* Сетка: горизонтальные линии на 1, 3, 5 */
  [1, 3, 5].forEach(function (v) {
    const y = padT + plotH - ((v - 1) / 4) * plotH;
    c += '<line x1="' + padL + '" y1="' + y + '" '
       + 'x2="' + (W - padR) + '" y2="' + y + '" '
       + 'stroke="#f2f2f7" stroke-width="1" stroke-dasharray="4,4"/>';
    c += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" '
       + 'font-size="9" fill="#8e8e93" text-anchor="end">' + v + '</text>';
  });

  /* Градиент для заливки под кривой */
  c += '<defs>'
     + '<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">'
     + '<stop offset="0%" stop-color="rgba(255,45,85,0.25)"/>'
     + '<stop offset="100%" stop-color="rgba(255,45,85,0)"/>'
     + '</linearGradient>'
     + '</defs>';

  /* Кривая и заливка (только если есть 2+ точек) */
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

  /* Точки данных */
  validMapped.forEach(function (p) {
    c += '<circle class="chart-dot" cx="' + p.x + '" cy="' + p.y + '" '
       + 'r="3" fill="#fff" stroke="#ff2d55" stroke-width="2"/>';
  });

  /* Невидимые прямоугольники для интерактива (hover/tap) */
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

  /* Подписи по оси X — прореживаем */
  renderXLabels(mapped);

  /* Сравнение и рекорды */
  renderCompare();
  renderRecords();
}

/* Плашка дельты — сравнение половин периода */
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

/* Подписи по оси X */
function renderXLabels(mapped) {
  const el = $('chartXLabels');
  if (!el) return;

  let step;
  if (APP.currentPeriod === 'month') {
    step = 5;
  } else if (APP.currentPeriod === 'year') {
    step = 2;
  } else {
    step = 1;
  }

  let html = '';
  for (let i = 0; i < mapped.length; i += step) {
    html += '<span class="chart-x-label">' + mapped[i].label + '</span>';
  }
  el.innerHTML = html;
}

/* Построение плавной кривой через точки (Catmull-Rom → cubic bezier) */
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

/* Интерактив на графике — tooltip */
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
  } catch (e) { /* игнорируем */ }
}

function hideChartTooltip() {
  const tooltip = $('chartTooltip');
  if (tooltip) tooltip.classList.remove('show');
}


/* ============================================================
   ДИНАМИКА — СРАВНЕНИЕ ТЫ / ПАРТНЁР
   ============================================================ */
function renderCompare() {
  const stats = getPeriodStats(APP.currentPeriod);

  /* Моё среднее */
  const youEl = $('compareYouVal');
  if (youEl) {
    youEl.textContent = stats.youValues.length
      ? stats.youAvg.toFixed(1)
      : '—';
  }

  /* Среднее партнёра — с учётом приватности */
  const partnerRow = $('comparePartner');
  const partnerValEl = $('comparePartnerVal');

  if (APP.state.openMode) {
    if (partnerRow) partnerRow.classList.remove('compare-blur');
    if (partnerValEl) {
      partnerValEl.textContent = stats.partnerValues.length
        ? stats.partnerAvg.toFixed(1)
        : '—';
    }
  } else {
    if (partnerRow) partnerRow.classList.add('compare-blur');
    if (partnerValEl) {
      partnerValEl.textContent = stats.partnerValues.length ? '•••' : '—';
    }
  }

  /* Мини-спарклайны */
  drawSparkline('sparkYou', stats.youValues, '#ff2d55');
  drawSparkline('sparkPartner', stats.partnerValues, '#5e7dff');
}

/* Рисуем маленький график-спарклайн шириной 60px */
function drawSparkline(id, vals, color) {
  const svg = $(id);
  if (!svg) return;

  const W = 60;
  const H = 20;

  if (vals.length < 2) {
    svg.innerHTML = '';
    return;
  }

  const min = Math.min.apply(null, vals);
  const max = Math.max.apply(null, vals);
  const range = max - min || 1;
  const stepX = W / (vals.length - 1);

  const pts = vals.map(function (v, i) {
    return {
      x: i * stepX,
      y: H - 2 - ((v - min) / range) * (H - 4)
    };
  });

  let d = 'M ' + pts[0].x + ',' + pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    d += ' L ' + pts[i].x + ',' + pts[i].y;
  }

  svg.innerHTML = '<path d="' + d + '" fill="none" stroke="' + color
                + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
}


/* ============================================================
   ДИНАМИКА — РЕКОРДЫ
   ============================================================ */
function renderRecords() {
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
  if (longestFiveEl) {
    longestFiveEl.textContent = rec.longestFive + ' дн.';
  }
}

/* '2025-11-22' → '22.11.2025' */
function formatShortDate(key) {
  if (!key) return '—';
  const d = parseDate(key);
  return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
}
/* ============================================================
   ОБЩАЯ ФУНКЦИЯ — ПЕРЕРИСОВКА ГЛАВНОЙ
   ============================================================
   Вызывается всякий раз, когда меняется state:
   - при голосовании
   - при получении realtime-обновления от партнёра
   - при загрузке данных с сервера
   - при init()
   ============================================================ */
function renderAll() {
  try {
    updateHeart(true);
    renderVoteButtons();

    /* Стрик в шапке */
    const sp = $('streakValue');
    if (sp) sp.textContent = APP.state.streak;

    /* Имя пары в шапке */
    const sub = $('headerSubtitle');
    if (sub) sub.textContent = APP.state.names;

    /* Имя пары в профиле */
    const pn = $('profileNames');
    if (pn) pn.textContent = APP.state.names;

    /* Значение в пункте «Имена пары» */
    const nbv = $('namesBtnValue');
    if (nbv) nbv.textContent = APP.state.names;
  } catch (e) { /* не роняем приложение */ }
}