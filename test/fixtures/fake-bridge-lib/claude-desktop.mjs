// Phiên cố định, không đọc hồ sơ người dùng và không mở kết nối thật.
export function discoverClaudeSessions() {
  return [{ sessionId: '11111111-1111-4111-8111-111111111111', name: 'Phiên Claude giả', cwd: '/du-an-gia', status: 'active', entrypoint: 'cli' }];
}

export function resolveClaudeSession(sessionId) {
  const session = discoverClaudeSessions().find(item => item.sessionId === sessionId);
  if (!session) throw new Error('The chosen Claude Code session is unavailable or has no live inbox.');
  return session;
}

export async function sendToClaude() {
  return { status: 'written', acknowledged: false };
}
