// Không khởi chạy daemon hay lệnh hàng đợi Codex thật.
export async function openDaemon() {
  return { close() {} };
}

export async function listTerminalThreads(connection, { limit = 20 } = {}) {
  return [{ thread_id: '22222222-2222-4222-8222-222222222222', title: 'Hội thoại Codex giả', cwd: '/du-an-gia' }].slice(0, limit);
}

export async function queueToTerminalThread({ threadId }) {
  if (typeof threadId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(threadId)) {
    throw new Error('The Codex queue route requires an exact session UUID; titles and aliases are not supported.');
  }
  return { status: 'written', acknowledged: false };
}
