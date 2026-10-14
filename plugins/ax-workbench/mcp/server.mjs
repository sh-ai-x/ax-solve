import readline from "node:readline";
import fs from "node:fs/promises";
import path from "node:path";
import {
  FIELD_KEYS,
  createHandoff,
  deriveContract,
  htmlToMarkdown,
  validateContract
} from "./contract.mjs";

const MCP_VERSION = "2025-06-18";
const MAX_REFERENCE_BYTES = 1_000_000;
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
    name: "ax_read_reference",
    description: "사용자가 지정한 로컬 참고자료를 읽고 HTML이면 Markdown으로 변환한다.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: { path: { type: "string", description: "사용자가 승인하고 입력한 절대경로" } }
    }
  },
  {
    name: "ax_structure_problem",
    description: "문제 원문과 참고자료를 AX Workbench의 5-field 계약 초안으로 구조화한다.",
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
    description: "5-field 계약이 검토용 handoff를 만들 만큼 채워졌는지 검증한다.",
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
    description: "문제 원문, 참고자료, 검토된 5-field 계약으로 review-only Markdown handoff를 만든다.",
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

function textResult(value, isError = false) {
  const result = {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }]
  };
  if (isError) result.isError = true;
  result.structuredContent = value;
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

async function readReference(referencePath) {
  if (typeof referencePath !== "string" || !path.isAbsolute(referencePath)) {
    throw new Error("reference path must be an absolute path");
  }

  const filePath = path.resolve(referencePath);
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error("reference path must point to a file");
  if (stat.size > MAX_REFERENCE_BYTES) throw new Error("reference file is too large");

  const raw = await fs.readFile(filePath, "utf8");
  const isHtml = /\.html?$/i.test(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    content: isHtml ? htmlToMarkdown(raw) : raw,
    format: isHtml ? "markdown" : "text"
  };
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function callTool(name, args = {}) {
  if (name === "ax_read_reference") {
    // shortcut: exact user-supplied paths on localhost; add an allowlist/consent token before remote use.
    const value = await readReference(args.path);
    return textResult(value);
  }

  if (name === "ax_structure_problem") {
    if (typeof args.request !== "string" || args.request.trim().length < 15) {
      return textResult("request must be at least 15 characters", true);
    }
    const refs = normalizeRefs(args.refs);
    const value = {
      request: args.request.trim(),
      refs,
      contract: deriveContract(args.request.trim(), refs)
    };
    return textResult(value);
  }

  if (name === "ax_validate_contract") {
    return textResult(validateContract(args.contract || {}));
  }

  if (name === "ax_create_handoff") {
    return textResult(createHandoff({
      request: typeof args.request === "string" ? args.request : "",
      refs: normalizeRefs(args.refs),
      contract: args.contract || {}
    }));
  }

  return textResult(`unknown tool: ${name}`, true);
}

async function handleMessage(message) {
  const { id = null, method, params = {} } = message;

  if (method === "initialize") {
    send(rpcResult(id, {
      protocolVersion: MCP_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "ax-workbench", version: "0.1.0" }
    }));
    return;
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") return;

  if (method === "ping") {
    send(rpcResult(id, {}));
    return;
  }

  if (method === "tools/list") {
    send(rpcResult(id, { tools }));
    return;
  }

  if (method === "tools/call") {
    try {
      send(rpcResult(id, await callTool(params.name, params.arguments || {})));
    } catch (error) {
      send(rpcResult(id, textResult(error.message, true)));
    }
    return;
  }

  send(rpcError(id, -32601, `method not found: ${method}`));
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();

input.on("line", (line) => {
  if (!line.trim()) return;
  queue = queue.then(async () => {
    try {
      await handleMessage(JSON.parse(line));
    } catch (error) {
      send(rpcError(null, -32700, error.message));
    }
  });
});
