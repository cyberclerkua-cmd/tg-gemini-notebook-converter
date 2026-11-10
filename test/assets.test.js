'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../src/i18n');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');

test('все классы разметки описаны в стилях', () => {
  const used = new Set();
  for (const match of html.matchAll(/class="([^"]+)"/g)) {
    match[1].split(/\s+/).filter(Boolean).forEach((name) => used.add(name));
  }
  const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));
  const missing = [...used].filter((name) => !defined.has(name));
  assert.deepStrictEqual(missing, [], 'классы без правил: ' + missing.join(', '));
});

test('набор ключей локализации одинаков во всех языках', () => {
  const base = Object.keys(i18n.DICTIONARIES.ru).sort();
  for (const locale of i18n.LOCALES) {
    const keys = Object.keys(i18n.DICTIONARIES[locale]).sort();
    assert.deepStrictEqual(keys, base, `набор ключей в ${locale} отличается от ru`);
  }
});

test('каждый ключ из разметки есть во всех словарях', () => {
  const used = new Set([...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((match) => match[1]));
  assert.ok(used.size > 20, 'в разметке должно быть много ключей локализации');
  for (const key of used) {
    for (const locale of i18n.LOCALES) {
      assert.ok(i18n.DICTIONARIES[locale][key] !== undefined, `${locale}: нет ключа «${key}»`);
    }
  }
});

test('все иконки, на которые ссылается разметка, есть в спрайте', () => {
  const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((match) => match[1]));
  const references = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(references.length >= 10, 'в разметке должны использоваться иконки');
  for (const reference of references) {
    assert.ok(symbols.has(reference), `в спрайте нет символа «${reference}»`);
  }
});

test('в разметке заданы обе темы и переключатели', () => {
  assert.ok(html.includes('data-theme="dark"'), 'тема задаётся атрибутом на html');
  assert.ok(html.includes('id="theme-toggle"'), 'есть кнопка переключения темы');
  assert.ok(html.includes('id="lang-toggle"'), 'есть кнопка переключения языка');
  for (const locale of i18n.LOCALES) {
    assert.ok(html.includes(`data-locale="${locale}"`), `в меню языка нет ${locale}`);
  }
  assert.ok(!html.includes('tg-history-convert.vercel.app'), 'ссылка на исходный сервис удалена');
});

test('светлая тема описана в стилях', () => {
  assert.ok(css.includes('html[data-theme="light"]'), 'нет блока светлой темы');
  const lightBlock = css.slice(css.indexOf('html[data-theme="light"]'));
  assert.ok(/--bg:\s*#/.test(lightBlock), 'светлая тема не переопределяет фон');
});

test('app.js инициализируется без ошибок', () => {
  // Минимальная заглушка DOM: проверяем, что скрипт не падает на этапе инициализации
  // (потерянная переменная или опечатка в id элемента проявляются именно здесь).
  const vm = require('node:vm');

  function fakeElement(id) {
    return {
      id,
      textContent: '',
      innerHTML: '',
      value: '50000',
      checked: true,
      disabled: false,
      options: [],
      classList: {
        toggle() {},
        add() {},
        remove() {},
        contains() { return false; }
      },
      addEventListener() {},
      setAttribute() {},
      getAttribute() { return null; },
      querySelector() { return fakeElement('nested'); },
      querySelectorAll() { return []; },
      focus() {}
    };
  }

  const sandbox = {
    console,
    Intl,
    URL,
    Blob,
    setTimeout,
    clearTimeout,
    navigator: { language: 'ru-RU' },
    document: {
      documentElement: { setAttribute() {}, getAttribute() { return null; } },
      getElementById: (id) => fakeElement(id),
      querySelectorAll: () => [],
      addEventListener() {}
    },
    window: {
      TGConverter: require('../src/core'),
      TGZip: require('../src/zip'),
      TGI18N: require('../src/i18n'),
      localStorage: { getItem: () => null, setItem() {} },
      matchMedia: () => ({ matches: false })
    }
  };
  sandbox.window.window = sandbox.window;

  const source = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  assert.doesNotThrow(() => vm.runInNewContext(source, vm.createContext(sandbox)), 'app.js падает при инициализации');
});
