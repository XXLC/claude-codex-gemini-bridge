# Mẫu hướng dẫn điều phối agent

Ba tệp trong thư mục này là khối quy tắc "làm việc cùng Codex và Gemini" dùng cho ba agent. Mỗi khối nằm giữa hai dòng thẻ HTML `<!-- dieu-phoi-agent:bat-dau -->` và `<!-- dieu-phoi-agent:ket-thuc -->`; chỉ chép phần giữa hai thẻ (gồm cả hai thẻ, để sau này thay lại được) vào tệp cấu hình cấp người dùng:

| Mẫu | Chép vào |
|---|---|
| `CLAUDE.template.md` | `<HOME>/.claude/CLAUDE.md` |
| `AGENTS.template.md` | `<HOME>/.codex/AGENTS.md` (Codex chỉ đọc AGENTS.md) |
| `GEMINI.template.md` | `<HOME>/.gemini/GEMINI.md` |

Các khối này là chính sách của một người dùng cụ thể, không phải chuẩn. Đọc và sửa cho đúng ý bạn trước khi dùng, nhất là:
- Các chỗ giữ chỗ: `<HOME>`, `<ĐƯỜNG_DẪN_AGY>` (đường dẫn tới `agy`), `<ĐƯỜNG_DẪN_CODEX>` (lệnh gọi `codex` nếu không có trong PATH), `<slug>` (quy ước đặt tên thư mục memory của Claude Code).
- Lệnh và đường dẫn viết theo Windows và PowerShell (`codex exec`, `agy -p`); các hệ điều hành khác chưa kiểm.
- Tên model Gemini (`gemini-4-argon-*`, `gemini-3.8-flash-*`) lấy từ `agy models` của một tài khoản cụ thể; kiểm tra danh sách của bạn.
- Danh sách "nhóm việc hạn chế" và việc cho Codex, Gemini đọc memory của Claude: xem `docs/SECURITY.md` trước khi bật. Đọc memory nghĩa là nội dung đó đi tới OpenAI và Google.
- Từ khóa nhận biết "hết quota" là ước đoán ban đầu, chưa được kiểm với thông báo lỗi thật của từng dịch vụ.
- Antigravity cắt mỗi tệp hướng dẫn ở 24.000 byte; khối này khoảng 3 KB cho Codex và Gemini, khoảng 7 KB cho Claude.