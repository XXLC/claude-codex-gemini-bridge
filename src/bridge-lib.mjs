// Dùng chung cách tìm thư viện cho máy chủ MCP và script dự phòng.
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const siblingLib = fileURLToPath(new URL('../../codex-claude-desktop-bridge/lib/', import.meta.url));

export function getAgentName(env) {
  return (env.AGENT_NAME || 'Gemini').replace(/[^\p{L}\p{N} ()_.-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 64) || 'Gemini';
}

export async function loadBridge(name, required) {
  const configured = process.env.BRIDGE_LIB_DIR;
  const directory = configured ? resolve(configured) : siblingLib;
  try {
    if (!statSync(directory).isDirectory()) throw new Error();
  } catch {
    throw new Error(`Không tìm thấy thư mục thư viện bridge. BRIDGE_LIB_DIR: ${configured ? resolve(configured) : 'chưa đặt'}; thư mục anh em: ${siblingLib}. Hãy đặt BRIDGE_LIB_DIR trỏ tới thư mục lib của bridge. Khi đã đặt biến này, thư mục anh em không được dùng thay thế.`);
  }
  const filename = join(directory, name);
  let library;
  try {
    library = await import(pathToFileURL(filename).href);
  } catch {
    throw new Error(`Không nạp được thư viện bridge tại ${filename}. Hãy kiểm tra BRIDGE_LIB_DIR, các tệp phụ thuộc và phiên bản bridge.`);
  }
  const missing = required.filter(key => typeof library[key] !== 'function');
  if (missing.length) throw new Error(`Thư viện bridge tại ${filename} thiếu hàm: ${missing.join(', ')}. Hãy dùng phiên bản bridge có đủ các hàm này.`);
  return library;
}

// Dịch hai lỗi đã biết. Lỗi khác của bridge được chuyển tiếp (cắt ngắn) thay vì nuốt: bridge được viết để không đưa
// token, endpoint hay nội dung tin vào thông báo lỗi, và những thông báo như "Codex executable was not found"
// là thứ duy nhất giúp người dùng biết phải sửa gì (xem docs/TROUBLESHOOTING.md).
const MAX_FORWARDED = 300;
export async function invokeBridge(action) {
  try { return await action(); } catch (error) {
    const messages = new Map([
      ['The chosen Claude Code session is unavailable or has no live inbox.', 'Phiên Claude Code đã chọn không khả dụng hoặc không có hộp thư đang hoạt động.'],
      ['The Codex queue route requires an exact session UUID; titles and aliases are not supported.', 'Hàng đợi Codex yêu cầu UUID phiên chính xác; không hỗ trợ tiêu đề hoặc bí danh.'],
    ]);
    const known = messages.get(error?.message);
    if (known) throw new Error(known);
    const raw = typeof error?.message === 'string' ? error.message.replace(/\s+/g, ' ').trim().slice(0, MAX_FORWARDED) : '';
    throw new Error(`Thao tác với thư viện bridge thất bại${raw ? `: ${raw}` : ''}. Hãy kiểm tra phiên đích và cấu hình bridge trên máy này.`);
  }
}
