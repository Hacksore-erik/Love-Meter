/* ============================================================
   LOGGER — журнал ошибок LM-001…LM-031
   Загружается ПЕРВЫМ. Все ошибки пишутся в память и в localStorage.
   ============================================================ */

const LM = (function () {

  const CODES = {
    'LM-001': 'Не удалось загрузить состояние из localStorage',
    'LM-002': 'Не удалось сохранить состояние в localStorage',
    'LM-003': 'Ошибка инициализации календаря',
    'LM-004': 'Ошибка первой отрисовки интерфейса',
    'LM-005': 'Ошибка навешивания обработчиков событий',
    'LM-006': 'Ошибка обновления сердца',
    'LM-007': 'Ошибка отрисовки кнопок голосования',
    'LM-008': 'Ошибка обработки голоса',
    'LM-009': 'Ошибка отрисовки достижений',
    'LM-010': 'Ошибка отрисовки календаря',
    'LM-011': 'Ошибка отрисовки графика',
    'LM-012': 'Ошибка отрисовки профиля',
    'LM-013': 'Ошибка открытия модалки',
    'LM-014': 'Ошибка экспорта PDF',
    'LM-015': 'Ошибка загрузки html2pdf',
    'LM-016': 'Ошибка подключения к Supabase',
    'LM-017': 'Ошибка загрузки данных пары с сервера',
    'LM-018': 'Ошибка отправки голоса на сервер',
    'LM-019': 'Ошибка подписки на realtime',
    'LM-020': 'Ошибка создания пары',
    'LM-021': 'Ошибка подключения к паре',
    'LM-022': 'Ошибка сохранения имён пары',
    'LM-023': 'Ошибка переключения приватности',
    'LM-024': 'Ошибка регистрации Service Worker',
    'LM-025': 'Неизвестная ошибка',
    'LM-026': 'Ошибка обновления интерфейса',
    'LM-027': 'Ошибка генерации UUID',
    'LM-028': 'Ошибка при инициализации приложения',
    'LM-029': 'Ошибка переключения таба',
    'LM-030': 'Ошибка копирования в буфер обмена',
    'LM-031': 'Не загрузился внешний ресурс'
  };

  const MAX = 30;
  const DUMP_KEY = 'lm_error_dump';
  const log = [];
  let nextAutoCode = 100;

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function timeStr() {
    try {
      const d = new Date();
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    } catch (e) { return '--:--:--'; }
  }

  function escapeText(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* Выгрузка журнала в localStorage — чтобы можно было прочитать даже при мёртвом UI */
  function dumpToStorage() {
    try {
      const txt = toText();
      localStorage.setItem(DUMP_KEY, txt);
    } catch (e) { /* игнорируем — storage может быть недоступен */ }
  }

  function record(code, message, extra) {
    try {
      if (!code || typeof code !== 'string') {
        code = 'LM-' + (nextAutoCode++);
      }

      const entry = {
        code: code,
        message: String(message || 'Без описания').substring(0, 500),
        extra: extra ? String(extra).substring(0, 500) : '',
        time: timeStr(),
        stack: ''
      };

      try {
        const err = new Error();
        entry.stack = String(err.stack || '').substring(0, 800);
      } catch (e) {}

      log.push(entry);
      if (log.length > MAX) log.shift();

      // Выгрузка в localStorage (последние 30 записей)
      dumpToStorage();

      try {
        window.dispatchEvent(new CustomEvent('lm:error', { detail: entry }));
      } catch (e) {}

      showBanner(entry);

      // В консоль — только для отладки в Safari Web Inspector
      try {
        if (window.console && console.error) {
          console.error('[' + code + ']', entry.message, extra || '');
        }
      } catch (e) {}

    } catch (e) {}
  }

  let bannerTimer = null;

  function showBanner(entry) {
    try {
      let el = document.getElementById('lmErrorBanner');

      if (!el) {
        el = document.createElement('div');
        el.id = 'lmErrorBanner';
        el.className = 'lm-error-banner';
        el.setAttribute('role', 'alert');
        el.innerHTML =
          '<div class="lm-error-head">' +
            '<span class="lm-error-title">⚠ Ошибка</span>' +
            '<button type="button" class="lm-error-close" aria-label="Закрыть">✕</button>' +
          '</div>' +
          '<div class="lm-error-body"></div>';

        if (document.body) {
          document.body.appendChild(el);
        } else {
          // body ещё нет — ждём DOMContentLoaded
          document.addEventListener('DOMContentLoaded', function () {
            try { document.body.appendChild(el); } catch (e) {}
          });
        }

        const closeBtn = el.querySelector('.lm-error-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            el.classList.remove('show');
          });
        }

        el.addEventListener('click', function () {
          if (typeof window.openErrorLog === 'function') {
            try { window.openErrorLog(); } catch (e) {}
          }
        });
      }

      const body = el.querySelector('.lm-error-body');
      if (body) {
        const desc = CODES[entry.code] || 'Неизвестная ошибка';
        body.innerHTML =
          '<div class="lm-error-code">' + escapeText(entry.code) + '</div>' +
          '<div class="lm-error-desc">' + escapeText(desc) + '</div>' +
          '<div class="lm-error-msg">' + escapeText(entry.message) + '</div>';
      }

      el.classList.add('show');

      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(function () {
        if (el) el.classList.remove('show');
      }, 12000);

    } catch (e) {}
  }

  /* Глобальный перехват ошибок */
  window.addEventListener('error', function (e) {
    try {
      if (e.message) {
        record('LM-025',
          e.message,
          (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || ''));
        return;
      }
      if (e.target && e.target.tagName) {
        const tag = e.target.tagName.toLowerCase();
        const src = e.target.src || e.target.href || '';
        record('LM-031',
          'Не загрузился ' + tag + ': ' + src.split('/').pop(),
          src);
      }
    } catch (err) {}
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    try {
      const reason = e.reason;
      let msg = 'Необработанный Promise';
      if (reason) {
        if (typeof reason === 'string') msg = reason;
        else if (reason.message) msg = reason.message;
        else msg = String(reason);
      }
      record('LM-025', msg, 'unhandledrejection');
    } catch (err) {}
  });

  function getAll() {
    return log.slice();
  }

  function clear() {
    log.length = 0;
    try { localStorage.removeItem(DUMP_KEY); } catch (e) {}
    const el = document.getElementById('lmErrorBanner');
    if (el) el.classList.remove('show');
  }

  function hasErrors() {
    return log.length > 0;
  }

  function describe(code) {
    return CODES[code] || 'Неизвестный код';
  }

  function toText() {
    if (!log.length) return 'Love Meter — журнал ошибок\n\nОшибок не было.';
    let out = 'Love Meter — журнал ошибок\n';
    out += 'Дата: ' + new Date().toLocaleString('ru-RU') + '\n';
    out += 'Всего записей: ' + log.length + '\n\n';
    for (let i = 0; i < log.length; i++) {
      const e = log[i];
      out += '#' + (i + 1) + ' [' + e.code + '] ' + e.time + '\n';
      out += '  Описание: ' + describe(e.code) + '\n';
      out += '  Сообщение: ' + e.message + '\n';
      if (e.extra) out += '  Детали: ' + e.extra + '\n';
      out += '\n';
    }
    return out;
  }

  /* Публичный API */
  return {
    record: record,
    getAll: getAll,
    clear: clear,
    hasErrors: hasErrors,
    describe: describe,
    toText: toText,
    dump: dumpToStorage,
    CODES: CODES
  };

})();

window.LM = LM;