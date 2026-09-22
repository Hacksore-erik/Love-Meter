/* ============================================================
   LOGGER — журнал ошибок с кодами
   ============================================================
   Подключается САМЫМ ПЕРВЫМ, до config.js. Перехватывает все
   ошибки и показывает их на экране через красный баннер.

   Что перехватывает:
   - глобальные JS-ошибки (window.onerror)
   - ошибки загрузки ресурсов (script, img, link)
   - необработанные промисы (unhandledrejection)
   - вручную через LM.record('LM-XXX', 'сообщение', 'детали')

   Каждая ошибка получает код вида LM-XXX. Реестр известных
   кодов — в объекте CODES ниже.

   Публичный API:
     LM.record(code, message, extra)  — записать ошибку
     LM.getAll()                      — получить все записи
     LM.clear()                       — очистить журнал
     LM.hasErrors()                   — есть ли ошибки
     LM.describe(code)                — расшифровка кода
     LM.toText()                      — журнал как текст
     LM.CODES                         — весь реестр кодов
   ============================================================ */

const LM = (function () {

  /* ==========================================================
     РЕЕСТР ИЗВЕСТНЫХ КОДОВ
     ==========================================================
     Код стабилен: LM-005 всегда означает одно и то же,
     независимо от того, когда ошибка возникла.
     ========================================================== */
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
    'LM-031': 'Не загрузился внешний ресурс (script, img, css)'
  };

  /* ==========================================================
     ХРАНИЛИЩЕ
     ==========================================================
     Держим последние MAX ошибок. Старые вытесняются.
     Хранится только в памяти — при перезагрузке страницы
     журнал обнуляется. Это сознательно: не засоряем
     localStorage и не показываем старые ошибки после фикса.
     ========================================================== */
  const MAX = 30;
  const log = [];
  let nextAutoCode = 100;

  /* ==========================================================
     УТИЛИТЫ
     ========================================================== */
  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function timeStr() {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function escapeText(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ==========================================================
     ОСНОВНАЯ ФУНКЦИЯ ЗАПИСИ
     ========================================================== */
  function record(code, message, extra) {
    try {
      /* Если код не задан или не строка — генерируем автоматический */
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

      /* Пробуем получить стектрейс для отладки */
      try {
        const err = new Error();
        entry.stack = String(err.stack || '').substring(0, 800);
      } catch (e) { /* без стека */ }

      log.push(entry);

      /* Ограничиваем размер буфера */
      if (log.length > MAX) log.shift();

      /* Уведомляем UI — чтобы обновить счётчик в профиле */
      try {
        window.dispatchEvent(new CustomEvent('lm:error', { detail: entry }));
      } catch (e) { /* игнорируем */ }

      /* Показываем баннер */
      showBanner(entry);

      /* Дублируем в консоль, если есть */
      try {
        if (window.console && console.error) {
          console.error('[' + code + ']', entry.message, extra || '');
        }
      } catch (e) { /* игнорируем */ }

    } catch (e) { /* последний рубеж — не роняем приложение */ }
  }

  /* ==========================================================
     БАННЕР — плавающая красная плашка внизу экрана
     ========================================================== */
  let bannerTimer = null;

  function showBanner(entry) {
    try {
      let el = document.getElementById('lmErrorBanner');

      /* Создаём баннер при первой ошибке */
      if (!el) {
        elName = document.createElement('div');
        el =.id = 'lmErrorBanner';
        el.class 'lm-error-banner';
        el.setAttribute('role', 'alert');
        el.innerHTML =
          '<div class="lm-error-head">' +
            '<span class="lm-error-title">⚠ Ошибка</span>' +
            '<button type="button" class="lm-error-close" aria-label="Закрыть">✕</button>' +
          '</div>' +
          '<div class="lm-error-body"></div>';

        document.body.appendChild(el);

        /* Кнопка закрытия — не всплываем на клик по баннеру */
        const closeBtn = el.querySelector('.lm-error-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            el.classList.remove('show');
          });
        }

        /* Клик по баннеру — открываем модалку журнала */
        el.addEventListener('click', function () {
          if (typeof window.openErrorLog === 'function') {
            try { window.openErrorLog(); } catch (e) { /* игнорируем */ }
          }
        });
      }

      /* Обновляем содержимое */
      const body = el.querySelector('.lm-error-body');
      if (body) {
        const desc = CODES[entry.code] || 'Неизвестная ошибка';
        body.innerHTML =
          '<div class="lm-error-code">' + escapeText(entry.code) + '</div>' +
          '<div class="lm-error-desc">' + escapeText(desc) + '</div>' +
          '<div class="lm-error-msg">' + escapeText(entry.message) + '</div>';
      }

      el.classList.add('show');

      /* Автоскрытие через 12 секунд */
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(function () {
        if (el) el.classList.remove('show');
      }, 12000);

    } catch (e) { /* баннер не критичен */ }
  }

  /* ==========================================================
     ПЕРЕХВАТ ГЛОБАЛЬНЫХ ОШИБОК
     ========================================================== */
  window.addEventListener('error', function (e) {
    try {
      /* JS-ошибка: есть message и lineno */
      if (e.message) {
        record('LM-025',
          e.message,
          (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || ''));
        return;
      }

      /* Ошибка загрузки ресурса: e.target — это тег script/img/link */
      if (e.target && e.target.tagName) {
        const tag = e.target.tagName.toLowerCase();
        const src = e.target.src || e.target.href || '';
        record('LM-031',
          'Не загрузился ' + tag + ': ' + src.split('/').pop(),
          src);
      }
    } catch (err) { /* игнорируем */ }
  }, true);

  /* ==========================================================
     ПЕРЕХВАТ НЕОБРАБОТАННЫХ ПРОМИСОВ
     ========================================================== */
  window.addEventListener('unhandledrejection', function (e) {
    try {
      const reason = e.reason;
      let msg = 'Необработанный Promise';

      if (reason) {
        if (typeof reason === 'string') msg = reason;
        else if (reason.message) msg = reason.message;
        else msg = String(reason);
      }

      record('LM-025', msg);
    } catch (err) { /* игнорируем */ }
  });

  /* ==========================================================
     ПУБЛИЧНЫЙ API
     ========================================================== */
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
    if (!log.length) {
      return 'Love Meter — журнал ошибок\n\nОшибок не было.';
    }

    let out = 'Love Meter — журнал ошибок\n';
    out += 'Дата: ' + new Date().toLocaleString('ru-RU') + '\n';
    out += 'Всего записей: ' + log.length + '\n';
    out += '\n';

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

  /* ==========================================================
     ЭКСПОРТ
     ========================================================== */
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

/* ============================================================
   ГЛОБАЛЬНЫЙ ДОСТУП
   ============================================================
   LM доступен из консоли и из других файлов.
   Например, для отладки на iPhone через Safari Web Inspector:
     LM.getAll()          — все ошибки
     LM.toText()          — журнал как текст
     LM.CODES['LM-005']   — расшифровка кода
   ============================================================ */
window.LM = LM;