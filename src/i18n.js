'use strict';
/**
 * Словари локализации интерфейса: русский, английский, украинский.
 * Модуль изоморфен: работает в Node (require) и в браузере (window.TGI18N).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TGI18N = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DICTIONARIES = {
    ru: {
      'badge.text': 'Локальная обработка без интернета',
      'subtitle.before': 'Конвертируйте экспорт чата в',
      'subtitle.after': 'файлы для Google Gemini Notebook',
      'theme.aria': 'Сменить тему',
      'lang.aria': 'Сменить язык',
      'file.aria': 'Выберите файл result.json',
      'drop.hint.before': 'Перетащите',
      'drop.hint.after': 'сюда',
      'drop.hintSub': 'или нажмите для выбора файла',
      'drop.source': 'Telegram Desktop → Экспорт чата → JSON',
      'settings.title': 'Настройки',
      'settings.words': 'Слов в файле',
      'settings.dateFormat': 'Формат даты',
      'opt.timestamp': 'Дата и время',
      'opt.author': 'Имя автора',
      'opt.reactions': 'Реакции',
      'opt.polls': 'Опросы',
      'opt.forwarded': 'Пересланные',
      'btn.convert': 'Конвертировать',
      'btn.converting': 'Конвертация…',
      'btn.download': 'Скачать ZIP',
      'btn.reset': 'Ещё файл',
      'result.title': 'Конвертация завершена',
      'result.preview': 'Превью первого файла',
      'stat.messages': 'сообщений',
      'stat.skipped': 'пропущено',
      'stat.files': 'файлов .md',
      'stat.words': 'слов',
      'progress.idle': 'Обработка…',
      'progress.parsing': 'Разбор JSON файла…',
      'progress.formatting': 'Обработка сообщений…',
      'progress.chunking': 'Разбивка на файлы…',
      'progress.done': 'Готово!',
      'footer.privacy': 'Все данные обрабатываются локально — файл никуда не отправляется',
      'error.close': 'Закрыть сообщение',
      'error.invalid_json': 'Файл повреждён или имеет неверный формат JSON',
      'error.not_telegram_export': 'Это не похоже на экспорт из Telegram. Убедитесь, что вы экспортировали чат через Telegram Desktop',
      'error.no_messages': 'В файле не найдено сообщений',
      'error.not_json': 'Нужен файл result.json из экспорта Telegram (формат .json)',
      'error.unknown': 'Произошла неизвестная ошибка'
    },
    en: {
      'badge.text': 'Local processing without internet',
      'subtitle.before': 'Convert a chat export into',
      'subtitle.after': 'files for Google Gemini Notebook',
      'theme.aria': 'Switch theme',
      'lang.aria': 'Switch language',
      'file.aria': 'Choose the result.json file',
      'drop.hint.before': 'Drop',
      'drop.hint.after': 'here',
      'drop.hintSub': 'or click to choose a file',
      'drop.source': 'Telegram Desktop → Export chat → JSON',
      'settings.title': 'Settings',
      'settings.words': 'Words per file',
      'settings.dateFormat': 'Date format',
      'opt.timestamp': 'Date and time',
      'opt.author': 'Author name',
      'opt.reactions': 'Reactions',
      'opt.polls': 'Polls',
      'opt.forwarded': 'Forwarded messages',
      'btn.convert': 'Convert',
      'btn.converting': 'Converting…',
      'btn.download': 'Download ZIP',
      'btn.reset': 'Another file',
      'result.title': 'Conversion complete',
      'result.preview': 'Preview of the first file',
      'stat.messages': 'messages',
      'stat.skipped': 'skipped',
      'stat.files': '.md files',
      'stat.words': 'words',
      'progress.idle': 'Processing…',
      'progress.parsing': 'Parsing JSON file…',
      'progress.formatting': 'Processing messages…',
      'progress.chunking': 'Splitting into files…',
      'progress.done': 'Done!',
      'footer.privacy': 'All data is processed locally — the file never leaves your device',
      'error.close': 'Dismiss message',
      'error.invalid_json': 'The file is corrupted or is not valid JSON',
      'error.not_telegram_export': 'This does not look like a Telegram export. Make sure the chat was exported with Telegram Desktop',
      'error.no_messages': 'No messages found in the file',
      'error.not_json': 'A result.json file from a Telegram export is required (.json)',
      'error.unknown': 'An unknown error occurred'
    },
    uk: {
      'badge.text': 'Локальна обробка без інтернету',
      'subtitle.before': 'Конвертуйте експорт чату у',
      'subtitle.after': 'файли для Google Gemini Notebook',
      'theme.aria': 'Змінити тему',
      'lang.aria': 'Змінити мову',
      'file.aria': 'Оберіть файл result.json',
      'drop.hint.before': 'Перетягніть',
      'drop.hint.after': 'сюди',
      'drop.hintSub': 'або натисніть, щоб обрати файл',
      'drop.source': 'Telegram Desktop → Експорт чату → JSON',
      'settings.title': 'Налаштування',
      'settings.words': 'Слів у файлі',
      'settings.dateFormat': 'Формат дати',
      'opt.timestamp': 'Дата і час',
      'opt.author': 'Ім’я автора',
      'opt.reactions': 'Реакції',
      'opt.polls': 'Опитування',
      'opt.forwarded': 'Переслані',
      'btn.convert': 'Конвертувати',
      'btn.converting': 'Конвертація…',
      'btn.download': 'Завантажити ZIP',
      'btn.reset': 'Ще файл',
      'result.title': 'Конвертацію завершено',
      'result.preview': 'Попередній перегляд першого файлу',
      'stat.messages': 'повідомлень',
      'stat.skipped': 'пропущено',
      'stat.files': 'файлів .md',
      'stat.words': 'слів',
      'progress.idle': 'Обробка…',
      'progress.parsing': 'Розбір JSON файлу…',
      'progress.formatting': 'Обробка повідомлень…',
      'progress.chunking': 'Розбивка на файли…',
      'progress.done': 'Готово!',
      'footer.privacy': 'Усі дані обробляються локально — файл нікуди не надсилається',
      'error.close': 'Закрити повідомлення',
      'error.invalid_json': 'Файл пошкоджено або він має неправильний формат JSON',
      'error.not_telegram_export': 'Це не схоже на експорт із Telegram. Переконайтеся, що чат експортовано через Telegram Desktop',
      'error.no_messages': 'У файлі не знайдено повідомлень',
      'error.not_json': 'Потрібен файл result.json з експорту Telegram (формат .json)',
      'error.unknown': 'Сталася невідома помилка'
    }
  };

  var LOCALES = ['ru', 'en', 'uk'];
  var LOCALE_NAMES = { ru: 'RU', en: 'EN', uk: 'UA' };
  var NUMBER_LOCALES = { ru: 'ru-RU', en: 'en-US', uk: 'uk-UA' };

  return {
    DICTIONARIES: DICTIONARIES,
    LOCALES: LOCALES,
    LOCALE_NAMES: LOCALE_NAMES,
    NUMBER_LOCALES: NUMBER_LOCALES
  };
});
