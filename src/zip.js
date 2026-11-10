'use strict';
/**
 * Минимальный ZIP-писатель без внешних зависимостей.
 *
 * Поддерживает метод STORE (без сжатия) и DEFLATE. В Node используется zlib,
 * в браузере — CompressionStream('deflate-raw'); если сжатие недоступно,
 * архив автоматически собирается методом STORE.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TGZip = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function encodeText(text) {
    return new TextEncoder().encode(text);
  }

  function concat(parts) {
    var total = 0;
    for (var i = 0; i < parts.length; i++) total += parts[i].length;
    var out = new Uint8Array(total);
    var offset = 0;
    for (var j = 0; j < parts.length; j++) {
      out.set(parts[j], offset);
      offset += parts[j].length;
    }
    return out;
  }

  function u16(value) {
    return new Uint8Array([value & 0xFF, (value >>> 8) & 0xFF]);
  }

  function u32(value) {
    return new Uint8Array([
      value & 0xFF,
      (value >>> 8) & 0xFF,
      (value >>> 16) & 0xFF,
      (value >>> 24) & 0xFF
    ]);
  }

  /** Время и дата в формате MS-DOS (точность до 2 секунд). */
  function dosDateTime(date) {
    var year = Math.max(1980, date.getFullYear());
    var time = ((date.getHours() & 0x1F) << 11) |
      ((date.getMinutes() & 0x3F) << 5) |
      ((Math.floor(date.getSeconds() / 2)) & 0x1F);
    var day = (((year - 1980) & 0x7F) << 9) |
      (((date.getMonth() + 1) & 0x0F) << 5) |
      (date.getDate() & 0x1F);
    return { time: time, date: day };
  }

  function nodeZlib() {
    if (typeof process !== 'undefined' && process.versions && process.versions.node && typeof require === 'function') {
      try {
        return require('zlib');
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  /** deflate-raw. Возвращает null, если сжатие недоступно. */
  async function deflateRaw(bytes) {
    var zlib = nodeZlib();
    if (zlib) {
      return new Uint8Array(zlib.deflateRawSync(bytes, { level: 6 }));
    }
    if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return null;
    try {
      var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      var buffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(buffer);
    } catch (error) {
      return null;
    }
  }

  /**
   * Собирает ZIP-архив.
   * entries: [{ name: 'file.md', data: Uint8Array | string }]
   * Возвращает Promise<Uint8Array>.
   */
  async function createZip(entries, options) {
    var opts = options || {};
    var timestamp = opts.date instanceof Date ? opts.date : new Date();
    var stamp = dosDateTime(timestamp);
    var allowDeflate = opts.deflate !== false;

    var localParts = [];
    var centralParts = [];
    var offset = 0;

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var nameBytes = encodeText(entry.name);
      var data = typeof entry.data === 'string' ? encodeText(entry.data) : entry.data;
      var checksum = crc32(data);

      var compressed = allowDeflate ? await deflateRaw(data) : null;
      var method = compressed ? 8 : 0;
      var payload = compressed || data;

      // Бит 11 — имя файла в UTF-8.
      var flags = 0x0800;

      var localHeader = concat([
        u32(0x04034B50),
        u16(20),          // version needed
        u16(flags),
        u16(method),
        u16(stamp.time),
        u16(stamp.date),
        u32(checksum),
        u32(payload.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0),           // extra length
        nameBytes
      ]);
      localParts.push(localHeader, payload);

      centralParts.push(concat([
        u32(0x02014B50),
        u16(20),          // version made by
        u16(20),          // version needed
        u16(flags),
        u16(method),
        u16(stamp.time),
        u16(stamp.date),
        u32(checksum),
        u32(payload.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0),           // extra length
        u16(0),           // comment length
        u16(0),           // disk number start
        u16(0),           // internal attributes
        u32(0),           // external attributes
        u32(offset),      // relative offset of local header
        nameBytes
      ]));

      offset += localHeader.length + payload.length;
    }

    var centralDirectory = concat(centralParts);
    var endRecord = concat([
      u32(0x06054B50),
      u16(0),            // number of this disk
      u16(0),            // disk with central directory
      u16(entries.length),
      u16(entries.length),
      u32(centralDirectory.length),
      u32(offset),
      u16(0)             // comment length
    ]);

    return concat(localParts.concat([centralDirectory, endRecord]));
  }

  return {
    crc32: crc32,
    dosDateTime: dosDateTime,
    createZip: createZip
  };
});
