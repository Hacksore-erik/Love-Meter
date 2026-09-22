/* ============================================================
   APP — точка входа
   ============================================================ */

function safeCall(code, label, fn) {
  try {
    return fn();
  } catch (e) {
    if (typeof LM !== 'undefined') {
      LM.record(code, e.message || label, (e.stack || '').substring(0, 300));
    }
    return null;
  }
}

function checkGlobals() {
  var required = [
    'initCore', 'loadState', 'saveState', 'recalcStats',
    'computePartnerPercent', 'computeCouplePercent',
    'updateHeart', 'renderVoteButtons', 'renderCoupleState', 'renderAll',
    'renderStats', 'renderStatsHero', 'renderChart', 'renderCompare', 'renderRecords',
    'renderCalendar', 'renderInsight',
    'handleVote', 'onVoteChangeClick',
    'initCalendar', 'renderAchievements', 'renderProfile',
    'bindEvents', 'goToTab', 'showToast', 'updateSyncDot', 'updateUpdatedHint'
  ];
  var missing = [];
  for (var i = 0; i < required.length; i++) {
    if (typeof window[required[i]] !== 'function') missing.push(required[i]);
  }
  if (missing.length && typeof LM !== 'undefined') {
    LM.record('LM-025', 'Не найдены функции: ' + missing.join(', '), 'checkGlobals');
  }
  return missing;
}

function fallbackBind() {
  try {
    var tabBar = document.getElementById('tabBar');
    if (tabBar && tabBar.getAttribute('data-fb-bound') !== '1') {
      tabBar.setAttribute('data-fb-bound', '1');
      var ORDER = ['home', 'awards', 'stats', 'profile'];
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.tab-item');
        if (!tab) return;
        var idx = ORDER.indexOf(tab.dataset.tab);
        if (idx < 0) return;

        var all = tabBar.querySelectorAll('.tab-item');
        for (var i = 0; i < all.length; i++) {
          all[i].classList.toggle('active', i === idx);
        }
        var track = document.getElementById('screensTrack');
        if (track) {
          var screensEl = document.getElementById('screens');
          var w = screensEl ? screensEl.clientWidth : 0;
          track.style.transform = 'translate3d(-' + (idx * w) + 'px, 0, 0)';
        }
        var screens = document.querySelectorAll('.screen');
        if (screens[idx]) screens[idx].scrollTop = 0;

        if (ORDER[idx] === 'awards' && typeof renderAchievements === 'function') {
          try { renderAchievements(); } catch (e) {}
        }
        if (ORDER[idx] === 'stats' && typeof renderStats === 'function') {
          try { renderStats(); } catch (e) {}
        }
        if (ORDER[idx] === 'profile' && typeof renderProfile === 'function') {
          try { renderProfile(); } catch (e) {}
        }
      });
    }
  } catch (e) {
    if (typeof LM !== 'undefined') LM.record('LM-005', 'fallbackBind tabs', e.message || '');
  }

  try {
    var voteBtns = document.querySelectorAll('.vote-btn');
    voteBtns.forEach(function (btn) {
      if (btn.getAttribute('data-fb-bound') === '1') return;
      btn.setAttribute('data-fb-bound', '1');
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var v = parseInt(btn.dataset.vote, 10);
        if (v >= 1 && v <= 5 && typeof handleVote === 'function') {
          try { handleVote(v); } catch (e) {}
        }
      });
    });
  } catch (e) {
    if (typeof LM !== 'undefined') LM.record('LM-005', 'fallbackBind vote', e.message || '');
  }
}

