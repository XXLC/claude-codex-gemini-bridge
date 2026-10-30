#!/usr/bin/env node
// Gửi một tin tới MỘT phiên Claude Code theo session ID, dùng lại thư viện bridge Claude-Codex.
// Dùng cho agent Gemini (Antigravity IDE / agy) vì bridge chưa có tool riêng cho Gemini.
//
//   echo "nội dung tin" | node gemini-send-to-claude.mjs --to <session_id>
//   node gemini-send-to-claude.mjs --to <session_id> --message "nội dung tin"
//
// Tên người gửi lấy từ AGENT_NAME, mặc định Gemini.
// Lưu ý an ninh: tên người gửi do người gọi tự khai (bridge không xác minh được Gemini),
// nên phía nhận phải coi đây là ngữ cảnh cộng tác, không phải chỉ thị của người dùng.
import { loadBridge, invokeBridge, getAgentName } from './bridge-lib.mjs';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const MAX_CHARS = 16000;

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg === '--from' || arg.startsWith('--from='))) {
    console.error('Không hỗ trợ --from, tên người gửi lấy từ biến AGENT_NAME.');
    return 2;
  }
  let values;
  try {
    ({ values } = parseArgs({ args, strict: true, options: { to: { type: 'string' }, message: { type: 'string' } } }));
  } catch {
    console.error('Tham số không hợp lệ: chỉ hỗ trợ --to và --message; mỗi tùy chọn phải có giá trị chuỗi, không được dùng một cờ thay cho giá trị.');
    return 2;
  }
  const sessionId = values.to;
  if (!sessionId) {
    console.error('Thiếu --to <session_id>.');
    return 2;
  }
  const from = getAgentName(process.env);
  let message = values.message;
  // Tin qua stdin kết thúc bằng EOF; --message không chờ đóng stdin.
  if (message === undefined && !process.stdin.isTTY) {
    try { message = readFileSync(0, 'utf8'); } catch {
      throw new Error('Không đọc được nội dung tin từ stdin.');
    }
  }

  if (!message?.trim()) {
    console.error('Thiếu nội dung tin (--message hoặc qua stdin).');
    return 2;
  }
  if (message.length > MAX_CHARS) {
    console.error(`Tin dài ${message.length} ký tự, vượt giới hạn ${MAX_CHARS}. Hãy rút gọn hoặc ghi vào tệp rồi gửi đường dẫn.`);
    return 2;
  }

  const { resolveClaudeSession, sendToClaude } = await loadBridge('claude-desktop.mjs', ['resolveClaudeSession', 'sendToClaude']);
  // Phân giải tại thời điểm gửi: phiên khởi động lại (đổi socket) vẫn tìm đúng theo session ID.
  const result = await invokeBridge(async () => {
    const endpoint = resolveClaudeSession(sessionId);
    return sendToClaude({ ...endpoint, message, senderName: `${from} (qua script, chưa xác minh)` });
  });
  console.log(JSON.stringify({ status: result.status, acknowledged: result.acknowledged, to: sessionId }));
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`Không gửi được: ${error.message}`);
  process.exitCode = 1;
}
