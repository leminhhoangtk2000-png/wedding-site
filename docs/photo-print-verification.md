# Biên bản kiểm chứng Codex

UI được thực thi bằng Antigravity bản thường, chat `Wedding Photo Print UI Implementation`. Codex kiểm tra source bàn giao, API, migration và Mac worker trong cùng checkout.

## Đã kiểm chứng cục bộ

- `npm run test:photo`: 11 tests qua. Migration/RPC/RLS chạy trên PGlite; kiểm tra 100 callers, quota, retry, từ chối, in lại, lease hết hạn, report muộn và claim đơn. Client không gửi ảnh >3MB khi decode/canvas thất bại hoặc nén không đủ nhỏ. Đây không phải stress test nhiều kết nối PostgreSQL độc lập.
- Xử lý ảnh: JPEG, EXIF xoay, tỷ lệ và giới hạn crop, file không hợp lệ. Chưa kiểm tra HEIC từ từng dòng điện thoại thật.
- Worker: journal trước spool, mất ACK, restart và kết quả CUPS không rõ. Native spool được thay bằng fixture trong test, không gửi ảnh tới máy in thật.
- `npm run test:photo:api`: Next HTTP routes thật → RPC/DB PGlite → adapter PostgREST/Storage thử nghiệm. Upload, private token, duyệt, station claim/begin/submitted, ready và reprint qua. Không dùng Supabase production.
- Preview production trong workspace tạm: đăng nhập admin, hiển thị một yêu cầu và bộ đếm 98/100 sau in lại; bấm Tạm dừng cập nhật trạng thái server và UI.
- Chrome desktop với viewport 320/390px: trang khách và dashboard không tràn ngang. Không phải kiểm thử camera Safari/Chrome trên điện thoại.
- Sau sửa header: chỉ có header của tính năng photo; logo/menu global không còn đè lên nội dung.
- Component crop thật trong route QA chỉ có ở checkout tạm: mở khóa vẫn giữ crop đã lưu; phím ArrowRight trên slider cập nhật zoom/crop; đổi sang khổ ngang và khóa lại hoạt động. Không có error/warn trong console. Khung ngang đo 334 × 225.671875px, tỷ lệ 1.48002. Test này không thay thế upload/camera hoặc toàn bộ luồng reload trên điện thoại.
- Lint: 0 errors, 21 warnings từ các file có sẵn. Production build: 17 routes qua. Route QA không được thêm vào source ứng dụng hoặc build production của project.

Ảnh chụp ở `../../photo-print-qa/`, dữ liệu minh họa là fixture cục bộ. Biên nhận Antigravity ở `../../PHOTO_PRINT_UI_RECEIPT.md` là báo cáo của bên thực thi; không thay thế các giới hạn kiểm chứng ở đây.

## Chưa thể kiểm chứng/đưa vào hoạt động

- Updated 2026-10-02: production migration applied. Vercel production has service-role, station token and PHOTO_PRINT_HARDWARE_VERIFIED=false. Existing ADMIN_PASSWORD preserved. New environment settings and security patch are not deployed.
- Mac CUPS has no printers. Private station config created with UUID/token and hardware_verified=false; printer/media remain placeholders. LaunchAgent not installed or started; no physical prints yet.
- Upload qua Chrome automation bị chặn bởi quyền file URL của extension. Không thay đổi quyền extension. Upload qua API fixture đã kiểm chứng.
- Còn phải kiểm tra iPhone Safari/Android Chrome: camera, hủy chụp, chọn thư viện, HEIC, crop và mạng yếu; sau đó chạy trên đúng Mac và CP1500.

Giữ phiên mặc định tạm dừng, `PHOTO_PRINT_HARDWARE_VERIFIED=false` và config Mac `hardware_verified:false` cho đến khi nghiệm thu. Quy trình setup ở `photo-printing.md`.

## Setup verification 2026-10-02

- Next.js / eslint-config-next 16.3.8; full and production npm audit: zero vulnerabilities. Build: 17 routes; lint: zero errors, 21 existing warnings; 11 tests and HTTP API integration passed.
- Live Supabase SDK: service-role session RPC passed (paused, capacity 100, reserved 0), private bucket passed, anonymous RPC denied. No guest data or print jobs created.
- All photo_print tables have RLS; anon/authenticated cannot execute RPC. Screenshot: ../../photo-print-qa/supabase-production-security.png.
- Secrets stay in ignored private server/config files. Mac worker has only station token. No commit, push or deployment performed in this setup run.
