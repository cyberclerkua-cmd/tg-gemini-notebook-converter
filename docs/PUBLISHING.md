# Публикация на GitHub

## Оформление репозитория

**Название:** `tg-gemini-notebook-converter`

**Репозиторий:** https://github.com/cyberclerkua-cmd/tg-gemini-notebook-converter

**Релизы:** https://github.com/cyberclerkua-cmd/tg-gemini-notebook-converter/releases

**Description / About (английский):**

```text
Offline Telegram JSON to Markdown converter for Gemini Notebook. Browser UI, CLI, word-based splitting and ZIP export. Zero runtime dependencies.
```

**Описание на русском:**

```text
Локальный конвертер экспорта Telegram в Markdown для Gemini Notebook. Разбивка по словам, ZIP, браузерный интерфейс и CLI. Работает офлайн.
```

**Topics:**

```text
telegram notebooklm gemini markdown converter chat-export offline nodejs javascript cli zip
```

Основная страница проекта — [README.md](../README.md), английская версия — [README.en.md](../README.en.md).
Лицензия MIT уже указана в `package.json` и находится в [LICENSE](../LICENSE).

## Первая загрузка

Понадобятся Git, аккаунт GitHub и Node.js для запуска тестов.
Откройте терминал **в корне проекта**.

### 1. Проверить проект

```bash
npm test
node bin/tg2md.js examples/sample-result.json -o output
git status --short
```

`output/`, `out/`, исходные `result*.json`, архивы ZIP, `.tmp-ui-check/`, локальные настройки окружения
и установленные зависимости исключены через `.gitignore`.
Демонстрационный `examples/sample-result.json` входит в репозиторий.

### 2. Подготовить первый коммит

Если в папке ещё нет Git-репозитория, сначала выполните:

```bash
git init -b main
```

Добавьте файлы проекта и просмотрите подготовленные изменения:

```bash
git add .editorconfig .gitattributes .gitignore .github README.md README.en.md CONTRIBUTING.md LICENSE package.json server.js bin docs examples public scripts src test
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Создайте коммит:

```bash
git commit -m "Initial release: Telegram to Gemini Notebook converter"
```

### 3. Создать репозиторий на GitHub

Откройте [github.com/new](https://github.com/new), укажите название и описание выше, выберите видимость.
Создайте **пустой репозиторий**: README, `.gitignore` и LICENSE уже подготовлены локально,
поэтому добавлять их через форму GitHub не нужно.

### 4. Загрузить код

Команды для репозитория `cyberclerkua-cmd/tg-gemini-notebook-converter`:

```bash
git remote add origin https://github.com/cyberclerkua-cmd/tg-gemini-notebook-converter.git
git push -u origin main
```

Если `origin` уже настроен, проверьте его через `git remote -v` и используйте существующий адрес.
После загрузки откройте вкладку **Actions** и дождитесь результата workflow **CI**.
В блоке **About** добавьте описание и Topics.

## Первый релиз

После успешных проверок можно открыть **Releases → Draft a new release**, создать тег **`v1.0.0`**
на ветке `main` и использовать описание ниже.
GitHub автоматически предложит исходники в ZIP и TAR.GZ; отдельная сборка приложения не требуется.

**Заголовок:** `v1.0.0 — Telegram → Gemini Notebook`

```markdown
Первый публичный выпуск локального конвертера экспорта Telegram в Markdown.

- Обработка result.json в браузере или через CLI.
- Разбивка переписки по количеству слов и экспорт в ZIP.
- Настройка авторов, дат, реакций, опросов и пересланных сообщений.
- Русский, английский и украинский интерфейс, светлая и тёмная темы.
- Офлайн-работа без зависимостей для запуска.

Для запуска распакуйте исходники и откройте public/index.html либо выполните npm start
с установленным Node.js 18+ (рекомендуется 24 LTS).
```
