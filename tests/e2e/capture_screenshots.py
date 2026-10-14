import os
import shutil
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


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
    base_url = f"http://127.0.0.1:{port}"

    try:
        wait_for_server(f"{base_url}/apps/workbench/demo/mvp.html")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=chrome_path())
            page = browser.new_page(viewport={"width": 1440, "height": 1100}, device_scale_factor=1)
            page.goto(f"{base_url}/apps/workbench/demo/mvp.html")
            page.screenshot(path=OUTPUT / "01-input-stage.png", full_page=True)

            page.get_by_role("button", name="문제 구조화하기").click()
            page.locator('textarea[aria-label="Goal"]').fill("사용자가 직접 수정한 회의 업무 목표")
            page.screenshot(path=OUTPUT / "02-structured-editing.png", full_page=True)

            page.get_by_role("button", name="handoff 준비 완료").click()
            page.screenshot(path=OUTPUT / "03-handoff-ready.png", full_page=True)
            browser.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


if __name__ == "__main__":
    main()
