import os
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]


def _wait_for_server(url: str) -> None:
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError(f"server did not start: {url}")


@pytest.fixture()
def workbench_server(free_tcp_port):
    port = free_tcp_port
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
        _wait_for_server(f"{base_url}/apps/workbench/demo/mvp.html")
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


@pytest.fixture()
def chromium_executable():
    configured = os.environ.get("AX_E2E_CHROME")
    candidates = [
        configured,
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
    ]
    executable = next((path for path in candidates if path and Path(path).exists()), None)
    if not executable:
        pytest.skip("E2E browser not installed; set AX_E2E_CHROME to a Chromium executable")
    return executable


def test_user_can_edit_contract_and_prepare_handoff(workbench_server, chromium_executable):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=chromium_executable)
        page = browser.new_page()
        page.goto(f"{workbench_server}/apps/workbench/demo/mvp.html")

        expect(page.locator("#mcpStatus")).to_have_text("MCP 연결됨 · 3 tools")
        page.locator("#fileInput").set_input_files({
            "name": "decisions.txt",
            "mimeType": "text/plain",
            "buffer": b"Decision: review the draft by Friday.",
        })
        page.get_by_role("textbox", name="decisions.txt 절대경로").fill("/tmp/decisions.txt")
        page.get_by_role("button", name="문제 구조화하기").click()
        expect(page.get_by_text("구조화 단계 · 직접 입력")).to_be_visible()
        expect(page.locator("#contractBadge")).to_have_text("직접 입력")
        expect(page.locator("#requestPreview")).to_contain_text("회의가 끝난 뒤 결정사항과 반복 업무")
        expect(page.locator("#referencePreview")).to_contain_text("meeting-notes.md")
        expect(page.locator("body")).not_to_contain_text("5 / 5 complete")

        goal = page.locator('textarea[aria-label="Goal"]')
        goal.fill("사용자가 직접 고친 목표")
        expect(page.locator("#handoffText")).to_contain_text("사용자가 직접 고친 목표")
        expect(page.locator("#handoffText")).to_contain_text("## Request")
        expect(page.locator("#handoffText")).to_contain_text("회의가 끝난 뒤 결정사항과 반복 업무")
        expect(page.locator("#handoffText")).to_contain_text("meeting-notes.md")
        expect(page.locator("#handoffText")).to_contain_text("Path: /tmp/decisions.txt")
        expect(page.locator("#handoffText")).to_contain_text("Decision: review the draft by Friday.")
        expect(page.locator("#handoffText")).not_to_contain_text("/work on meeting-summary")

        page.get_by_role("button", name="handoff 준비 완료").click()
        expect(page.locator("#success")).to_have_text("✓ 준비 완료")
        expect(page.locator("#handoffBadge")).to_have_text("Ready")
        browser.close()


def test_empty_contract_field_blocks_handoff(workbench_server, chromium_executable):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=chromium_executable)
        page = browser.new_page()
        page.goto(f"{workbench_server}/apps/workbench/demo/mvp.html")
        page.get_by_role("button", name="문제 구조화하기").click()

        page.locator('textarea[aria-label="Acceptance rubric"]').fill("")
        expect(page.get_by_role("button", name="handoff 준비 완료")).to_be_disabled()
        expect(page.locator("#workflowStatus")).to_have_text("필수 항목을 직접 입력하세요")
        browser.close()
