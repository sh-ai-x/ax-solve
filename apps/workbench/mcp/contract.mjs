export const FIELD_KEYS = [
  "goal",
  "constraints",
  "success_criteria",
  "anti_goals",
  "acceptance_rubric"
];

export const FIELD_LABELS = {
  goal: "Goal",
  constraints: "Constraints",
  success_criteria: "Success criteria",
  anti_goals: "Anti-goals",
  acceptance_rubric: "Acceptance rubric"
};

function decodeHtmlEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return named[entity.toLowerCase()] || match;
  });
}

function inlineHtmlToMarkdown(value) {
  return decodeHtmlEntities(value
    .replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `[${inlineHtmlToMarkdown(label)}](${href})`)
    .replace(/<(strong|b)\b[^>]*>/gi, "**")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(em|i)\b[^>]*>/gi, "*")
    .replace(/<\/(em|i)>/gi, "*")
    .replace(/<br\s*\/?>(?=\s*)/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function htmlToMarkdown(html) {
  const markdown = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, value) => `\n\`\`\`\n${inlineHtmlToMarkdown(value)}\n\`\`\`\n`)
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, value) => `\n${"#".repeat(Number(level))} ${inlineHtmlToMarkdown(value)}\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, value) => `\n- ${inlineHtmlToMarkdown(value)}\n`)
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<\/?(?:p|div|section|article|header|footer|main|blockquote|ul|ol|table|thead|tbody|tr|td|th)\b[^>]*>/gi, "\n");

  return inlineHtmlToMarkdown(markdown)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function yamlToMarkdown(yaml) {
  // shortcut: preserve arbitrary YAML syntax in Markdown; use a full YAML parser when semantic rendering is required.
  const value = yaml.trim();
  const longest = Math.max(...(value.match(/`+/g) || [""]).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}yaml\n${value}\n${fence}`;
}

function normalizeReference(ref) {
  if (typeof ref === "string") return { name: ref, content: "" };
  if (!ref || typeof ref !== "object") return { name: String(ref ?? "reference"), content: "" };
  return {
    name: String(ref.name || "reference"),
    path: typeof ref.path === "string" ? ref.path : String(ref.path ?? ""),
    content: typeof ref.content === "string" ? ref.content : String(ref.content ?? "")
  };
}

function referenceContentFence(content) {
  const longest = Math.max(...(content.match(/`+/g) || [""]).map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

export function deriveContract(request, refs = []) {
  const subject = request.includes("회의") ? "회의 후 결정사항과 반복 업무" : "입력된 업무 문제";
  const source = refs.length ? refs.map((ref) => normalizeReference(ref).name).join(", ") : "입력된 문제 설명";

  return {
    goal: `${subject}를 원문 근거와 함께 자동으로 정리한다.`,
    constraints: `${source}를 기준으로 초안을 만들고, 사람이 검토하기 전에는 외부 전송이나 업무 확정을 하지 않는다.`,
    success_criteria: "10분 안에 실행 목록, 담당자, 기한, 근거를 확인할 수 있다.",
    anti_goals: "자동으로 메일을 발송하거나 담당자에게 업무를 확정하지 않는다.",
    acceptance_rubric: "원문 근거, 담당자, 기한, 승인 상태가 결과에 포함되고 사람이 수정할 수 있다."
  };
}

export function validateContract(contract = {}) {
  const missing = FIELD_KEYS.filter((key) => {
    return typeof contract[key] !== "string" || !contract[key].trim();
  });

  return {
    complete: missing.length === 0,
    missing,
    fields: Object.fromEntries(FIELD_KEYS.map((key) => [
      key,
      { label: FIELD_LABELS[key], filled: !missing.includes(key) }
    ]))
  };
}

export function createHandoff({ request = "", refs = [], contract = {} } = {}) {
  const validation = validateContract(contract);
  const referenceLines = refs.length
    ? refs.flatMap((ref) => {
      const reference = normalizeReference(ref);
      const pathLine = reference.path ? [`  Path: ${reference.path}`] : [];
      if (!reference.content) return [`- ${reference.name}`, ...pathLine];
      const fence = referenceContentFence(reference.content);
      return [`- ${reference.name}`, ...pathLine, `  Content:`, `  ${fence}text`, reference.content, `  ${fence}`];
    })
    : ["- problem statement"];
  const contractLines = FIELD_KEYS.flatMap((key) => [
    `### ${FIELD_LABELS[key]}`,
    contract[key] || "(needs input)",
    ""
  ]);

  const markdown = [
    "# Workflow handoff",
    "",
    "## Request",
    request || "(empty)",
    "",
    "## References",
    ...referenceLines,
    "",
    "## Contract",
    ...contractLines,
    "## Verification",
    "- owner",
    "- due_date",
    "- evidence",
    "- human_approval",
    "",
    "## Readiness",
    validation.complete ? "ready for human review" : `blocked: ${validation.missing.join(", ")}`,
    ""
  ].join("\n");

  return {
    markdown,
    json: { request, refs, contract, validation }
  };
}
