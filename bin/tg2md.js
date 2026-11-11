#!/usr/bin/env node
'use strict';
/**
 * CLI-конвертер: result.json -> .md файлы и/или ZIP-архив.
 *
 * Примеры:
 *   node bin/tg2md.js result.json
 *   node bin/tg2md.js result.json -o ./out --words 100000 --date YYYY-MM-DD
 *   node bin/tg2md.js result.json --format zip --no-reactions
 */
const fs = require('fs');
const path = require('path');
const core = require('../src/core');
const { createZip } = require('../src/zip');

const HELP = `
Telegram → Gemini Notebook (локальная версия)

Использование:
  node bin/tg2md.js <result.json> [опции]

Опции:
  -o, --out <dir>        каталог для .md файлов (по умолчанию ./output)
      --words <n>        слов в файле (по умолчанию 50000)
      --date <fmt>       DD.MM.YYYY или YYYY-MM-DD (по умолчанию DD.MM.YYYY)
      --format <fmt>     md | zip | both (по умолчанию both)
      --no-timestamp     не добавлять дату и время
      --no-author        не добавлять имя автора
      --no-reactions     не добавлять реакции
      --no-polls         не добавлять опросы
      --no-forwarded     не добавлять информацию о пересланных
      --quiet            без подробного вывода
  -h, --help             эта справка
`;

function parseArgs(argv) {
  const options = {
    input: null,
    out: 'output',
    format: 'both',
    quiet: false,
    settings: Object.assign({}, core.DEFAULT_SETTINGS)
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        console.log(HELP);
        process.exit(0);
        break;
      case '-o':
      case '--out':
        options.out = argv[++i];
        break;
      case '--words':
        options.settings.wordLimit = Number(argv[++i]);
        break;
      case '--date':
        options.settings.dateFormat = argv[++i];
        break;
      case '--format':
        options.format = argv[++i];
        break;
      case '--no-timestamp':
        options.settings.includeTimestamp = false;
        break;
      case '--no-author':
        options.settings.includeAuthor = false;
        break;
      case '--no-reactions':
        options.settings.includeReactions = false;
        break;
      case '--no-polls':
        options.settings.includePolls = false;
        break;
      case '--no-forwarded':
        options.settings.includeForwarded = false;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Неизвестный аргумент: ${arg}`);
          process.exit(2);
        }
        options.input = arg;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.input) {
    console.error('Укажите файл result.json\n');
    console.log(HELP);
    process.exit(1);
  }

  if (!Number.isFinite(options.settings.wordLimit) || options.settings.wordLimit <= 0) {
    console.error('Некорректное значение --words');
    process.exit(2);
  }

  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Файл не найден: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');

  let result;
  try {
    result = core.convert(raw, options.settings);
  } catch (error) {
    console.error(`Ошибка: ${error.message}`);
    process.exit(1);
  }

  const outDir = path.resolve(options.out);
  fs.mkdirSync(outDir, { recursive: true });

  if (options.format === 'md' || options.format === 'both') {
    for (const doc of result.documents) {
      fs.writeFileSync(path.join(outDir, doc.name), doc.content, 'utf8');
    }
  }

  let zipPath = null;
  if (options.format === 'zip' || options.format === 'both') {
    const entries = result.documents.map((doc) => ({ name: doc.name, data: doc.content }));
    const bytes = await createZip(entries);
    zipPath = path.join(outDir, `${core.sanitizeFileName(result.chatName)}.zip`);
    fs.writeFileSync(zipPath, Buffer.from(bytes));
  }

  if (options.quiet) return;

  console.log('');
  console.log(`  Чат:        ${result.chatName}`);
  console.log(`  Сообщений:  ${result.totalMessages.toLocaleString('ru-RU')} (пропущено ${result.skippedMessages.toLocaleString('ru-RU')})`);
  console.log(`  Слов:       ${result.totalWords.toLocaleString('ru-RU')}`);
  console.log(`  Файлов .md: ${result.filesCreated}`);
  if (zipPath) console.log(`  Архив:      ${zipPath}`);
  console.log(`  Папка:      ${outDir}`);
  console.log('');
}

main().catch((error) => {
  console.error(`Ошибка: ${error && error.message ? error.message : error}`);
  process.exit(1);
});
