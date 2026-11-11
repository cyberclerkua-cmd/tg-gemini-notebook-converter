import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile
from contextlib import contextmanager
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("UI_PORT", "5177"))
BASE = f"http://127.0.0.1:{PORT}/"
SAMPLE = str(ROOT / "examples" / "sample-result.json")
OUT = Path(os.environ.get("UI_OUTPUT_DIR", str(ROOT / ".tmp-ui-check"))).resolve()
CHROME = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
os.makedirs(OUT, exist_ok=True)

errors = []
checks = []


@contextmanager
def local_server():
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as log:
        server = subprocess.Popen(
            [os.environ.get("NODE_BINARY", "node"), str(ROOT / "server.js"),
             "--port", str(PORT), "--host", "127.0.0.1"],
            cwd=ROOT,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        try:
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                if server.poll() is not None:
                    log.seek(0)
                    raise RuntimeError("Не удалось запустить тестовый сервер:\n" + log.read())
                try:
                    with urlopen(BASE, timeout=0.5) as response:
                        if response.status == 200:
                            break
                except (URLError, TimeoutError, OSError):
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Тестовый сервер не ответил за 10 секунд")
            yield
        finally:
            if server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=5)


def watch_errors(page):
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))


def check(condition, message):
    checks.append((bool(condition), message))
    if not condition:
        raise AssertionError(message)


