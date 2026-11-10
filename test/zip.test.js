'use strict';
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const { createZip, crc32 } = require('../src/zip');

/** Минимальный ридер ZIP, чтобы проверить, что архив читается сторонними инструментами. */
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  assert.ok(eocd >= 0, 'не найдена запись End of Central Directory');

  const total = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const entries = [];

  let pointer = cdOffset;
  for (let i = 0; i < total; i++) {
    assert.strictEqual(view.getUint32(pointer, true), 0x02014b50, 'нет сигнатуры central directory');
    const method = view.getUint16(pointer + 10, true);
    const crc = view.getUint32(pointer + 16, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const uncompressedSize = view.getUint32(pointer + 24, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    const content = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw);

    assert.strictEqual(content.length, uncompressedSize, `размер ${name} не совпадает`);
    assert.strictEqual(crc32(content), crc, `CRC ${name} не совпадает`);

    entries.push({ name, content: content.toString('utf8'), method });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

test('crc32 считается по стандарту', () => {
  assert.strictEqual(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('createZip собирает читаемый архив', async () => {
  const files = [
    { name: 'chat_part_001.md', data: '# Тест\n\n**#1** Алиса\n\nПривет, мир!\n' },
    { name: 'chat_part_002.md', data: '# Тест\n\nВторая часть '.repeat(500) }
  ];
  const bytes = await createZip(files);
  const entries = readZip(bytes);

  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].name, 'chat_part_001.md');
  assert.strictEqual(entries[0].content, files[0].data);
  assert.strictEqual(entries[1].content, files[1].data);
  assert.strictEqual(entries[0].method, 8, 'ожидается сжатие deflate');
});

test('createZip поддерживает STORE и кириллические имена', async () => {
  const bytes = await createZip([{ name: 'Мой чат.md', data: 'данные' }], { deflate: false });
  const entries = readZip(bytes);
  assert.strictEqual(entries[0].method, 0);
  assert.strictEqual(entries[0].name, 'Мой чат.md');
  assert.strictEqual(entries[0].content, 'данные');
});

test('пустой архив не падает', async () => {
  const bytes = await createZip([]);
  assert.strictEqual(readZip(bytes).length, 0);
});
