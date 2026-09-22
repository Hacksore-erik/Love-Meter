/* ============================================================
   APP — точка входа
   ============================================================
   Загружается последним, связывает всё вместе.

   Порядок:
   1. initCore()      — синхронно
   2. bindEvents()    — синхронно
   3. Первый рендер   — синхронно
   4. setupPWA()      — отложенно на 100 мс
   5. Supabase        — асинхронно в фоне
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

function init() {

  /* ШАГ 1. СИНХРОННАЯ ИНИЦИАЛИЗАЦИЯ */
  safeCall('LM-028', 'initCore failed', function () {
    initCore();
  });

  if (!APP.state) {
    APP.state = {
      names: CONFIG.DEFAULTS.names,
      myName: CONFIG.DEFAULTS.myName,
      partnerName: CONFIG.DEFAULTS.partnerName,
      startDate: todayStr(),
      votes: {},
      hideMyVotes: false,
      streak: 0,
      totalVotes: 0
    };
  }
  if (!APP.myId) {
    APP.myId = safeCall('LM-027', 'uuid fallback', function () {
      return uuid();
    }) || ('fallback-' + Date.now());
  }

  /* ШАГ 2. ОБРАБОТЧИКИ */
  safeCall('LM-005', 'bindEvents failed', function () {
    bindEvents();
  });

  /* ШАГ 3. ПЕРВЫЙ РЕНДЕР */
  safeCall('LM-003', 'initCalendar failed', function () {
    initCalendar();
  });

  safeCall('LM-004', 'renderAll failed', function () {
    renderAll();
  });

  safeCall('LM-009', 'renderAchievements failed', function () {
    renderAchievements();
  });

  safeCall('LM-010', 'renderCalendar failed', function () {
    renderCalendar();
  });

  safeCall('LM-011', 'renderChart failed', function () {
    renderChart();
  });

  safeCall('LM-012', 'renderProfile failed', function () {
    renderProfile();
  });

  safeCall('LM-026', 'updateSyncDot failed', function () {
    updateSyncDot(HAS_SUPABASE ? 'local' : 'local');
  });

  /* ШАГ 4. PWA */
  setTimeout(function () {
    safeCall('LM-024', 'setupPWA failed', function () {
      setupPWA();
    });
    safeCall('LM-024', 'setupInstallPrompt failed', function () {
      setupInstallPrompt();
    });
  }, 100);

  /* ШАГ 5. SUPABASE В ФОНЕ */
  if (HAS_SUPABASE) {
    initSupabaseAsync()
      .then(async function (client) {
        if (!client) {
          updateSyncDot('local');
          return;
        }

        if (APP.coupleId) {
          await determineMyRole(APP.coupleId);

          return loadFromSupabase()
            .then(function (ok) {
              if (ok) {
                subscribeRealtime();
                updateSyncDot('on');

                safeCall('LM-004', 'renderAll after sync', function () { renderAll(); });
                safeCall('LM-009', 'renderAchievements after sync', function () { renderAchievements(); });
                safeCall('LM-010', 'renderCalendar after sync', function () { renderCalendar(); });
                safeCall('LM-011', 'renderChart after sync', function () { renderChart(); });
                safeCall('LM-012', 'renderProfile after sync', function () { renderProfile(); });
              } else {
                updateSyncDot('off');
              }
            })
            .catch(function (e) {
              if (typeof LM !== 'undefined') {
                LM.record('LM-017',
                  (e && e.message) || 'loadFromSupabase rejected',
                  (e && e.stack ? e.stack.substring(0, 300) : ''));
              }
            });
        } else {
          updateSyncDot('local');
        }
      })
      .catch(function (e) {
        updateSyncDot('off');
        if (typeof LM !== 'undefined') {
          LM.record('LM-016',
            (e && e.message) || 'initSupabaseAsync rejected',
            (e && e.stack ? e.stack.substring(0, 300) : ''));
        }
      });
  }

  /* Служебное */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    safeCall('LM-026', 'visibilitychange recalc', function () {
      recalcStats();
      saveState();
      renderAll();
      renderAchievements();
      updateErrorLogCount();
    });
  });

  try {
    window.__LOVEMETER__ = {
      APP: APP,
      CONFIG: CONFIG,
      LM: (typeof LM !== 'undefined' ? LM : null),
      getState: function () {
        try { return JSON.parse(JSON.stringify(APP.state)); }
        catch (e) { return APP.state; }
      },
      reset: function () {
        storageRemove(CONFIG.STORAGE.state);
        location.reload();
      },
      errors: function () {
        if (typeof LM === 'undefined') return 'Logger недоступен';
        return LM.toText();
      }
    };
  } catch (e) { /* игнорируем */ }
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