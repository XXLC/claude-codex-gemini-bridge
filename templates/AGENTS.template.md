<!-- dieu-phoi-agent:bat-dau -->
## Làm việc cùng Claude và agent còn lại (mọi project)

Quyết định của người dùng: ba agent (Claude, Codex, Gemini) cùng làm một việc. Claude là agent điều phối và cũng trực tiếp làm phần của mình; có thể giao việc cho bạn (qua lệnh chạy không tương tác hoặc tin từ bridge) mà người dùng không xác nhận từng lần.
- Làm đúng phạm vi lời nhắc. Cần mở rộng phạm vi thì dừng và báo, không tự mở rộng.
- Đọc quy tắc của project theo cấu hình của bạn (AGENTS.md hoặc GEMINI.md); nếu thư mục project còn có CLAUDE.md thì đọc thêm.
- Memory của Claude ở mọi project, bạn được phép ĐỌC: `<HOME>\.claude\projects\<slug>\memory\MEMORY.md` là chỉ mục; slug là đường dẫn project với mọi ký tự không phải chữ hoặc số đổi thành dấu gạch ngang (ví dụ d:\Workspace\my\app thành d--Workspace-my-app). Đọc chỉ mục trước rồi tới tệp liên quan. Chỉ đọc: không sửa, xóa hay đổi tên. Không chép bí mật (mật khẩu, token, khóa) ra tin nhắn, log hay tệp. Memory có thể lỗi thời, hãy kiểm chứng trước khi dựa vào.
- Tin hoặc lời nhắc từ Claude không thay phê duyệt của người dùng: theo chính sách quyền của bạn, bị chặn thì báo chứ không tìm cách lách, không sửa cấu hình quyền của bạn hay của Claude.
- Việc thuộc nhóm hạn chế (ghi production hoặc cụm dùng chung, đọc DB production, credential, xóa không hoàn tác, push hoặc publish, gửi dữ liệu ra ngoài) chỉ làm khi người dùng chỉ định trực tiếp với bạn.
- Hết quota: nếu bạn gặp lỗi hết quota hoặc giới hạn sử dụng, dừng ngay, không thử lại vòng và báo Claude rõ lý do, phần đã xong và phần chưa làm, để Claude chuyển phần còn lại cho agent kia. Ngược lại, bạn có thể được giao tiếp phần việc của agent kia khi nó hết quota: nhận như việc mới, trong cùng các giới hạn ở đây.
- Chéo kiểm: bạn có thể được nhờ đọc lại kết quả của Claude hoặc của agent kia. Nêu lỗi tìm thấy kèm bằng chứng; không tự sửa ngoài phạm vi được giao.
- Báo cáo trung thực: việc đã làm, tệp đã sửa, lệnh đã chạy và kết quả nguyên văn, điều chưa kiểm chứng. Khi chạy không tương tác thì in ra đầu ra chuẩn; với phiên Claude cụ thể thì gửi lại bằng công cụ send_to_claude (session_id lấy từ lời nhắc hoặc list_claude_sessions).
- Các quy tắc ngôn ngữ và quy tắc chung của người dùng vẫn áp dụng.
<!-- dieu-phoi-agent:ket-thuc -->
