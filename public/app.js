'use strict';
/**
 * Логика локального веб-приложения: выбор файла, настройки, конвертация, выгрузка ZIP.
 * Вся обработка выполняется в браузере — на сервер ни один байт не отправляется.
 * Поддерживаются три языка (ru / en / uk) и две темы (dark / light).
 */
(function () {
  var core = window.TGConverter;
  var zip = window.TGZip;
  var i18n = window.TGI18N;

  var LOCALES = i18n.LOCALES;
  var LOCALE_NAMES = i18n.LOCALE_NAMES;
  var NUMBER_LOCALES = i18n.NUMBER_LOCALES;
  var STORAGE_LOCALE = 'tg2md.locale';
  var STORAGE_THEME = 'tg2md.theme';

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */

  var el = {
    card: document.getElementById('card'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    dropzoneIcon: document.getElementById('dropzone-icon'),
    dropzoneEmpty: document.getElementById('dropzone-empty'),
    dropzoneFile: document.getElementById('dropzone-file'),
    fileName: document.getElementById('file-name'),
    fileSize: document.getElementById('file-size'),
    errorBox: document.getElementById('error-box'),
    errorText: document.getElementById('error-text'),
    errorClose: document.getElementById('error-close'),
    wordLimit: document.getElementById('word-limit'),
    dateFormat: document.getElementById('date-format'),
    optTimestamp: document.getElementById('opt-timestamp'),
    optAuthor: document.getElementById('opt-author'),
    optReactions: document.getElementById('opt-reactions'),
    optPolls: document.getElementById('opt-polls'),
    optForwarded: document.getElementById('opt-forwarded'),
    progress: document.getElementById('progress'),
    progressMessage: document.getElementById('progress-message'),
    progressPercent: document.getElementById('progress-percent'),
    progressFill: document.getElementById('progress-fill'),
    convert: document.getElementById('convert'),
    convertIcon: document.getElementById('convert-icon'),
    result: document.getElementById('result'),
    resultChatName: document.getElementById('result-chat-name'),
    statMessages: document.getElementById('stat-messages'),
    statSkipped: document.getElementById('stat-skipped'),
    statFiles: document.getElementById('stat-files'),
    statWords: document.getElementById('stat-words'),
    downloadZip: document.getElementById('download-zip'),
    reset: document.getElementById('reset'),
    previewDetails: document.getElementById('preview-details'),
    previewText: document.getElementById('preview-text'),
    themeToggle: document.getElementById('theme-toggle'),
    langToggle: document.getElementById('lang-toggle'),
    langCode: document.getElementById('lang-code'),
    langMenu: document.getElementById('lang-menu')
  };

  var state = {
    file: null,
    status: 'idle',
    result: null,
    zipBlob: null,
    locale: 'ru',
    theme: 'dark',
    errorCode: null,
    progressStage: null
  };

  /* ------------------------------------------------------------------ */
  /* Утилиты                                                             */
  /* ------------------------------------------------------------------ */

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* приватный режим — просто не сохраняем */
    }
  }

  function t(key) {
    var dict = i18n.DICTIONARIES[state.locale] || i18n.DICTIONARIES.ru;
    return dict[key] !== undefined ? dict[key] : (i18n.DICTIONARIES.ru[key] !== undefined ? i18n.DICTIONARIES.ru[key] : key);
  }

  function formatNumber(value) {
    try {
      return new Intl.NumberFormat(NUMBER_LOCALES[state.locale] || 'ru-RU').format(value);
    } catch (error) {
      return String(value);
    }
  }

  function show(node, visible) {
    node.classList.toggle('hidden', !visible);
  }

  /* ------------------------------------------------------------------ */
  /* Локализация                                                        */
  /* ------------------------------------------------------------------ */

  function applyLocale(locale) {
    if (LOCALES.indexOf(locale) === -1) locale = 'ru';
    state.locale = locale;
    document.documentElement.setAttribute('lang', locale);

    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n');
      node.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
      var key = node.getAttribute('data-i18n-aria');
      node.setAttribute('aria-label', t(key));
    });

    // Числовые значения в выпадающем списке — в формате выбранной локали.
    Array.prototype.forEach.call(el.wordLimit.options, function (option) {
      option.textContent = formatNumber(Number(option.value));
    });

    el.langCode.textContent = LOCALE_NAMES[locale];
    document.querySelectorAll('.lang-option').forEach(function (option) {
      option.setAttribute('aria-selected', option.getAttribute('data-locale') === locale ? 'true' : 'false');
    });

    // Перерисовываем динамические подписи.
    if (state.errorCode) showError(state.errorCode);
    if (state.progressStage) setProgressStage(state.progressStage);
    if (state.status === 'processing') el.convert.querySelector('span').textContent = t('btn.converting');
    if (state.result) renderStats(state.result);

    storageSet(STORAGE_LOCALE, locale);
  }

  function detectLocale() {
    var saved = storageGet(STORAGE_LOCALE);
    if (saved && LOCALES.indexOf(saved) !== -1) return saved;
    var browser = (navigator.language || navigator.userLanguage || 'ru').toLowerCase();
    if (browser.indexOf('uk') === 0) return 'uk';
    if (browser.indexOf('en') === 0) return 'en';
    return 'ru';
  }

  /* ------------------------------------------------------------------ */
  /* Тема                                                                */
  /* ------------------------------------------------------------------ */

  function applyTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    storageSet(STORAGE_THEME, state.theme);
  }

  function detectTheme() {
    var saved = storageGet(STORAGE_THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  }

  /* ------------------------------------------------------------------ */
  /* Состояние интерфейса                                                */
  /* ------------------------------------------------------------------ */

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function readSettings() {
    return {
      wordLimit: Number(el.wordLimit.value),
      includeTimestamp: el.optTimestamp.checked,
      includeAuthor: el.optAuthor.checked,
      dateFormat: el.dateFormat.value,
      includeReactions: el.optReactions.checked,
      includePolls: el.optPolls.checked,
      includeForwarded: el.optForwarded.checked
    };
  }

  function showError(code) {
    state.errorCode = code;
    el.errorText.textContent = t('error.' + code);
    show(el.errorBox, true);
  }

  function hideError() {
    state.errorCode = null;
    show(el.errorBox, false);
  }

  function setBusy(busy) {
    el.dropzone.classList.toggle('disabled', busy);
    el.fileInput.disabled = busy;
    el.convert.disabled = busy || !state.file;
    el.wordLimit.disabled = busy;
    el.dateFormat.disabled = busy;
    [el.optTimestamp, el.optAuthor, el.optReactions, el.optPolls, el.optForwarded].forEach(function (box) {
      box.disabled = busy;
    });
  }

  function setFile(file) {
    state.file = file;
    hideError();
    if (!file) {
      show(el.dropzoneEmpty, true);
      show(el.dropzoneFile, false);
      el.dropzoneIcon.setAttribute('href', '#i-folder');
      el.convert.disabled = true;
      return;
    }
    show(el.dropzoneEmpty, false);
    show(el.dropzoneFile, true);
    el.dropzoneIcon.setAttribute('href', '#i-check');
    el.fileName.textContent = file.name;
    el.fileSize.textContent = formatSize(file.size);
    el.convert.disabled = false;
  }

  function setProgressStage(stage) {
    state.progressStage = stage;
    var key = 'progress.' + stage;
    el.progressMessage.textContent = t(key);
  }

  function setProgress(progress) {
    setProgressStage(progress.stage);
    el.progressPercent.textContent = progress.percent + '%';
    el.progressFill.style.width = progress.percent + '%';
  }

  function renderStats(result) {
    el.resultChatName.textContent = result.chatName;
    el.statMessages.textContent = formatNumber(result.totalMessages);
    el.statSkipped.textContent = formatNumber(result.skippedMessages);
    el.statFiles.textContent = formatNumber(result.filesCreated);
    el.statWords.textContent = formatNumber(result.totalWords);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function renderResult(result) {
    renderStats(result);
    var first = result.documents[0];
    el.previewText.textContent = first ? first.content.slice(0, 4000) : '';
    show(el.result, true);
    show(el.dropzone, false);
    show(el.progress, false);
    show(el.convert, false);
  }

  /* ------------------------------------------------------------------ */
  /* Действия                                                            */
  /* ------------------------------------------------------------------ */

  function convert() {
    if (!state.file || state.status === 'processing') return;

    state.status = 'processing';
    hideError();
    show(el.result, false);
    show(el.progress, true);
    setBusy(true);
    el.convert.querySelector('span').textContent = t('btn.converting');
    el.convertIcon.classList.add('spin');

    var settings = readSettings();
    var file = state.file;

    // Даём браузеру отрисовать состояние «Конвертация…» до тяжёлой работы.
    setTimeout(function () {
      file.text()
        .then(function (text) {
          var result = core.convert(text, settings, setProgress);
          var entries = result.documents.map(function (doc) {
            return { name: doc.name, data: doc.content };
          });
          return zip.createZip(entries).then(function (bytes) {
            state.result = result;
            state.zipBlob = new Blob([bytes], { type: 'application/zip' });
            state.status = 'done';
            renderResult(result);
          });
        })
        .catch(function (error) {
          state.status = 'error';
          show(el.progress, false);
          showError(error && error.code ? error.code : 'unknown');
        })
        .then(function () {
          setBusy(false);
          el.convertIcon.classList.remove('spin');
          el.convert.querySelector('span').textContent = t('btn.convert');
        });
    }, 30);
  }

  function reset() {
    state.file = null;
    state.result = null;
    state.zipBlob = null;
    state.status = 'idle';
    state.progressStage = null;
    el.fileInput.value = '';
    show(el.result, false);
    show(el.progress, false);
    show(el.dropzone, true);
    show(el.convert, true);
    setFile(null);
    hideError();
    setBusy(false);
    el.convertIcon.classList.remove('spin');
    el.convert.querySelector('span').textContent = t('btn.convert');
  }

  function openLangMenu(open) {
    show(el.langMenu, open);
    el.langToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* ------------------------------------------------------------------ */
  /* События                                                            */
  /* ------------------------------------------------------------------ */

  ['dragenter', 'dragover'].forEach(function (name) {
    el.dropzone.addEventListener(name, function (event) {
      event.preventDefault();
      if (state.status !== 'processing') el.dropzone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach(function (name) {
    el.dropzone.addEventListener(name, function (event) {
      event.preventDefault();
      el.dropzone.classList.remove('dragging');
    });
  });

  el.dropzone.addEventListener('drop', function (event) {
    if (state.status === 'processing') return;
    var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    if (!/\.json$/i.test(file.name)) {
      showError('not_json');
      return;
    }
    setFile(file);
  });

  el.fileInput.addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (file) setFile(file);
  });

  el.errorClose.addEventListener('click', hideError);
  el.convert.addEventListener('click', convert);
  el.reset.addEventListener('click', reset);

  el.downloadZip.addEventListener('click', function () {
    if (!state.zipBlob || !state.result) return;
    downloadBlob(state.zipBlob, core.sanitizeFileName(state.result.chatName) + '.zip');
  });

  el.themeToggle.addEventListener('click', function () {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
  });

  el.langToggle.addEventListener('click', function () {
    openLangMenu(el.langMenu.classList.contains('hidden'));
  });

  document.querySelectorAll('.lang-option').forEach(function (option) {
    option.addEventListener('click', function () {
      applyLocale(option.getAttribute('data-locale'));
      openLangMenu(false);
      el.langToggle.focus();
    });
  });

  document.addEventListener('click', function (event) {
    if (el.langMenu.classList.contains('hidden')) return;
    if (el.langMenu.contains(event.target) || el.langToggle.contains(event.target)) return;
    openLangMenu(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') openLangMenu(false);
  });

  /* ------------------------------------------------------------------ */
  /* Старт                                                               */
  /* ------------------------------------------------------------------ */

  applyTheme(detectTheme());
  applyLocale(detectLocale());
  el.wordLimit.value = String(core.DEFAULT_SETTINGS.wordLimit);
  el.dateFormat.value = core.DEFAULT_SETTINGS.dateFormat;
})();
