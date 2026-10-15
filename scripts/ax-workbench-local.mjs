import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.AX_WORKBENCH_PORT || 8787);
const baseUrl = `http://127.0.0.1:${port}`;
const pageUrl = `${baseUrl}/apps/workbench/demo/mvp.html`;
const mcpUrl = `${baseUrl}/mcp`;
const serverPath = path.join(root, "apps/workbench/mcp/server.mjs");
const workspace = path.resolve(process.env.AX_WORKBENCH_WORKSPACE || process.cwd());
const logPath = path.join(process.env.TMPDIR || "/tmp", "ax-workbench-mcp.log");
const shouldOpen = process.argv.includes("--open");

if (!fs.existsSync(serverPath)) {
  console.error(`AX Workbench server not found: ${serverPath}`);
  process.exit(1);
}

async function health() {
  try {
    const page = await fetch(pageUrl);
    if (!page.ok || !(await page.text()).includes("AX Workbench")) return false;
    const discovery = await fetch(mcpUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "server/discover", params: {} })
    });
    const payload = await discovery.json();
    return discovery.ok && Boolean(payload.result?.capabilities?.tools);
  } catch {
    return false;
  }
}

function launchDetachedServer() {
  const logFd = fs.openSync(logPath, "a");
  const child = spawn(process.execPath, [serverPath], {
    cwd: workspace,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, AX_WORKBENCH_PORT: String(port) }
  });
  fs.closeSync(logFd);
  child.unref();
  return child.pid;
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await health()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

function openBrowser() {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", pageUrl] : [pageUrl];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

const alreadyRunning = await health();
const pid = alreadyRunning ? null : launchDetachedServer();
if (!(await waitForHealth())) {
  console.error(`AX Workbench did not become healthy. See ${logPath}`);
  process.exit(1);
}

if (shouldOpen) openBrowser();
console.log(JSON.stringify({ ok: true, pageUrl, mcpUrl, workspace, reused: alreadyRunning, pid, logPath }, null, 2));
