import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIELD_KEYS,
  FIELD_LABELS,
  createHandoff,
  deriveContract,
  validateContract
} from "./contract.mjs";

const PORT = Number(process.env.AX_WORKBENCH_PORT || 8787);
const MCP_VERSION = "2026-07-28";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const referenceSchema = {
  oneOf: [
    { type: "string" },
    {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: { type: "string" }, path: { type: "string" }, content: { type: "string" } }
    }
  ]
};

const tools = [
  {
    name: "ax_structure_problem",
    description: "문제 설명과 참고자료를 AX Workbench의 5-field 계약 초안으로 구조화한다.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["request"],
      properties: {
        request: { type: "string", minLength: 15, description: "사용자가 해결하려는 문제" },
        refs: { type: "array", items: referenceSchema, description: "참고자료 이름, 경로와 내용" }
      }
    }
  },
  {
    name: "ax_validate_contract",
    description: "5-field 계약이 실행 handoff를 만들 만큼 채워졌는지 검증한다.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["contract"],
      properties: {
        contract: {
          type: "object",
          properties: Object.fromEntries(FIELD_KEYS.map((key) => [key, { type: "string" }]))
        }
      }
    }
  },
  {
    name: "ax_create_handoff",
    description: "검토된 5-field 계약을 Claude/Codex용 Markdown handoff로 만든다.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["contract"],
      properties: {
        request: { type: "string" },
        refs: { type: "array", items: referenceSchema },
        contract: {
          type: "object",
          properties: Object.fromEntries(FIELD_KEYS.map((key) => [key, { type: "string" }]))
        }
      }
    }
  }
];

function headers(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(res, status, body) {
  headers(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textResult(value, isError = false, structuredContent) {
  const result = {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }]
  };
  if (isError) result.isError = true;
  if (structuredContent !== undefined) result.structuredContent = structuredContent;
  return result;
}

function normalizeRefs(refs) {
  return Array.isArray(refs) ? refs.map((ref) => {
    if (ref && typeof ref === "object") {
      return {
        name: String(ref.name || "reference"),
        path: typeof ref.path === "string" ? ref.path : String(ref.path ?? ""),
        content: typeof ref.content === "string" ? ref.content : String(ref.content ?? "")
      };
    }
    return String(ref);
  }) : [];
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("request body too large");
  }
  return JSON.parse(body || "{}");
}

async function callTool(name, args = {}) {
  if (name === "ax_structure_problem") {
    if (typeof args.request !== "string" || args.request.trim().length < 15) {
      return textResult("request must be at least 15 characters", true);
    }
    const refs = normalizeRefs(args.refs);
    const value = { request: args.request.trim(), refs, contract: deriveContract(args.request.trim(), refs) };
    return textResult(value, false, value);
  }

  if (name === "ax_validate_contract") {
    const value = validateContract(args.contract || {});
    return textResult(value, false, value);
  }

  if (name === "ax_create_handoff") {
    const value = createHandoff({
      request: typeof args.request === "string" ? args.request : "",
      refs: normalizeRefs(args.refs),
      contract: args.contract || {}
    });
    return textResult(value, false, value);
  }

  return textResult(`unknown tool: ${name}`, true);
}

async function handleMcp(req, res) {
  let message;
  try {
    message = await readBody(req);
  } catch (error) {
    sendJson(res, 400, rpcError(null, -32700, error.message));
    return;
  }

  const { id = null, method, params = {} } = message;

  if (method === "server/discover") {
    sendJson(res, 200, rpcResult(id, {
      supportedVersions: [MCP_VERSION],
      capabilities: { tools: {} }
    }));
    return;
  }

  if (method === "initialize") {
    sendJson(res, 200, rpcResult(id, {
      protocolVersion: MCP_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "ax-workbench-mcp", version: "0.1.0" }
    }));
    return;
  }

  if (method === "notifications/initialized") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method === "tools/list") {
    sendJson(res, 200, rpcResult(id, { tools }));
    return;
  }

  if (method === "tools/call") {
    try {
      sendJson(res, 200, rpcResult(id, await callTool(params.name, params.arguments || {})));
    } catch (error) {
      sendJson(res, 200, rpcResult(id, textResult(error.message, true)));
    }
    return;
  }

  sendJson(res, 200, rpcError(id, -32601, `method not found: ${method}`));
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname);
  const requested = pathname === "/" ? "/apps/workbench/demo/mvp.html" : pathname;
  const file = path.resolve(ROOT, `.${requested}`);
  if (!file.startsWith(ROOT + path.sep)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(file);
    headers(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
    res.end(content);
  } catch {
    sendJson(res, 404, { error: "not found" });
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      headers(res);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.url?.split("?")[0] === "/mcp" && req.method === "POST") {
      await handleMcp(req, res);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "method not allowed" });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const server = createServer();
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`AX Workbench local server: http://127.0.0.1:${PORT}/apps/workbench/demo/mvp.html`);
    console.log(`MCP endpoint: http://127.0.0.1:${PORT}/mcp`);
  });
}