function init() {

  /* ШАГ 1. ЯДРО */
  safeCall('LM-028', 'initCore failed', function () {
    initCore();
  });

  if (!APP.state) {
    APP.state = {
      names: CONFIG.DEFAULTS.names,
      myName: CONFIG.DEFAULTS.myName,
      partnerName: CONFIG.DEFAULTS.partnerName,
      myGender: CONFIG.DEFAULTS.myGender,
      partnerGender: CONFIG.DEFAULTS.partnerGender,
      startDate: todayStr(),
      votes: {},
      hideMyVotes: false,
      partnerHideFlag: false,
      streak: 0,
      totalVotes: 0
    };
  }
  if (!APP.myId) {
    APP.myId = safeCall('LM-027', 'uuid fallback', function () {
      return uuid();
    }) || ('fallback-' + Date.now());
  }

  /* ШАГ 2. ДИАГНОСТИКА */
  safeCall('LM-025', 'checkGlobals', function () {
    checkGlobals();
  });

  /* ШАГ 3. ОБРАБОТЧИКИ */
  safeCall('LM-005', 'bindEvents failed', function () {
    if (typeof bindEvents === 'function') bindEvents();
  });

  /* ШАГ 4. АВАРИЙНЫЙ FALLBACK */
  safeCall('LM-005', 'fallbackBind failed', function () {
    fallbackBind();
  });

  /* ШАГ 5. ПЕРВЫЙ РЕНДЕР */
  safeCall('LM-003', 'initCalendar failed', function () {
    if (typeof initCalendar === 'function') initCalendar();
  });
  safeCall('LM-004', 'renderAll failed', function () {
    if (typeof renderAll === 'function') renderAll();
  });
  safeCall('LM-009', 'renderAchievements failed', function () {
    if (typeof renderAchievements === 'function') renderAchievements();
  });
  safeCall('LM-011', 'renderStats failed', function () {
    if (typeof renderStats === 'function') renderStats();
  });
  safeCall('LM-012', 'renderProfile failed', function () {
    if (typeof renderProfile === 'function') renderProfile();
  });

  /* ШАГ 6. СИНХРОНИЗАЦИЯ */
  safeCall('LM-026', 'updateSyncDot failed', function () {
    if (typeof updateSyncDot === 'function') {
      updateSyncDot(APP.coupleId ? 'on' : 'local');
    }
  });

  /* ШАГ 7. PWA */
  setTimeout(function () {
    try { if (typeof setupPWA === 'function') setupPWA(); } catch (e) {}
    try { if (typeof setupInstallPrompt === 'function') setupInstallPrompt(); } catch (e) {}
  }, 100);

  /* ШАГ 8. SUPABASE В ФОНЕ */
  if (HAS_SUPABASE && typeof initSupabaseAsync === 'function') {
    initSupabaseAsync()
      .then(function (client) {
        if (!client) {
          try { if (typeof updateSyncDot === 'function') updateSyncDot('local'); } catch (e) {}
          return;
        }

        if (!APP.coupleId) {
          try { if (typeof updateSyncDot === 'function') updateSyncDot('local'); } catch (e) {}
          return;
        }

        if (typeof determineMyRole !== 'function' || typeof loadFromSupabase !== 'function') {
          return;
        }

        return determineMyRole(APP.coupleId)
          .then(function () {
            return loadFromSupabase();
          })
          .then(function (ok) {
            if (ok) {
              try { if (typeof subscribeRealtime === 'function') subscribeRealtime(); } catch (e) {}
              try { if (typeof updateSyncDot === 'function') updateSyncDot('on'); } catch (e) {}

              safeCall('LM-004', 'renderAll after sync', function () {
                if (typeof renderAll === 'function') renderAll();
              });
              safeCall('LM-009', 'renderAchievements after sync', function () {
                if (typeof renderAchievements === 'function') renderAchievements();
              });
              safeCall('LM-011', 'renderStats after sync', function () {
                if (typeof renderStats === 'function') renderStats();
              });
              safeCall('LM-012', 'renderProfile after sync', function () {
                if (typeof renderProfile === 'function') renderProfile();
              });
            } else {
              try { if (typeof updateSyncDot === 'function') updateSyncDot('off'); } catch (e) {}
            }
          })
          .catch(function (e) {
            if (typeof LM !== 'undefined') {
              LM.record('LM-017',
                (e && e.message) || 'loadFromSupabase rejected',
                (e && e.stack ? e.stack.substring(0, 300) : ''));
            }
          });
      })
      .catch(function (e) {
        try { if (typeof updateSyncDot === 'function') updateSyncDot('off'); } catch (err) {}
        if (typeof LM !== 'undefined') {
          LM.record('LM-016',
            (e && e.message) || 'initSupabaseAsync rejected',
            (e && e.stack ? e.stack.substring(0, 300) : ''));
        }
      });
  }

  /* Visibility — обновляем при возврате */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    safeCall('LM-026', 'visibilitychange', function () {
      if (typeof recalcStats === 'function') recalcStats();
      if (typeof saveState === 'function') saveState();
      if (typeof renderAll === 'function') renderAll();
      if (typeof renderAchievements === 'function') renderAchievements();
      if (typeof updateErrorLogCount === 'function') updateErrorLogCount();
    });
  });

  /* Отладка */
  try {
    window.__LOVEMETER__ = {
      APP: APP,
      CONFIG: CONFIG,
      LM: (typeof LM !== 'undefined' ? LM : null),
      getState: function () {
        try { return JSON.parse(JSON.stringify(APP.state)); }
        catch (e) { return APP.state; }
      },
      checkGlobals: checkGlobals,
      errors: function () {
        if (typeof LM === 'undefined') return 'Logger недоступен';
        return LM.toText();
      },
      dump: function () {
        if (typeof LM === 'undefined') return 'нет LM';
        try {
          localStorage.setItem('lm_error_dump', LM.toText());
          return 'OK: записано в lm_error_dump';
        } catch (e) { return 'ошибка: ' + e.message; }
      },
      reset: function () {
        storageRemove(CONFIG.STORAGE.state);
        location.reload();
      }
    };
  } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    safeCall('LM-028', 'init on DOMContentLoaded', function () {
      init();
    });
  });
} else {
  safeCall('LM-028', 'init immediate', function () {
    init();
  });
}