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