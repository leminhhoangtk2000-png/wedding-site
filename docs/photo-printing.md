# Chụp và in ảnh — vận hành

## Trạng thái triển khai

UI được giao qua Antigravity bản thường trong project Wedding Website, chat `Wedding Photo Print UI Implementation` (3af27cd4-6519-45a1-ae6c-da826a138677). Brief ở `../../ANTIGRAVITY_PHOTO_PRINT_IMPLEMENTATION.md` tính từ thư mục docs này. Codex chịu trách nhiệm API/SQL/worker và kiểm tra bàn giao.

Phiên mặc định **tạm dừng**. Không mở cho khách trước khi cấu hình Supabase và thử đúng máy in. API thiếu cấu hình trả 503, không tạo dữ liệu hay tiến trình giả. Không tự triển khai lên Vercel, chạy migration production hoặc cài LaunchAgent trong lần build source.

## Cấu hình server/Supabase

1. Chạy migration `supabase/migrations/20261002_photo_printing.sql` bằng SQL Editor/migration pipeline của đúng Supabase project. Migration tạo bảng riêng tư, RPC chỉ service_role và bucket `photo_print_private` không public; không ảnh hưởng `wishes`/RSVP.
2. Thêm các biến trong `tools/photo-print/server-env.example` vào môi trường server; dùng `.env.local` khi chạy local. Lấy service-role key trong Supabase dashboard, không gửi key vào chat, trình duyệt hoặc Mac. Không dùng anon key thay thế. ADMIN_PASSWORD tối thiểu 8 ký tự; station token tối thiểu 32 ký tự, nên tạo 32 byte ngẫu nhiên. Không có mật khẩu mặc định cho API in.
3. `PHOTO_PRINT_HARDWARE_VERIFIED=false` cho đến khi đã chạy thử vật lý. Nếu host có giới hạn body 4.5MB như Vercel Functions, client nén ảnh JPEG/PNG về <=3MB. HEIC >3MB phải đổi sang JPEG trước khi upload; chưa hỗ trợ signed direct upload cho HEIC lớn. Server chấp nhận tối đa 12MB và ảnh <=64MP; HEIC được giải mã bởi heic-convert, EXIF được chuẩn hóa bằng sharp. Phiên staging cho phép tối đa 400 lượt upload/giờ để giới hạn tài nguyên.
4. Guest `/photo`; tracking `/photo/status#id=...&token=...`; admin `/admin/printing`. Fragment giữ secret khỏi HTTP URL; analytics bị tắt khi tải các trang photo/printing, header no-referrer/noindex. Link theo dõi phải mở bằng điều hướng toàn trang. Không chia sẻ link theo dõi cho người khác vì nó là quyền xem trạng thái.

## Setup Mac và CP1500

1. Cắm Mac vào nguồn và CP1500 qua USB; thêm máy in trong Printers & Scanners. Dùng Node.js >=22 từ nguồn chính thức. Giữ Mac không ngủ trong tiệc (`caffeinate -i` trong một terminal riêng).
2. Chạy `node tools/photo-print/station.mjs --list-printers` để lấy tên CUPS. Không đoán tên máy in, PageSize hoặc giá trị borderless.
3. Tạo thư mục `~/Library/Application Support/WeddingPhotoPrint/` rồi sao chép `tools/photo-print/config.example.json` thành `config.json` ở đó. Điền origin HTTPS, UUID ngẫu nhiên cho station_id, station token giống server và tên máy in. Chỉ token trạm trên Mac, không service-role key.
4. Chạy `node tools/photo-print/station.mjs --check`: chỉ đọc trạng thái máy và `lpoptions -l`, chưa in. Chọn giá trị postcard thực tế (100x148mm) được máy hỗ trợ; lưu trong `options`. Không dùng nguyên giá trị placeholder trong example. Thử fit/full-bleed, không banner, một bản, hướng dọc/ngang; driver có thể cắt mép nên kiểm tra ảnh có mặt gần cạnh.
5. In thử ít nhất 10 ảnh (qua ứng dụng ảnh/macOS trước để xác minh cấu hình, sau đó qua hàng đợi), kiểm tra crop/màu, hết giấy, mất mạng, dừng và khởi động lại worker. Với test hàng đợi, bật hardware_verified ở config và server sau khi cấu hình vật lý đã xác minh; chỉ mở nhận trong ca test có người trực, rồi tạm dừng cho đến tiệc.
6. Đặt `hardware_verified:true` trong config sau khi kiểm tra cấu hình. Chạy `node tools/photo-print/station.mjs` bằng terminal để thử. Worker lấy yêu cầu duyệt mỗi 3 giây, heartbeat 5 giây. Không mở cổng inbound trên Mac.
7. Khi muốn chạy nền: `node tools/photo-print/service.mjs install` rồi `node tools/photo-print/service.mjs start`. Dừng bằng `stop`, gỡ LaunchAgent bằng `uninstall`. Cấu hình và nhật ký vẫn được giữ. Node phải giữ nguyên đường dẫn sau khi cài service; nếu đổi runtime, cài lại LaunchAgent.
8. Bật `PHOTO_PRINT_HARDWARE_VERIFIED=true` trên server và mở nhận trong admin sau nghiệm thu. Bấm In từng yêu cầu; khi ảnh giấy ra, bấm Xác nhận ảnh sẵn sàng. Không coi việc CUPS nhận lệnh là ảnh đã in xong.