with local_server(), sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)

    # ---------- Русский + тёмная тема ----------
    context = browser.new_context(locale="ru-RU", color_scheme="dark", viewport={"width": 900, "height": 1150})
    context.on("page", watch_errors)
    page = context.new_page()

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1200)

    check(page.get_attribute("html", "lang") == "ru", "язык по умолчанию ru")
    check(page.get_attribute("html", "data-theme") == "dark", "тема по умолчанию тёмная")
    check(page.text_content(".settings-title span") == "Настройки", "русский заголовок настроек")
    check(page.text_content("#convert span") == "Конвертировать", "русская кнопка конвертации")

    # Иконки-кнопки — настоящие SVG
    for selector, icon_id in [
        ("#convert", "#i-zap"),
        ("#download-zip", "#i-download"),
        ("#reset", "#i-refresh"),
    ]:
        href = page.get_attribute(f"{selector} svg use", "href")
        check(href == icon_id, f"иконка {selector} -> {icon_id}, получено {href}")

    # Ссылка на исходный сервис
    footer_html = page.inner_html(".page-footer")

    page.screenshot(path=f"{OUT}/01-main-dark.png", full_page=True)

    # ---------- Светлая тема ----------
    page.click("#theme-toggle")
    page.wait_for_timeout(400)
    check(page.get_attribute("html", "data-theme") == "light", "тема переключилась на светлую")
    page.screenshot(path=f"{OUT}/02-main-light.png", full_page=True)

    # ---------- Переключение языка ----------
    page.click("#lang-toggle")
    page.wait_for_timeout(200)
    check(page.is_visible("#lang-menu"), "меню языка открылось")
    page.click('.lang-option[data-locale="en"]')
    page.wait_for_timeout(300)
    check(page.get_attribute("html", "lang") == "en", "язык переключился на en")
    check(page.text_content("#convert span") == "Convert", "английская кнопка конвертации")
    check(page.text_content(".settings-title span") == "Settings", "английский заголовок настроек")
    check(page.text_content(".stat-label") == "messages", "английская подпись статистики")
    page.screenshot(path=f"{OUT}/03-english-light.png", full_page=True)

    page.click("#lang-toggle")
    page.click('.lang-option[data-locale="uk"]')
    page.wait_for_timeout(300)
    check(page.get_attribute("html", "lang") == "uk", "язык переключился на uk")
    check(page.text_content("#convert span") == "Конвертувати", "украинская кнопка конвертации")
    check(page.text_content(".field-label") == "Слів у файлі", "украинская подпись настройки")
    page.screenshot(path=f"{OUT}/04-ukrainian-light.png", full_page=True)

    # ---------- Конвертация на украинском ----------
    page.set_input_files("#file-input", SAMPLE)
    page.click("#convert")
    page.wait_for_selector("#result:not(.hidden)", timeout=15000)
    page.wait_for_timeout(300)
    stats = {
        "chat": page.text_content("#result-chat-name"),
        "messages": page.text_content("#stat-messages"),
        "skipped": page.text_content("#stat-skipped"),
        "files": page.text_content("#stat-files"),
        "words": page.text_content("#stat-words"),
        "title": page.text_content(".result-head h2"),
    }
    print("статистика (uk):", json.dumps(stats, ensure_ascii=False))
    check(stats["title"] == "Конвертацію завершено", "украинский заголовок результата")
    check(stats["messages"] == "10" and stats["skipped"] == "2", "статистика демонстрационного экспорта")
    check(stats["files"] == "1", "создан один Markdown-файл")
    page.screenshot(path=f"{OUT}/05-result-uk-light.png", full_page=True)

    with page.expect_download(timeout=10000) as dl:
        page.click("#download-zip")
    download = dl.value
    zip_path = f"{OUT}/{download.suggested_filename}"
    download.save_as(zip_path)
    print("скачан файл:", download.suggested_filename, os.path.getsize(zip_path), "байт")
    with zipfile.ZipFile(zip_path) as archive:
        check(archive.testzip() is None, "ZIP читается стандартной библиотекой Python без ошибок CRC")
        check(archive.namelist() == ["Пример_чата_part_001.md"], "имя Markdown-файла в архиве")
        content = archive.read(archive.namelist()[0]).decode("utf-8")
        check(content.startswith("# Пример чата\nЧасть 1 из 1\n"), "содержимое скачанного Markdown")

    # ---------- Ошибка локализована ----------
    page.click("#reset")
    page.wait_for_timeout(200)
    bad = f"{OUT}/bad.json"
    with open(bad, "w", encoding="utf-8") as fh:
        fh.write('{"foo": 1}')
    page.set_input_files("#file-input", bad)
    page.click("#convert")
    page.wait_for_selector("#error-box:not(.hidden)", timeout=8000)
    error_text = page.text_content("#error-text")
    print("текст ошибки (uk):", error_text)
    check("Telegram Desktop" in error_text, "ошибка переведена на украинский")
    page.screenshot(path=f"{OUT}/06-error-uk-light.png", full_page=True)

    context.close()

    # ---------- Автоопределение языка ----------
    context = browser.new_context(locale="uk-UA")
    context.on("page", watch_errors)
    page = context.new_page()
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    check(page.get_attribute("html", "lang") == "uk", "язык определён по браузеру (uk)")
    context.close()

    # ---------- Светлая тема по умолчанию ----------
    context = browser.new_context(locale="en-US", color_scheme="light")
    context.on("page", watch_errors)
    page = context.new_page()
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    check(page.get_attribute("html", "data-theme") == "light", "тема определена по системной (light)")
    check(page.get_attribute("html", "lang") == "en", "язык определён по браузеру (en)")
    context.close()

    # ---------- Офлайн-запуск напрямую из файла ----------
    context = browser.new_context(locale="en-US", offline=True)
    context.on("page", watch_errors)
    page = context.new_page()
    page.goto((ROOT / "public" / "index.html").as_uri(), wait_until="load")
    page.set_input_files("#file-input", SAMPLE)
    page.click("#convert")
    page.wait_for_selector("#result:not(.hidden)", timeout=15000)
    check(page.text_content("#stat-files") == "1", "конвертация работает по file:// без сети")
    context.close()

    browser.close()

failed = [message for ok, message in checks if not ok]
print(f"проверок: {len(checks)}, провалено: {len(failed)}")
for message in failed:
    print("  ПРОВАЛ:", message)
if errors:
    print("ОШИБКИ В КОНСОЛИ:", errors)
    sys.exit(1)
if failed:
    sys.exit(1)
print("UI-проверка пройдена без ошибок в консоли")
