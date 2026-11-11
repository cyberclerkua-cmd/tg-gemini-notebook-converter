'use strict';
/**
 * Ядро конвертера: экспорт Telegram (result.json) -> Markdown-файлы для Google Gemini Notebook.
 *
 * Модуль изоморфен: работает в Node (require) и в браузере (window.TGConverter).
 * Никаких зависимостей, никаких сетевых запросов — вся обработка локальная.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TGConverter = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DEFAULT_SETTINGS = {
    wordLimit: 50000,
    includeTimestamp: true,
    includeAuthor: true,
    dateFormat: 'DD.MM.YYYY',
    includeReactions: true,
    includePolls: true,
    includeForwarded: true
  };

  /**
   * Текст в экспорте Telegram бывает строкой либо массивом строк/объектов ({type,text}).
   * Приводим всё к одной строке.
   */
  function normalizeText(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .map(function (item) {
          if (typeof item === 'string') return item;
          if (item && typeof item.text === 'string') return item.text;
          return '';
        })
        .join('');
    }
    return '';
  }

  /** Дата в выбранном формате + время HH:MM (локальная таймзона машины). */
  function formatDateTime(date, dateFormat) {
    var day = String(date.getDate()).padStart(2, '0');
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var year = date.getFullYear();
    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');
    var formattedDate = dateFormat === 'YYYY-MM-DD'
      ? year + '-' + month + '-' + day
      : day + '.' + month + '.' + year;
    return formattedDate + ' ' + hours + ':' + minutes;
  }

  /** Блок опроса: вопрос, варианты, общее число голосов. */
  function formatPoll(poll) {
    var lines = [];
    lines.push('**Poll:** ' + poll.question);
    if (Array.isArray(poll.answers)) {
      poll.answers.forEach(function (answer) {
        lines.push('• ' + answer.text + ' — ' + answer.voters + ' votes');
      });
    }
    lines.push('Total: ' + poll.total_voters + ' voters');
    return lines.join('\n');
  }

  /** Одно сообщение в Markdown. */
  function formatMessage(message, settings) {
    var header = [];
    header.push('**#' + message.id + '**');
    if (settings.includeAuthor) header.push('**' + message.author + '**');
    if (settings.includeTimestamp) header.push(formatDateTime(message.date, settings.dateFormat));

    var parts = [];
    parts.push(header.join(' '));
    if (message.replyToId) parts.push('↳ reply #' + message.replyToId);
    if (settings.includeForwarded && message.forwardedFrom) {
      parts.push('↳ forwarded from: ' + message.forwardedFrom);
    }
    if (message.text) parts.push(message.text);
    if (settings.includePolls && message.poll) parts.push(formatPoll(message.poll));
    if (settings.includeReactions && message.reactions && message.reactions.length > 0) {
      parts.push(message.reactions.map(function (reaction) {
        return reaction.emoji + ' ' + reaction.count;
      }).join(' • '));
    }
    return parts.join('\n') + '\n';
  }

  /** Сколько всего записей в выгрузке и сколько из них пропущено (сервисные/пустые). */
  function countMessages(data) {
    var skipped = 0;
    for (var i = 0; i < data.messages.length; i++) {
      var raw = data.messages[i];
      if (raw.type === 'message') {
        if (!normalizeText(raw.text).trim() && !raw.poll) skipped++;
      } else {
        skipped++;
      }
    }
    return { total: data.messages.length, skipped: skipped };
  }

  /** Отбор сообщений, которые попадут в Markdown. */
  function buildMessages(data) {
    var messages = [];
    for (var i = 0; i < data.messages.length; i++) {
      var raw = data.messages[i];
      if (raw.type !== 'message') continue;
      var text = normalizeText(raw.text).trim();
      if (!text && !raw.poll) continue;
      messages.push({
        id: raw.id,
        author: raw.from || 'Аноним',
        date: new Date(raw.date),
        text: text,
        replyToId: raw.reply_to_message_id,
        reactions: raw.reactions,
        poll: raw.poll,
        forwardedFrom: raw.forwarded_from
      });
    }
    return messages;
  }

  /** Количество слов в готовом блоке сообщения. */
  function countWords(text) {
    return text.split(/\s+/).filter(function (word) {
      return word.length > 0;
    }).length;
  }

  /**
   * Разбивка на части по лимиту слов.
   * Сообщение длиннее лимита уходит в отдельный файл целиком.
   */
  function chunkMessages(messages, settings) {
    var chunks = [];
    var current = '';
    var currentWords = 0;
    var totalWords = 0;

    for (var i = 0; i < messages.length; i++) {
      var block = formatMessage(messages[i], settings);
      var words = countWords(block);
      totalWords += words;

      if (words > settings.wordLimit) {
        if (current) {
          chunks.push(current);
          current = '';
          currentWords = 0;
        }
        chunks.push(block + '\n');
        continue;
      }
      if (currentWords + words > settings.wordLimit && current) {
        chunks.push(current);
        current = '';
        currentWords = 0;
      }
      current += block + '\n';
      currentWords += words;
    }
    if (current) chunks.push(current);
    return { chunks: chunks, totalWords: totalWords };
  }

  /** Имя файла без запрещённых символов (как у Telegram/Windows). */
  function sanitizeFileName(name) {
    return String(name)
      .replace(/[<>:"/\\|?*#]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
  }

  /** Готовые .md-документы с заголовками и нумерацией частей. */
  function buildDocuments(chunks, chatName) {
    var total = chunks.length;
    return chunks.map(function (chunk, index) {
      var header = '# ' + chatName + '\n' +
        'Часть ' + (index + 1) + ' из ' + total + '\n\n' +
        '---\n\n';
      return {
        name: sanitizeFileName(chatName) + '_part_' + String(index + 1).padStart(3, '0') + '.md',
        content: header + chunk
      };
    });
  }

  /** Ошибка с машиночитаемым кодом: интерфейс локализует её по коду. */
  function createError(message, code) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  /**
   * Основной сценарий: текст result.json -> описание результата и список документов.
   * onProgress({stage, percent, message}) — опциональный колбэк прогресса.
   */
  function convert(rawText, settings, onProgress) {
    var options = Object.assign({}, DEFAULT_SETTINGS, settings || {});

    if (onProgress) onProgress({ stage: 'parsing', percent: 10, message: 'Разбор JSON файла...' });

    var data;
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      throw createError('Файл повреждён или имеет неверный формат JSON', 'invalid_json');
    }

    var looksLikeExport = data &&
      typeof data === 'object' &&
      typeof data.name === 'string' &&
      Array.isArray(data.messages) &&
      data.messages.length > 0;
    if (!looksLikeExport) {
      throw createError('Это не похоже на экспорт из Telegram. Убедитесь, что вы экспортировали чат через Telegram Desktop', 'not_telegram_export');
    }

    var counts = countMessages(data);
    if (counts.total === 0 || counts.total === counts.skipped) {
      throw createError('В файле не найдено сообщений', 'no_messages');
    }

    if (onProgress) onProgress({ stage: 'formatting', percent: 30, message: 'Обработка сообщений...' });
    var messages = buildMessages(data);

    if (onProgress) onProgress({ stage: 'chunking', percent: 50, message: 'Разбивка на файлы...' });
    var chunked = chunkMessages(messages, options);
    var documents = buildDocuments(chunked.chunks, data.name);

    if (onProgress) onProgress({ stage: 'done', percent: 100, message: 'Готово!' });

    return {
      chatName: data.name,
      totalMessages: counts.total,
      skippedMessages: counts.skipped,
      filesCreated: documents.length,
      totalWords: chunked.totalWords,
      documents: documents
    };
  }

  return {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    normalizeText: normalizeText,
    formatDateTime: formatDateTime,
    formatPoll: formatPoll,
    formatMessage: formatMessage,
    countMessages: countMessages,
    buildMessages: buildMessages,
    countWords: countWords,
    chunkMessages: chunkMessages,
    sanitizeFileName: sanitizeFileName,
    buildDocuments: buildDocuments,
    convert: convert
  };
});
