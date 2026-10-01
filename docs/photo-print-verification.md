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

- Môi trường hiện tại chưa có `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` và token trạm. Chưa chạy migration production hoặc triển khai website.
- CUPS trên Mac chưa có máy in đã thêm. Chưa cài/chạy LaunchAgent, chưa in 10 ảnh giấy hoặc thử lỗi hết giấy/mực.
- Upload qua Chrome automation bị chặn bởi quyền file URL của extension. Không thay đổi quyền extension. Upload qua API fixture đã kiểm chứng.
- Còn phải kiểm tra iPhone Safari/Android Chrome: camera, hủy chụp, chọn thư viện, HEIC, crop và mạng yếu; sau đó chạy trên đúng Mac và CP1500.

Giữ phiên mặc định tạm dừng, `PHOTO_PRINT_HARDWARE_VERIFIED=false` và config Mac `hardware_verified:false` cho đến khi nghiệm thu. Quy trình setup ở `photo-printing.md`.
