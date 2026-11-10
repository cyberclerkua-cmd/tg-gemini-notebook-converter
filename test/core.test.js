'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/core');
const { sampleExport } = require('./helpers/fixture');

const BASE = core.DEFAULT_SETTINGS;

test('normalizeText склеивает строки, объекты и массивы', () => {
  assert.strictEqual(core.normalizeText('просто текст'), 'просто текст');
  assert.strictEqual(core.normalizeText(['a', 'b']), 'ab');
  assert.strictEqual(core.normalizeText(['a', { type: 'link', text: 'b' }]), 'ab');
  assert.strictEqual(core.normalizeText([{ text: 'x' }]), 'x');
  assert.strictEqual(core.normalizeText(undefined), '');
  assert.strictEqual(core.normalizeText(null), '');
});

test('formatMessage собирает заголовок, текст и метаданные', () => {
  const messages = core.buildMessages(sampleExport());
  const first = messages[0];
  const block = core.formatMessage(first, BASE);

  assert.ok(block.startsWith('**#1** **Алиса** '), block);
  assert.ok(block.includes('Первое сообщение'));
  assert.ok(block.endsWith('\n'));
});

test('форматы даты', () => {
  const date = new Date(2020, 1, 14, 9, 5);
  assert.strictEqual(core.formatDateTime(date, 'DD.MM.YYYY'), '14.02.2020 09:05');
  assert.strictEqual(core.formatDateTime(date, 'YYYY-MM-DD'), '2020-02-14 09:05');
});

test('опросы попадают в Markdown только при включённой опции', () => {
  const pollMessage = core.buildMessages(sampleExport()).find((m) => m.poll);
  assert.ok(pollMessage, 'в фикстуре должно быть сообщение с опросом');

  const withPolls = core.formatMessage(pollMessage, BASE);
  assert.ok(withPolls.includes('**Poll:** Что выбрать?'));
  assert.ok(withPolls.includes('• Да — 2 votes'));
  assert.ok(withPolls.includes('Total: 3 voters'));

  const withoutPolls = core.formatMessage(pollMessage, Object.assign({}, BASE, { includePolls: false }));
  assert.ok(!withoutPolls.includes('**Poll:**'));
});

test('реакции, ответы и пересланные подчиняются настройкам', () => {
  const messages = core.buildMessages(sampleExport());
  const reply = messages.find((m) => m.replyToId);
  const reactions = messages.find((m) => m.reactions);
  const forwarded = messages.find((m) => m.forwardedFrom);

  assert.ok(core.formatMessage(reply, BASE).includes('↳ reply #1'));
  assert.ok(core.formatMessage(reactions, BASE).includes('👍 4 • 🔥 1'));
  assert.ok(core.formatMessage(forwarded, BASE).includes('↳ forwarded from: Канал Новостей'));

  const bare = Object.assign({}, BASE, { includeReactions: false, includeForwarded: false });
  assert.ok(!core.formatMessage(reactions, bare).includes('👍'));
  assert.ok(!core.formatMessage(forwarded, bare).includes('forwarded from'));
});

test('имя автора и дата отключаются настройками', () => {
  const message = core.buildMessages(sampleExport())[0];
  const bare = Object.assign({}, BASE, { includeAuthor: false, includeTimestamp: false });
  const block = core.formatMessage(message, bare);
  assert.ok(block.startsWith('**#1**'));
  assert.ok(!block.includes('**Алиса**'));
  assert.ok(!block.includes('2020'));
});

test('service-сообщения и пустые сообщения пропускаются', () => {
  const data = sampleExport();
  const counts = core.countMessages(data);
  assert.strictEqual(counts.total, 7);
  assert.strictEqual(counts.skipped, 2); // service-сообщение и пустой текст

  const messages = core.buildMessages(data);
  assert.strictEqual(messages.length, 5);
  assert.ok(messages.every((m) => m.id !== 3));
});

test('экспорт только с опросом без текстовой подписи конвертируется', () => {
  const data = sampleExport();
  data.messages = data.messages.filter((message) => message.poll);
  data.messages[0].text = '';

  const result = core.convert(JSON.stringify(data));
  assert.strictEqual(result.totalMessages, 1);
  assert.strictEqual(result.skippedMessages, 0);
  assert.strictEqual(result.filesCreated, 1);
  assert.ok(result.documents[0].content.includes('**Poll:** Что выбрать?'));
});

test('опрос без текстовой подписи не увеличивает число пропущенных сообщений', () => {
  const data = sampleExport();
  data.messages.find((message) => message.poll).text = '';

  const result = core.convert(JSON.stringify(data));
  assert.strictEqual(result.totalMessages, 7);
  assert.strictEqual(result.skippedMessages, 2);
  assert.ok(result.documents[0].content.includes('**Poll:** Что выбрать?'));
});

