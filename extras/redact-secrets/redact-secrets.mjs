#!/usr/bin/env node
// Hook PostToolUse của Claude Code: che secret trong output của mọi công cụ trước khi tới Claude.
// Thay đúng đoạn lộ bằng <REDACTED:loại>, giữ nguyên cấu trúc output (chỉ đổi giá trị chuỗi), rồi
// thêm additionalContext báo rằng đã che. Không bao giờ chặn công cụ: lỗi nào cũng thoát mã 0, không in gì.
//
// Giới hạn: chỉ đổi những gì Claude nhìn thấy; công cụ đã chạy xong. Nhận diện theo mẫu đã biết và theo tên khóa
// (password, token, secret...), không đoán theo độ ngẫu nhiên, nên không bắt được mọi secret.
// Nhật ký (chỉ loại và số lượng, không có giá trị): ~/.claude/hooks/redact-secrets.log
import { appendFileSync, renameSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOG = join(homedir(), '.claude', 'hooks', 'redact-secrets.log');
const LOG_MAX = 256 * 1024;
const placeholder = kind => `<REDACTED:${kind}>`;

// Tên khóa gợi ý secret. Chỉ chứa nhóm không bắt, để số nhóm của các biểu thức bên dưới cố định.
const KEY = String.raw`(?:[A-Za-z0-9_.-]{0,40}(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|credential)[A-Za-z0-9_.-]{0,40}|mật khẩu|mat khau)`;
// Dấu phân cách khóa và giá trị. Khóa không được kết thúc bằng đuôi tệp: tên như secrets.yaml hay token.json trong
// dòng của Grep ("secrets.yaml:4:...") không phải tên khóa.
const KEY_OP = String.raw`(?<!\.(?:txt|json|ya?ml|env|ini|cfg|conf|properties|xml|md|log|toml|csv|py|js|ts|sh|ps1|java|sql|html|bak|pem|crt))["']?\s*[:=]\s*`;
// Khóa nói về tên, đường dẫn, cờ... chứ không phải giá trị bí mật (secretName, tokenUrl, passwordFile, secretKeyRef).
const KEY_END_SKIP = /(?:name|ref|path|file|dir|folder|url|uri|type|kind|version|id|enabled|policy|manager|store|provider|class|label|annotation|length|size|count|limit)$/i;
const KEY_START_SKIP = /^(?:is|has|use|enable|disable|show|hide|max|min|num)[_-]?/i;
// Giá trị là kiểu dữ liệu, chỗ giữ chỗ hoặc biểu thức mã, không phải secret thật.
const NOT_SECRET = /^(?:string|str|number|boolean|bool|int|integer|float|object|array|true|false|null|none|nil|undefined|required|optional|changeme|change[-_]?me|example|your[-_a-z0-9]*|x+|\*+|\.{3,}|redacted)$/i;
const CODE_LIKE = /^(?:\$[{(]|%[A-Za-z_]+%|\{\{|<|https?:\/\/|\/|\.\/|~|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$|(?:self|this|env|process|os|request|req|args|opts|options|config|params|input|prompt|get\w*|read\w*)[.(\[])/i;

function isSecretValue(value, pre) {
  const key = pre.replace(/["']?\s*[:=]\s*$/, '').replace(/^[\s,{;(]+/, '');
  if (KEY_END_SKIP.test(key) || KEY_START_SKIP.test(key)) return false;
  if (NOT_SECRET.test(value) || CODE_LIKE.test(value) || value.startsWith('<REDACTED')) return false;
  if (/^\d+$/.test(value) && !/pass|pwd|secret/i.test(key)) return false;
  return true;
}

const whole = (kind, re) => ({ kind, re, fn: () => placeholder(kind) });
const RULES = [
  // Khóa riêng: cả khối, và phần thân khi thiếu dòng END.
  whole('private-key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g),
  whole('private-key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[A-Za-z0-9+/=\r\n \t]{20,}/g),
  whole('aws-access-key', /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA)[0-9A-Z]{16}\b/g),
  whole('github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b/g),
  whole('gitlab-token', /\bglpat-[A-Za-z0-9_-]{20,}\b/g),
  whole('google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g),
  whole('anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/g),
  whole('openai-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/g),
  whole('slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g),
  whole('stripe-key', /\b[sr]k_(?:live|test)_[0-9A-Za-z]{20,}/g),
  whole('npm-token', /\bnpm_[A-Za-z0-9]{36}\b/g),
  whole('telegram-bot-token', /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g),
  whole('jwt', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g),
  {
    kind: 'bearer-token', re: /\b(Bearer|Basic)(\s+)([A-Za-z0-9._~+/=-]{16,})/gi,
    fn: (m, scheme, space, token) => (/\d|=/.test(token) ? `${scheme}${space}${placeholder('bearer-token')}` : m),
  },
  {
    kind: 'url-password', re: /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]{3,})@/gi,
    fn: (m, scheme, user, pass) => (/^[<${%]/.test(pass) ? m : `${scheme}${user}:${placeholder('url-password')}@`),
  },
  {
    kind: 'jdbc-password', re: /(\bjdbc:[a-z0-9]+:[a-z0-9]*:?)([A-Za-z0-9_$#]+)\/([^\s@]{3,})@/gi,
    fn: (m, head, user, pass) => (/^[<${%]/.test(pass) ? m : `${head}${user}/${placeholder('jdbc-password')}@`),
  },
  {
    kind: 'curl-user', re: /(\s(?:-u|--user)[\s=]+)([^\s:]+):(\S+)/g,
    fn: (m, head, user, pass) => (/^[<${%]/.test(pass) ? m : `${head}${user}:${placeholder('curl-user-password')}`),
  },
  {
    kind: 'credential', re: new RegExp(String.raw`(\b${KEY}${KEY_OP})(["'])([^"'\r\n]{6,200})\2`, 'gi'),
    fn: (m, pre, quote, value) => (isSecretValue(value, pre) ? `${pre}${quote}${placeholder('credential')}${quote}` : m),
  },
  {
    // Không đứng giữa một định danh; ký tự đứng trước có thể là bất kỳ (kể cả ':' trong dòng của Grep: "tệp:4:KEY=...").
    // (?!\d+[:-]) loại trường hợp giá trị thật ra là tiền tố số dòng của Grep ("tệp:4:KEY=...").
    kind: 'credential', re: new RegExp(String.raw`(?<![A-Za-z0-9_.-])(${KEY}${KEY_OP})(?!\d+[:-])([^\s"'\x60,;<>{}()\[\]\\]{6,200})`, 'gi'),
    fn: (m, pre, value) => (isSecretValue(value, pre) ? `${pre}${placeholder('credential')}` : m),
  },
];

// Secret của Kubernetes: giá trị dưới data/stringData (base64 nên không có mẫu để nhận ra).
function redactK8sSecret(text, count) {
  if (!/\bkind:\s*Secret\b|"kind"\s*:\s*"Secret"/.test(text)) return text;
  const ph = placeholder('k8s-secret-value');
  text = text.replace(/^([ \t]*)(data|stringData):[ \t]*\r?\n((?:\1[ \t]+[^\r\n]*(?:\r?\n|$))+)/gm, (m, indent, key, block) => {
    const next = block.replace(/^([ \t]+[^:\r\n]+:[ \t]*)(?!<REDACTED)(\S[^\r\n]*)(?=\r?\n|$)/gm, (l, head) => { count(); return `${head}${ph}`; });
    return `${indent}${key}:\n${next}`;
  });
  return text.replace(/("(?:data|stringData)"\s*:\s*\{)([^{}]*)(\})/g, (m, open, inner, close) =>
    `${open}${inner.replace(/("(?:[^"\\]|\\.)*"\s*:\s*)"(?!<REDACTED)(?:[^"\\]|\\.)*"/g, (l, head) => { count(); return `${head}"${ph}"`; })}${close}`);
}

function redactString(text, counts) {
  const bump = kind => () => { counts[kind] = (counts[kind] ?? 0) + 1; };
  for (const rule of RULES) {
    text = text.replace(rule.re, (...args) => {
      const out = rule.fn(...args);
      if (out !== args[0]) bump(rule.kind)();
      return out;
    });
  }
  return redactK8sSecret(text, bump('k8s-secret-value'));
}

// Duyệt sâu, chỉ thay giá trị chuỗi: khóa, kiểu, thứ tự và các trường không phải chuỗi giữ nguyên.
function mapStrings(value, fn, depth = 0) {
  if (typeof value === 'string') return fn(value);
  if (depth > 50) return value;
  if (Array.isArray(value)) return value.map(item => mapStrings(item, fn, depth + 1));
  if (value !== null && typeof value === 'object') {
    const copy = {};
    for (const [key, item] of Object.entries(value)) copy[key] = mapStrings(item, fn, depth + 1);
    return copy;
  }
  return value;
}

function log(line) {
  try {
    try { if (statSync(LOG).size > LOG_MAX) renameSync(LOG, `${LOG}.old`); } catch { /* chưa có tệp */ }
    appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
  } catch { /* nhật ký chỉ để theo dõi, lỗi ghi không được ảnh hưởng công cụ */ }
}

try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^﻿/, ''));
  const response = input?.tool_response;
  if (response !== null && (typeof response === 'object' || typeof response === 'string')) {
    const counts = {};
    const redacted = mapStrings(response, text => redactString(text, counts));
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    if (total > 0) {
      const kinds = Object.entries(counts).sort().map(([kind, n]) => `${kind} x${n}`).join(', ');
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          updatedToolOutput: redacted,
          additionalContext: `Hook che secret đã thay ${total} đoạn trong kết quả của công cụ ${input.tool_name ?? 'không rõ'} bằng <REDACTED:loại> (${kinds}). Giá trị thật của các đoạn đó không có trong ngữ cảnh.`,
        },
      }));
      log(`tool=${input.tool_name ?? '?'} đã che ${total}: ${kinds}`);
    }
  }
} catch (error) {
  log(`LỖI ${error?.name ?? 'Error'} (không ghi nội dung lỗi vì thông báo của JSON.parse có thể chứa một đoạn đầu vào)`);
}
