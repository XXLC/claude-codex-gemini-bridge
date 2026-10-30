# Xử lý sự cố (Troubleshooting)

Tài liệu này tổng hợp các bẫy kỹ thuật đã đo nguyên nhân gốc trên môi trường Windows 11 (`[ĐÃ KIỂM]`), cách kiểm tra biến môi trường `PATH` và cách phân biệt lỗi hết quota với lỗi kỹ thuật của công việc. Các hệ điều hành khác (macOS, Linux) hoặc máy khác hiện ở trạng thái `[CHƯA KIỂM]`.

## 1. Bảng triệu chứng, nguyên nhân gốc và cách xử lý

| Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|
| Gọi `send_to_codex` bị từ chối khi gửi tới hội thoại Codex trong extension | Chế độ mặc định `auto` từ chối hội thoại trong extension vì daemon báo `notLoaded` (`[ĐÃ KIỂM]`). | Bắt buộc truyền tham số `transport: "terminal"` khi gọi `send_to_codex` để tin đi qua `codex queue`. |
| Không kết nối được daemon Codex hoặc báo lỗi `this CLI has no complete local package` | Bridge không tự khởi động daemon Codex; bản `codex.exe` đi kèm extension IDE không có gói đầy đủ để chạy daemon (`[ĐÃ KIỂM]`). | Cài đặt gói đầy đủ bằng `npm i -g @openai/codex`, sau đó chạy `codex app-server daemon start` (có thể tạo tác vụ Task Scheduler để tự chạy khi đăng nhập). |
| Lệnh `node scripts/install.mjs --claude` của bridge báo lỗi ở bước cài plugin | Lệnh `claude plugin install` của Claude CLI không có tùy chọn `--json` mà script cài đặt truyền vào (`[ĐÃ KIỂM]`). | Chạy tay `claude plugin install codex-claude-desktop-bridge@codex-claude-desktop-local --scope user`, sao lưu `<HOME>/.claude/settings.json` rồi thêm quy tắc `mcp__plugin_codex-claude-desktop-bridge_codex-claude-desktop-bridge__send_to_codex` vào `permissions.allow`, sau đó chạy `/reload-plugins` hoặc mở phiên mới. |
| Phiên Claude chạy trong VS Code extension không xuất hiện trong danh sách phiên của bridge | Bản bridge `v0.4.0` chỉ nhận các phiên có entrypoint là `claude-desktop`, `cli`, `sdk-cli` và bỏ qua `claude-vscode` (`[ĐÃ KIỂM]`). | Cập nhật bridge từ nhánh `main` tính từ commit merge `3ac8488` (PR #5, ngày 2026-10-29) trở đi. |
| Bridge báo `Codex executable was not found` hoặc các IDE không tìm thấy `npm`, `agy` dù registry đúng | Ứng dụng mở từ taskbar thừa hưởng `PATH` của `explorer.exe`. Trong một lần đăng nhập, `explorer.exe` chỉ có `PATH` mức Machine nên mọi IDE thiếu mục `npm` và `agy` của người dùng (`[ĐÃ KIỂM]` phần đo; nguyên nhân vì sao `explorer.exe` thiếu `PATH` người dùng: `[CHƯA RÕ]`). | Mở lại IDE không giải quyết được; phải đăng xuất Windows rồi đăng nhập lại. Phương án dự phòng cho Codex: đặt biến môi trường `CODEX_CLAUDE_BRIDGE_CODEX_BIN` trỏ tới `<đường dẫn codex.exe>`. |
| `agy -p` ở chế độ không tương tác bị từ chối quyền khi đọc tệp hoặc gọi công cụ (dù đã cấu hình `permissions.allow` hoặc `--settings` với rule `command(...)` có và không có dấu `*`) | `agy -p` ở chế độ không tương tác bỏ qua `permissions.allow` (issue `google-antigravity/antigravity-cli#548`) (`[ĐÃ KIỂM]`). | Nếu chỉ hỏi đáp thuần thì không cần cờ. Nếu cần đọc tệp hoặc gọi công cụ, thêm `--dangerously-skip-permissions` (duyệt mọi công cụ cho lần chạy đó), chỉ dùng với lời nhắc rất hẹp trong thư mục project. |
| `agy -p` im lặng trả về 0 byte, hoặc lời nhắc nhiều dòng bị tách thành nhiều tham số | Lời nhắc truyền qua dòng lệnh dài quá khoảng 32.000 ký tự khiến `agy -p` im lặng trả 0 byte; lời nhắc nhiều dòng truyền qua `Start-Process -ArgumentList` bị tách thành nhiều tham số (`[ĐÃ KIỂM]`). | Giữ lời nhắc dưới khoảng 25.000 ký tự và luôn kiểm tra đầu ra khác rỗng. Với lời nhắc nhiều dòng, truyền qua tệp hoặc `stdin` thay vì `Start-Process -ArgumentList`. |
| Gọi Gemini CLI (`gemini`) gặp lỗi `IneligibleTierError` | Google ngừng phục vụ gói AI Pro và Ultra qua Gemini CLI từ ngày 2026-06-18, bắt buộc chuyển sang Antigravity (`[ĐÃ KIỂM]`). | Chuyển sang sử dụng Antigravity CLI (`agy`). |
| Kết quả từ Gemini đếm sai ký tự hoặc tự ý chèn chữ ngoài ngôn ngữ đang dùng vào câu | Model Gemini bản `low` đếm sai một ký tự trong một lần thử; Gemini đã hai lần chèn chữ ngoài tiếng đang dùng vào câu (`[ĐÃ KIỂM]`, mẫu nhỏ). | Không dùng model bản `low` cho việc cần độ chính xác. Luôn đọc lại kết quả của Gemini trước khi sử dụng hoặc chuyển tiếp. |
| Lệnh `git commit -F -` dùng kèm here-string trong PowerShell bị lỗi | Cơ chế truyền here-string của PowerShell vào `git commit -F -` làm hỏng lệnh (`[ĐÃ KIỂM]`). | Ghi thông điệp commit ra một tệp rồi chạy `git commit -F <tệp>`. |
| Codex dừng lại và không tự thực hiện các việc như `push`, sửa cấu hình quyền của Claude, hoặc SSH ghi sang máy khác khi nhận tin từ Claude | Tin nhắn từ Claude không thay thế xác nhận trực tiếp của người dùng trong phiên Codex. Đây là hành vi mong muốn (`[ĐÃ KIỂM]`). | Người dùng tự xác nhận trực tiếp trong phiên Codex hoặc tự thực thi lệnh; không tìm cách lách qua agent khác. |

## 2. Cách kiểm tra biến môi trường PATH trên Windows

Khi gặp lỗi không tìm thấy `codex`, `npm` hoặc `agy` bên trong IDE dù kiểm tra trong Registry của Windows thấy đường dẫn đã đúng:

1. Hiểu cơ chế thừa hưởng (`[ĐÃ KIỂM]` phần đo):
   - Mọi ứng dụng được mở từ thanh tác vụ (taskbar) đều thừa hưởng khối biến môi trường từ tiến trình `explorer.exe`.
   - Trong một lần đăng nhập đã đo, `explorer.exe` chỉ giữ `PATH` ở mức Machine mà thiếu phần `PATH` mức người dùng (nơi chứa đường dẫn toàn cục của `npm` và `%LOCALAPPDATA%\agy\bin`). Do đó, chỉ tắt và mở lại IDE sẽ không nạp được `PATH` mới. (Nguyên nhân gốc vì sao `explorer.exe` thiếu `PATH` người dùng hiện vẫn `[CHƯA RÕ]`).
2. Cách đo và kiểm chứng:
   - Cách 1: Khởi chạy một tiến trình dòng lệnh trực tiếp từ `explorer.exe` để in và kiểm tra giá trị `PATH` thực tế mà `explorer.exe` đang truyền cho các tiến trình con.
   - Cách 2: Gọi API `CreateEnvironmentBlock` của Windows để lấy khối môi trường chuẩn được tổng hợp từ hệ thống và người dùng, sau đó so sánh với khối môi trường hiện tại của `explorer.exe`.
3. Cách xử lý:
   - Đăng xuất khỏi phiên Windows hiện tại rồi đăng nhập lại để `explorer.exe` nạp lại đầy đủ `PATH`.
   - Đối với `codex.exe`, có thể dùng phương án dự phòng là khai báo biến môi trường `CODEX_CLAUDE_BRIDGE_CODEX_BIN` trỏ thẳng tới `<đường dẫn codex.exe>`.

## 3. Phân biệt lỗi hết quota với lỗi của việc

Khi một lệnh giao việc cho Codex hoặc Gemini thất bại hoặc không trả về kết quả mong muốn, cần phân biệt rõ hai trường hợp sau để xử lý đúng quy trình:

### 3.1. Dấu hiệu lỗi hết quota / giới hạn sử dụng

- Đầu ra hoặc thông báo lỗi xuất hiện các từ khóa và mã trạng thái sau (danh sách này là ước đoán ban đầu):
  - Từ khóa: `quota`, `usage limit`, `rate limit`, `resource exhausted`, `credits`.
  - Mã trạng thái HTTP: `429`, `402`.
- Cách xử lý khi xác định là hết quota:
  - Không thử lại thành vòng lặp. Được chạy một lệnh rất ngắn (ví dụ yêu cầu trả lời một từ) đúng một lần để xác nhận quota thật sự đã hết trước khi chuyển việc.
  - Chuyển nguyên phần việc đó sang cho agent còn lại (Codex hết thì chuyển sang Gemini, Gemini hết thì chuyển sang Codex; nếu cả hai cùng hết thì Claude tự làm và báo cho người dùng).
  - Lưu ý trạng thái kiểm chứng: Việc chuyển việc khi hết quota được gắn nhãn `[BÁO CÁO]` (người bảo trì cho biết đã dùng thật trong hai ngày, nhưng repo này không có nhật ký lưu lại).
  - Giới hạn an toàn: Việc hết quota không cho phép chuyển các việc thuộc nhóm hạn chế (như ghi production, đọc DB production, xử lý credential, xóa không hoàn tác, `push`, đổi quyền) sang agent khác.

### 3.2. Dấu hiệu lỗi của việc (lỗi kỹ thuật, cấu hình hoặc quyền)

Nếu không có các dấu hiệu quota nêu trên, sự cố thuộc về lỗi của việc và không được xử lý bằng cách chuyển tự động như lỗi hết quota:
- Đầu ra của `agy -p` rỗng (0 byte) mà không có thông báo lỗi quota: Kiểm tra độ dài lời nhắc (nếu vượt quá khoảng 32.000 ký tự sẽ im lặng trả 0 byte; cần rút xuống dưới khoảng 25.000 ký tự).
- Lỗi `IneligibleTierError`: Do gọi nhầm lệnh `gemini` (Gemini CLI) thay vì `agy`.
- Lỗi từ chối quyền công cụ trong `agy -p`: Do chế độ không tương tác bỏ qua `permissions.allow` (issue `google-antigravity/antigravity-cli#548`), không phải lỗi tài khoản hay quota.
- Lỗi `notLoaded` khi gửi tin tới Codex: Do thiếu tham số `transport: "terminal"`.
- Agent từ chối thực hiện thao tác hoặc dừng chờ xác nhận (như `push`, sửa tệp cấu hình quyền, SSH ghi sang máy khác): Đây là cơ chế bảo vệ đúng thiết kế. Tuyệt đối không giao phần việc bị chặn này cho agent khác để lách quyền.
