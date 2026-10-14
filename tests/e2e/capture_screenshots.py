import os
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "apps/workbench/demo/screenshots"


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for_server(url):
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError(f"server did not start: {url}")


def chrome_path():
    configured = os.environ.get("AX_E2E_CHROME")
    candidates = [
        configured,
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    raise RuntimeError("Chromium executable not found; set AX_E2E_CHROME")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for screenshot in OUTPUT.glob("*.png"):
        screenshot.unlink()
    port = free_port()
    env = os.environ.copy()
    env["AX_WORKBENCH_PORT"] = str(port)
    process = subprocess.Popen(
        ["node", "apps/workbench/mcp/server.mjs"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    reference_dir = Path(tempfile.mkdtemp(prefix="ax-workbench-capture-"))
    reference_path = reference_dir / "decisions.html"
    reference_path.write_text("<h1>Decision notes</h1><p>Review the draft by Friday.</p>", encoding="utf-8")
    base_url = f"http://127.0.0.1:{port}"

    try:
        wait_for_server(f"{base_url}/apps/workbench/demo/mvp.html")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=chrome_path())
            page = browser.new_page(viewport={"width": 1440, "height": 1100}, device_scale_factor=1)
            page.goto(f"{base_url}/apps/workbench/demo/mvp.html")
            expect(page.locator("#mcpStatus")).to_have_text("MCP 연결됨 · 4 tools")
            page.locator('[data-remove="meeting-notes.md"]').click()
            page.locator('[data-remove="slack-thread.txt"]').click()
            page.locator("#fileInput").set_input_files([
                {
                    "name": "decisions.html",
                    "mimeType": "text/html",
                    "buffer": b"<h1>Decision notes</h1><p>Review the draft by Friday.</p>",
                },
                {
                    "name": "settings.yaml",
                    "mimeType": "application/yaml",
                    "buffer": b"title: Meeting automation\nowners:\n  - Mina",
                },
            ])
            page.get_by_role("textbox", name="decisions.html 절대경로").fill(str(reference_path))
            expect(page.locator("#fileList .reference-item")).to_have_count(2)
            page.screenshot(path=OUTPUT / "01-input-and-references.png", full_page=True)

            page.get_by_role("button", name="문제 구조화하기").click()
            page.get_by_role("textbox", name="Markdown 참고자료 · decisions.html").wait_for()
            expect(page.get_by_role("textbox", name="Markdown 참고자료 · decisions.html")).to_have_value("# Decision notes\n\nReview the draft by Friday.")
            yaml_fence = chr(96) * 3
            expect(page.get_by_role("textbox", name="Markdown 참고자료 · settings.yaml")).to_have_value(f"{yaml_fence}yaml\ntitle: Meeting automation\nowners:\n  - Mina\n{yaml_fence}")
            page.get_by_role("textbox", name="Markdown 참고자료 · decisions.html").fill("# Decision notes\n\n- 사람이 직접 수정한 검토 항목\n- 금요일까지 확인")
            page.locator('textarea[aria-label="Goal"]').fill("사람이 직접 수정한 회의 자동화 목표")
            page.screenshot(path=OUTPUT / "02-markdown-editing.png", full_page=True)
            page.get_by_role("button", name="초안 저장").click()
            page.get_by_role("button", name="저장된 Draft").click()
            page.get_by_role("button", name="＋ 새 Draft").click()
            page.locator("#request").fill("두 번째 회의 자동화 Draft를 별도로 관리합니다.")
            page.get_by_role("button", name="초안 저장").click()
            page.get_by_role("button", name="저장된 Draft").click()
            expect(page.locator("#draftList .draft-item")).to_have_count(2)
            page.screenshot(path=OUTPUT / "03-saved-drafts.png", full_page=True)
            page.locator("#draftList .draft-item").last.get_by_role("button", name="열기").click()

            page.get_by_role("button", name="handoff 준비 완료").click()
            page.screenshot(path=OUTPUT / "04-handoff-ready.png", full_page=True)
            browser.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        shutil.rmtree(reference_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
