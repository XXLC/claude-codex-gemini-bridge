// Kiểm thử hook che secret. Chạy: node --test redact-secrets.test.mjs
// Dữ liệu giả được ghép lúc chạy để tệp này không chứa chuỗi giống khóa thật.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';

const SCRIPT = fileURLToPath(new URL('./redact-secrets.mjs', import.meta.url));
// Cô lập hồ sơ để hook không ghi nhật ký vào thư mục người dùng thật.
const TEST_HOME = mkdtempSync(fileURLToPath(new URL('../../.tmp-redact-', import.meta.url)));
after(() => rmSync(TEST_HOME, { recursive: true, force: true }));

function run(input) {
  // maxBuffer mặc định 1 MB sẽ cắt output lớn của ca hiệu năng và làm hỏng việc phân tích JSON trong test.
  const result = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, HOME: TEST_HOME, USERPROFILE: TEST_HOME }, input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: result.status, out: result.stdout, parsed: result.stdout ? JSON.parse(result.stdout) : null };
}
const bash = stdout => ({ tool_name: 'Bash', tool_input: {}, tool_response: { stdout, stderr: '', interrupted: false, isImage: false } });
const redactedOf = result => result.parsed.hookSpecificOutput.updatedToolOutput;

const aws = 'AKIA' + 'IOSFODNN7EXAMPLE';
const gh = 'ghp_' + 'a'.repeat(36);
const google = 'AIza' + 'SyA-1234567890abcdefghijklmnopqrstu';
const slack = 'xoxb-' + '1234567890-abcdefghij';
const telegram = '123456789:' + 'A'.repeat(35);
const jwt = 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.eyJ' + 'zdWIiOiIxMjM0NTY3ODkwIn0' + '.' + 'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
const pem = '-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA1234567890abcdef\nxyz0123456789=\n-----END ' + 'RSA PRIVATE KEY-----';