## Quota và xử lý sự cố

- Tổng ngân sách 100 bản; pending giữ một suất. Từ chối pending/approved trước claim trả suất. In lại tiêu thụ thêm một suất; số request gốc có thể ít hơn 100 nếu có bản in lại.
- Chỉ một lệnh đang xử lý. Worker không nhận tiếp khi server còn claimed/submitting/submitted/review, hoặc CUPS còn job chưa hoàn tất. Sau khi xác nhận ảnh sẵn sàng, hàng đợi tiếp tục.
- Nếu trạm mất kết nối trước ACK, claim sau 120 giây chuyển Cần kiểm tra. Restart chỉ gửi lại ACK hoặc báo review, không gửi lại lệnh lp.
- Với review: kiểm tra ảnh giấy và Print Queue; dừng/hủy lệnh CUPS cũ trước khi bấm In lại. Nếu ảnh đã ra, xác nhận sẵn sàng. Nếu chưa ra, In lại sau kiểm tra (dùng thêm suất). Không reset nhật ký hoặc chạy hai worker.
- Lệnh in lại/từ chối/duyệt có operation_key để retry không nhân đôi. Trạm thứ hai có station_id khác bị chặn khi trạm hiện tại còn online.
- Nhật ký ở `~/Library/Application Support/WeddingPhotoPrint/jobs/`, gồm mã lệnh CUPS; config/journal permission 0600. Không đưa thư mục này vào Git; ảnh riêng tư được tải về Mac nên bảo quản như ảnh khách.
- Kiểm tra bộ đếm server, lỗi và last_seen trong admin; offline >15 giây. Khi mất Internet, yêu cầu đã lưu chờ đến khi kết nối lại. Không hứa thời gian nhận ảnh dựa trên giả định.

## Kiểm chứng source và giới hạn

- `npm run test:photo`: PostgreSQL nhúng PGlite thực thi migration/RPC/RLS, 100 concurrent callers (được PGlite tuần tự hóa), quota/idempotency/state, ảnh EXIF/crop và worker crash/ACK. Chưa là stress test nhiều PostgreSQL connections trên production.
- `npm run test:photo:api`: chạy Next API thật trong workspace tạm, PGlite và HTTP adapter Storage/PostgREST phục vụ fixture; không liên hệ Supabase production hoặc máy in. Kiểm tra upload → lưu → token → duyệt → claim/report → ready/reprint.
- `npm run lint` / `npm run build`; tách lỗi cũ khỏi lỗi của feature.
- Nghiệm thu thiết bị bắt buộc: iPhone Safari và Android Chrome camera/picker/HEIC/crop; đúng Mac/CP1500 in >=10 ảnh. Test server/local desktop không thay thế nghiệm thu này.
- Updated 2026-10-02: Next.js and eslint-config-next 16.3.8; full/production audit zero vulnerabilities. Build, lint and photo tests passed. Patch not deployed.

## Retention

Ảnh staging có token hết hạn 1 giờ; ảnh yêu cầu giữ riêng tư để in lại trong sự kiện. Không có auto-delete dữ liệu khách. Sau sự kiện xuất/backup dữ liệu cần giữ rồi dọn theo chính sách được chủ website xác nhận. Asset mồ côi sau lỗi RPC không rõ được giữ lại thay vì xóa nhầm ảnh đã commit; khi dọn phải đối chiếu storage_path trong bảng request trước.

## QR tại bàn in

`public/photo-qr.svg` trỏ tới `https://www.project69hd.xyz/photo`. Nếu đổi domain, chạy `node tools/photo-print/qr.mjs https://DOMAIN/photo` rồi kiểm tra đường dẫn. Chỉ in và chia sẻ QR sau khi trang đã triển khai, mở được từ điện thoại và trạm Mac đã qua nghiệm thu vật lý. QR không chứa token quản trị hoặc token xem ảnh.