test('безымянный автор получает значение Аноним', () => {
  const data = sampleExport();
  delete data.messages[0].from;
  const messages = core.buildMessages(data);
  assert.strictEqual(messages[0].author, 'Аноним');
});

test('разбивка по лимиту слов', () => {
  const messages = core.buildMessages(sampleExport());
  const settings = Object.assign({}, BASE, { wordLimit: 25 });
  const result = core.chunkMessages(messages, settings);

  assert.ok(result.chunks.length > 1, 'сообщения должны разделиться');

  for (const chunk of result.chunks) {
    const words = core.countWords(chunk);
    const messagesInChunk = (chunk.match(/\*\*#/g) || []).length;
    assert.ok(
      words <= settings.wordLimit || messagesInChunk === 1,
      `чанк из ${words} слов и ${messagesInChunk} сообщений нарушает лимит ${settings.wordLimit}`
    );
  }

  // Ни одно сообщение не потеряно и не продублировано.
  const joined = result.chunks.join('');
  for (const message of messages) {
    const id = `**#${message.id}**`;
    assert.strictEqual(joined.split(id).length - 1, 1, `сообщение ${message.id}`);
  }

  assert.strictEqual(
    result.totalWords,
    messages.reduce((sum, m) => sum + core.countWords(core.formatMessage(m, settings)), 0)
  );
});

test('при большом лимите всё попадает в один файл', () => {
  const messages = core.buildMessages(sampleExport());
  const result = core.chunkMessages(messages, Object.assign({}, BASE, { wordLimit: 100000 }));
  assert.strictEqual(result.chunks.length, 1);
});

test('сообщение длиннее лимита остаётся целиком в отдельном файле', () => {
  const long = 'слово '.repeat(200).trim();
  const messages = [{
    id: 1, author: 'A', date: new Date(2020, 0, 1), text: long,
    replyToId: null, reactions: null, poll: null, forwardedFrom: null
  }];
  const settings = Object.assign({}, BASE, { wordLimit: 10 });
  const result = core.chunkMessages(messages, settings);
  assert.strictEqual(result.chunks.length, 1);
  assert.ok(result.chunks[0].includes(long));
});

test('sanitizeFileName убирает недопустимые символы', () => {
  assert.strictEqual(core.sanitizeFileName('Мой чат: "X"'), 'Мой_чат_X_');
  assert.strictEqual(core.sanitizeFileName('a/b\\c|d?e*f#g'), 'a_b_c_d_e_f_g');
  assert.strictEqual(core.sanitizeFileName('x'.repeat(80)).length, 50);
});

test('convert возвращает статистику и документы с заголовками', () => {
  const result = core.convert(JSON.stringify(sampleExport()), BASE);

  assert.strictEqual(result.chatName, 'Тестовый чат');
  assert.strictEqual(result.totalMessages, 7);
  assert.strictEqual(result.skippedMessages, 2);
  assert.strictEqual(result.filesCreated, result.documents.length);
  assert.ok(result.totalWords > 0);

  const doc = result.documents[0];
  assert.strictEqual(doc.name, 'Тестовый_чат_part_001.md');
  assert.ok(doc.content.startsWith('# Тестовый чат\nЧасть 1 из 1\n\n---\n\n'));
  assert.ok(doc.content.includes('**#1** **Алиса**'));
});

test('convert корректно обрабатывает ошибки', () => {
  assert.throws(() => core.convert('{не json', BASE), /повреждён/);
  assert.throws(() => core.convert('{"foo":1}', BASE), /не похоже на экспорт/);
  assert.throws(() => core.convert('{"name":"x","messages":[]}', BASE), /не похоже на экспорт/);

  const onlyService = { name: 'Чат', messages: [{ id: 1, type: 'service', date: '2020-01-01', action: 'x' }] };
  assert.throws(() => core.convert(JSON.stringify(onlyService), BASE), /не найдено сообщений/);
});

test('ошибки convert несут машиночитаемый код для локализации', () => {
  const codes = [
    ['{не json', 'invalid_json'],
    ['{"foo":1}', 'not_telegram_export'],
    [JSON.stringify({ name: 'Чат', messages: [{ id: 1, type: 'service', date: '2020-01-01' }] }), 'no_messages']
  ];
  for (const [input, code] of codes) {
    try {
      core.convert(input, BASE);
      assert.fail('ожидалась ошибка для ' + input);
    } catch (error) {
      assert.strictEqual(error.code, code);
      assert.ok(error.message.length > 0, 'сообщение об ошибке должно остаться на русском');
    }
  }
});

test('колбэк прогресса вызывается с этапами', () => {
  const stages = [];
  core.convert(JSON.stringify(sampleExport()), BASE, (progress) => stages.push(progress.stage));
  assert.ok(stages.includes('parsing'));
  assert.ok(stages.includes('formatting'));
  assert.ok(stages.includes('chunking'));
  assert.strictEqual(stages[stages.length - 1], 'done');
});