test('che mẫu đã biết và giữ nguyên cấu trúc output Bash', () => {
  const text = [`aws=${aws}`, `gh ${gh}`, `g ${google}`, slack, `bot ${telegram}`, `jwt ${jwt}`, pem].join('\n');
  const r = run(bash(text));
  assert.equal(r.code, 0);
  const out = redactedOf(r);
  assert.deepEqual(Object.keys(out), ['stdout', 'stderr', 'interrupted', 'isImage']);
  assert.equal(out.stderr, ''); assert.equal(out.interrupted, false); assert.equal(out.isImage, false);
  for (const secret of [aws, gh, google, slack, telegram, jwt, 'MIIEowIBAAKCAQEA']) assert.ok(!out.stdout.includes(secret), `còn lộ: ${secret.slice(0, 8)}`);
  for (const kind of ['aws-access-key', 'github-token', 'google-api-key', 'slack-token', 'telegram-bot-token', 'jwt', 'private-key']) assert.ok(out.stdout.includes(`<REDACTED:${kind}>`), kind);
  assert.match(r.parsed.hookSpecificOutput.additionalContext, /đã thay \d+ đoạn/);
  assert.equal(r.parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
});

test('che mật khẩu trong URL, JDBC, curl -u, Bearer', () => {
  const text = ['git clone https://user:' + 's3cr3tPass' + '@example.com/r.git', 'jdbc:oracle:thin:scott/' + 'tiger123' + '@//db:1521/x',
    'curl -u admin:' + 'hunter2hunter2' + ' http://x', 'Authorization: Bearer ' + 'abcdef1234567890abcdef'].join('\n');
  const out = redactedOf(run(bash(text))).stdout;
  for (const s of ['s3cr3tPass', 'tiger123', 'hunter2hunter2', 'abcdef1234567890abcdef']) assert.ok(!out.includes(s), s);
  assert.match(out, /https:\/\/user:<REDACTED:url-password>@example\.com/);
  assert.match(out, /Bearer <REDACTED:bearer-token>/);
});

test('che giá trị gán cho khóa nhạy cảm, giữ tên khóa', () => {
  const text = ['DB_PASSWORD=' + 'Sup3rS3cret!', '"api_key": "' + 'abcd1234efgh' + '"', 'mật khẩu: ' + 'Admin@12345', 'X-API-Key: ' + 'k9f8d7s6a5q4'].join('\n');
  const out = redactedOf(run(bash(text))).stdout;
  for (const s of ['Sup3rS3cret!', 'abcd1234efgh', 'Admin@12345', 'k9f8d7s6a5q4']) assert.ok(!out.includes(s), s);
  assert.match(out, /DB_PASSWORD=<REDACTED:credential>/);
  assert.match(out, /"api_key": "<REDACTED:credential>"/);
});

test('che giá trị khóa nhạy cảm trong định dạng của Grep, query string và tham số dòng lệnh', () => {
  const text = ['C:\\x\\f.txt:4:DB_PASSWORD=' + 'Sup3rS3cret!', 'f.txt-7-api_key: ' + 'abcd1234efgh', 'GET /x?user=a&token=' + 'abcdef123456' + '&z=1', 'mysql --password=' + 'Sup3rS3cret!' + ' -h db'].join('\n');
  const out = redactedOf(run(bash(text))).stdout;
  for (const s of ['Sup3rS3cret!', 'abcd1234efgh', 'abcdef123456']) assert.ok(!out.includes(s), s);
  assert.match(out, /f\.txt:4:DB_PASSWORD=<REDACTED:credential>/);
  assert.match(out, /-h db/); // giá trị kết thúc ở khoảng trắng; phần sau & trong query bị che cùng là chấp nhận được
});

test('tên tệp chứa chữ nhạy cảm trong dòng của Grep không bị coi là khóa', () => {
  const aws2 = 'AKIA' + 'IOSFODNN7EXAMPLE';
  const text = [`C:\\a\\secret-sample.txt:2:aws_key=${aws2}`, 'C:\\a\\secrets.yaml:password: ' + 'abc12345xyz', 'token.json:7:"password": "' + 'abc12345xyz' + '"', 'C:\\a\\secrets\\f.txt:3:plain line'].join('\n');
  const out = redactedOf(run(bash(text))).stdout;
  assert.match(out, /secret-sample\.txt:2:aws_key=<REDACTED:aws-access-key>/); // giữ nguyên đường dẫn, số dòng và tên khóa
  assert.match(out, /secrets\.yaml:password: <REDACTED:credential>/);
  assert.match(out, /token\.json:7:"password": "<REDACTED:credential>"/);
  assert.match(out, /secrets\\f\.txt:3:plain line/);
  assert.ok(!out.includes('abc12345xyz'));
});

test('khóa kiểu properties có dấu chấm vẫn bị che', () => {
  const out = redactedOf(run(bash('spring.datasource.password=' + 'Sup3rS3cret!' + '\napp.token=' + 'abcdef123456'))).stdout;
  assert.ok(!out.includes('Sup3rS3cret!') && !out.includes('abcdef123456'));
  assert.match(out, /spring\.datasource\.password=<REDACTED:credential>/);
});

test('che giá trị Secret của Kubernetes (YAML và JSON)', () => {
  const yaml = 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: db\ndata:\n  password: ' + 'c2VjcmV0cGFzcw==' + '\n  user: ' + 'YWRtaW4=' + '\ntype: Opaque\n';
  const out = redactedOf(run(bash(yaml))).stdout;
  assert.ok(!out.includes('c2VjcmV0cGFzcw==') && !out.includes('YWRtaW4='));
  assert.match(out, /name: db/); assert.match(out, /type: Opaque/);
  const json = '{"kind":"Secret","data":{"password":"' + 'c2VjcmV0cGFzcw==' + '"}}';
  assert.ok(!redactedOf(run(bash(json))).stdout.includes('c2VjcmV0cGFzcw=='));
});

test('không che các trường hợp dễ nhầm (không có kết quả khi không có secret)', () => {
  const safe = ['password: string', 'token = request.headers["x"]', 'max_tokens: 4096', 'commit 9fceb02d0ae598e95dc970b74767f19372d61724',
    'id 550e8400-e29b-41d4-a716-446655440000', 'const tokenizer = new Tokenizer()', 'secretName: my-db-secret', 'tokenUrl: https://x/y',
    'passwordFile: /etc/x', 'secretKeyRef: abcdef123', 'mật khẩu: không đổi', 'password: ********', 'api_key: ${API_KEY}', 'Basic authentication-header here',
    'password = os.environ["P"]', 'token: self.token_value', 'jwt: <hidden>'].join('\n');
  const r = run(bash(safe));
  assert.equal(r.code, 0);
  assert.equal(r.out, '', `bị che nhầm: ${r.out.slice(0, 300)}`);
});

test('giữ nguyên cấu trúc lồng nhau, mảng và chuỗi trần', () => {
  const nested = { tool_name: 'Read', tool_response: { type: 'text', file: { filePath: 'C:\\a.txt', numLines: 2, content: `x\n${gh}\n` }, tags: ['a', `t ${aws}`, 3, null, true] } };
  const out = redactedOf(run(nested));
  assert.equal(out.type, 'text'); assert.equal(out.file.filePath, 'C:\\a.txt'); assert.equal(out.file.numLines, 2);
  assert.ok(!out.file.content.includes(gh)); assert.deepEqual(out.tags.slice(2), [3, null, true]); assert.ok(!out.tags[1].includes(aws));
  assert.equal(redactedOf(run({ tool_name: 'X', tool_response: `k ${gh}` })), '<REDACTED:github-token>'.replace(/^/, 'k '));
  const mcp = redactedOf(run({ tool_name: 'mcp__x__y', tool_response: [{ type: 'text', text: `v ${aws}` }] }));
  assert.equal(mcp[0].type, 'text'); assert.ok(!mcp[0].text.includes(aws));
});

test('idempotent: output đã che không bị che lại', () => {
  const first = redactedOf(run(bash(`aws=${aws} DB_PASSWORD=Sup3rS3cret!`)));
  assert.equal(run({ tool_name: 'Bash', tool_response: first }).out, '');
});

test('lỗi đầu vào không làm hỏng: thoát 0 và không in gì', () => {
  for (const input of ['', 'không phải json', '{', JSON.stringify({ tool_name: 'Bash' }), JSON.stringify({ tool_response: null }), JSON.stringify({ tool_response: 42 })]) {
    const r = run(input); assert.equal(r.code, 0); assert.equal(r.out, '');
  }
});

test('hiệu năng: output 3 MB, kể cả một chuỗi base64 dài, xử lý dưới 5 giây', () => {
  const lines = Array.from({ length: 40000 }, (_, i) => `dòng ${i} nội dung bình thường không có bí mật, token_count: ${i}`).join('\n');
  const b64 = 'QUJD'.repeat(500000);
  const start = Date.now(); const r = run(bash(`${lines}\n${b64}\n${gh}`)); const ms = Date.now() - start;
  assert.equal(r.code, 0); assert.ok(!redactedOf(r).stdout.includes(gh)); assert.ok(ms < 5000, `quá chậm: ${ms} ms`);
});
