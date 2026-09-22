/* ============================================================
   LOGGER — журнал ошибок с кодами
   ============================================================
   Подключается САМЫМ ПЕРВЫМ. Перехватывает все ошибки:
   - глобальные (window.onerror)
   - необработанные промисы (unhandledrejection)
   - вручную через LM.error(code, message, extra)

   Каждая ошибка получает код вида LM-001, LM-002 и т.д.
   Коды стабильные — LM-001 всегда означает одно и то же,
   вне зависимости от того, когда ошибка возникла.

   Журнал хранится в памяти текущей сессии. Показывается
   красной плашкой внизу экрана, если есть ошибки. Также
   доступен из Профиля → Журнал ошибок.
   ============================================================ */

const LM = (function () {

  /* ---------- Реестр известных ошибок ----------
     Код → что означает. Используется для расшифровки в журнале.
     Если ошибка с новым кодом — она тоже запишется, просто без описания. */
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
    'LM-028': 'Ошибка при инициализации приложения'
  };

  /* ---------- Хранилище ---------- */
  const MAX = 30;              // сколько последних ошибок держим
  const log = [];              // { code, message, extra, time, stack }
  let nextAutoCode = 100;      // для ошибок без явного кода

  /* ---------- Утилита: время ---------- */
  function timeStr() {
    const d = new Date();
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ---------- Основная функция записи ---------- */
  function record(code, message, extra) {
    /* Если код не задан — генерируем автоматический */
    if (!code || typeof code !== 'string') {
      code = 'LM-' + (nextAutoCode++);
    }

    const entry = {
      code: code,
      message: String(message || '').substring(0, 500),
      extra: extra ? String(extra).substring(0, 500) : '',
      time: timeStr(),
      stack: ''
    };

    /* Пробуем получить стектрейс */
    try {
      const err = new Error();
      entry.stack = String(err.stack || '').substring(0, 800);
    } catch (e) { /* без стека */ }

    log.push(entry);

    /* Ограничиваем размер */
    if (log.length > MAX) log.shift();

    /* Показываем баннер */
    showBanner(entry);

    /* Дублируем в консоль, если она есть */
    try {
      if (window.console && console.error) {
        console.error('[' + code + ']', message, extra || '');
      }
    } catch (e) { /* игнорируем */ }
  }

  /* ---------- Баннер с ошибкой ---------- */
  let bannerTimer = null;

  function showBanner(entry) {
    try {
      let el = document.getElementById('lmErrorBanner');

      /* Создаём баннер при первой ошибке */
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
        document.body.appendChild(el);

        el.querySelector('.lm-error-close').addEventListener('click', function (e) {
          e.stopPropagation();
          el.classList.remove('show');
        });

        el.addEventListener('click', function () {
          if (typeof window.openErrorLog === 'function') {
            window.openErrorLog();
          }
        });
      }

      const body = el.querySelector('.lm-error-body');
      const desc = CODES[entry.code] || 'Неизвестная ошибка';

      body.innerHTML =
        '<div class="lm-error-code">' + entry.code + '</div>' +
        '<div class="lm-error-desc">' + escapeText(desc) + '</div>' +
        '<div class="lm-error-msg">' + escapeText(entry.message) + '</div>';

      el.classList.add('show');

      /* Автоскрытие через 12 секунд — не навязчиво */
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(function () {
        if (el) el.classList.remove('show');
      }, 12000);
    } catch (e) { /* баннер не критичен */ }
  }

  function escapeText(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ---------- Перехват глобальных ошибок ---------- */
  window.addEventListener('error', function (e) {
    /* Отличаем ошибки загрузки ресурсов (img, script) от JS-ошибок */
    if (e.message) {
      record('LM-025', e.message, (e.filename || '') + ':' + (e.lineno || ''));
    } else if (e.target && e.target.tagName) {
      record('LM-025', 'Не загрузился ресурс: ' + e.target.tagName,
             e.target.src || e.target.href || '');
    }
  }, true);

  /* ---------- Перехват необработанных промисов ---------- */
  window.addEventListener('unhandledrejection', function (e) {
    const reason = e.reason;
    const msg = reason && reason.message
      ? reason.message
      : String(reason);
    record('LM-025', 'Unhandled promise: ' + msg);
  });

  /* ---------- Публичный API ---------- */
  function getAll() {
    return log.slice();
  }

  function clear() {
    log.length = 0;
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
    if (!log.length) return 'Журнал пуст — ошибок не было.';
    let out = 'Love Meter — журнал ошибок\n';
    out += 'Сессия: ' + new Date().toLocaleString('ru-RU') + '\n\n';
    log.forEach(function (e, i) {
      out += '#' + (i + 1) + ' [' + e.code + '] ' + e.time + '\n';
      out += '  Описание: ' + describe(e.code) + '\n';
      out += '  Сообщение: ' + e.message + '\n';
      if (e.extra) out += '  Детали: ' + e.extra + '\n';
      out += '\n';
    });
    return out;
  }

  /* ---------- Экспорт ---------- */
  return {
    record: record,
    getAll: getAll,
    clear: clear,
    hasErrors: hasErrors,
    describe: describe,
    toText: toText,
    CODES: CODES
  };

})();

/* Глобальный доступ для отладки через консоль */
window.LM = LM;