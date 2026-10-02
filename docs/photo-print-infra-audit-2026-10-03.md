# Audit photo, printing và hạ tầng cho 100 người

Thời điểm: 03/10/2026, khoảng 00:00–00:10, Asia/Ho_Chi_Minh.
Production: https://www.project69hd.xyz. Audit source hiện tại, gồm các thay đổi chưa commit; không sửa implementation, deploy, migration hay tạo job in production.

## Kết luận

**Chưa đủ điều kiện nghiệm thu toàn luồng cho 100 người.** Một đợt đọc trạng thái với 100 HTTP requests đồng thời thành công, nhưng có lỗ hổng authentication đang tồn tại trên production, migration film thiếu, printing chưa thiết lập, và chưa có test tải upload/render trên cấu hình production tương đương.

100 người gửi ảnh trong một sự kiện khác với 100 người upload cùng một thời điểm. Cả hai khác với khả năng in xong 100 ảnh trong thời gian ngắn. Một CP1500 và state machine hiện tại xử lý từng job, cần xác nhận ảnh giấy trước khi tiến tiếp.

## Phát hiện theo mức độ

### P0 — API admin chấp nhận hai mật khẩu ghi cứng

- Source: `src/lib/photo/server.js:12–18`. Có password fallback và hai credential được chấp nhận ngoài `ADMIN_PASSWORD`.
- Kiểm chứng live: GET `/api/admin/printing` không credential trả 401; cả hai credential ghi cứng trả 200. Chỉ đọc response, không lưu ảnh hay thông tin khách vào báo cáo.
- Hậu quả: người biết credential có thể đọc tên/ảnh khách qua signed URL; source cho phép các thao tác pause, resume, reject, sửa ảnh và các thao tác in tùy hardware gate. Hardware gate không bảo vệ quyền đọc hay reject.
- Cần bỏ mọi credential dự phòng, yêu cầu secret cấu hình đủ mạnh, rà soát cùng cơ chế trong các API admin khác. Bổ sung rate limit authentication và test credential cũ phải trả 401 ngay cả khi có secret hợp lệ.

### P1 — Production thiếu migration film nhưng API fallback báo thành công

- Live Supabase: `photo_print_preset_versions` trả PGRST205; `photo_print_film_command` trả PGRST202; select `photo_print_requests.filter_snapshot` trả 42703 (column không tồn tại).
- Live `/api/photo/status` vẫn trả preset version 1, 7 presets. Source/test hiện tại có film version 3 với 12 presets trước khi operator chỉnh.
- `src/lib/photo/server.js:28–36`: thiếu film RPC thì config trả defaults; `save_presets` trả version tăng và settings dù không persist; create fallback sang queue RPC không lưu film snapshot.
- Hậu quả: lưu settings có thể báo thành công rồi mất; request mất provenance của cấu hình render. Không nên coi response 200 là bằng chứng preset đã persist.
- Cần migration và deployment theo một release có thứ tự rõ ràng; thiếu schema phải báo unavailable. Kiểm tra save → reload → guest config → snapshot đã lưu trên DB sau deploy.

### P1 — Printing chưa sẵn sàng trên thiết bị thật

- Live session `accepting=true`, `intake_only=true`; 4 pending và 1 rejected tại thời điểm đọc. Không có station record.
- Mac config `hardware_verified=false`, media option còn placeholder. `lpstat -p -d` báo không có printer destination và không có default printer trên Mac được audit.
- Guest intake có thể chạy; việc nhận ảnh không chứng minh in được. Source chặn approve/reprint/ready và station claim/begin khi hardware chưa verified.
- Cần cấu hình đúng CP1500/CUPS, khổ postcard thực, driver options, USB, nguồn điện và chống sleep. In ít nhất 10 ảnh thật, gồm hết giấy, mất mạng và restart. Chỉ bật hardware flag sau nghiệm thu.

### P1 — Tải render chưa được khống chế đủ cho burst upload

- Upload normalize và create render chạy đồng bộ trong Next Functions, gồm download/upload Storage; film transform chạy vòng lặp CPU trong Node.
- Upload gate là 400 lần/giờ cho toàn session, không giới hạn số request create hay số render đồng thời. Cùng một upload token còn hạn có thể tạo nhiều request_key khác nhau; đây là đường tiêu thụ compute/storage không bị upload gate khống chế.
- Không thấy concurrency admission, per-client create rate limit, queue render, hay timeout/backoff trong `photoFetch`.
- HEIC decode diễn ra trước khi Sharp áp giới hạn 64MP; không nên suy ra giới hạn pixel Sharp bảo vệ toàn bộ HEIC conversion.
- Cần rate limit bền vững tại intake/create, bảo vệ retry idempotent, giới hạn công việc ảnh đang xử lý; đo CPU/memory với JPEG lớn và HEIC thực tế. Không dùng semaphore in-memory như giới hạn toàn hệ thống serverless.

### P2 — Polling tranh cùng lock, không dừng ở trạng thái cuối

- `GET /api/photo/requests` gọi RPC `session` trước select tracking. Queue RPC lấy `photo_print_session FOR UPDATE` và reconcile expiry cho mọi action, kể cả đọc session/admin_list.
- 100 tracking tabs polling mỗi 5 giây tạo khoảng 20 API requests/giây, 72.000/giờ, và khoảng 40 DB operations/giây chỉ từ tracking (RPC + select).
- Tracking tiếp tục polling khi ready/rejected, khi tab ẩn; không có khóa chống request chồng lấn. Admin cũng polling mỗi 5 giây.
- Cần tách đọc trạng thái khỏi reconcile/mutation lock, dừng polling terminal, pause khi hidden, backoff/jitter và chỉ một request đang chạy mỗi tab. Đây là rủi ro tải; đợt đọc ngắn hiện chưa cho thấy timeout.

### P2 — Dashboard admin tải toàn bộ ảnh mỗi lần refresh

- `src/app/api/admin/printing/route.js:10–15`: không phân trang, ký URL bằng Promise.all cho mọi request mỗi GET. SQL aggregate mọi request và attempts; thiếu index riêng trên `photo_print_attempts.request_id`.
- Với 100 request, một dashboard tạo khoảng 100 signing operations mỗi 5 giây = 72.000/giờ; nhiều operator tabs nhân tải. URL mới có thể làm cache ảnh phía browser kém hiệu quả; chưa đo actual egress.
- Cần pagination/filter server, thumbnail, cache signed URL tới gần expiry, concurrency giới hạn và index request_id. Tách polling trạng thái khỏi payload ảnh đầy đủ.

### P2 — Admin replacement ảnh lớn vượt giới hạn host

- Guest compressor giữ ảnh <=3MiB; HEIC lớn hơn phải đổi JPEG thủ công.
- `AdminRequestEditor.js:108` gửi replacement file trực tiếp; server cho tới 12MiB, không precompress. File >4.5MB có thể bị Vercel từ chối trước khi handler chạy.
- Cần reuse compressor cho admin hoặc signed upload private có validation; thống nhất UI với giới hạn host. Vercel công bố request/response payload tối đa 4.5MB: https://vercel.com/docs/functions/limitations.

### P2 — Draft khôi phục URL ảnh đã hết hạn

- Signed preview có TTL 600 giây; draft lưu nguyên URL và restore sau reload. Upload record có hạn 1 giờ; không có endpoint refresh preview bằng upload token.
- Sau hơn 10 phút rồi reload, dữ liệu upload có thể vẫn hợp lệ nhưng preview không mở được; FilmPhoto error khiến guest không thể xem màu/submit bình thường. Suy luận từ TTL và code, chưa chạy browser chờ 10 phút trong audit này.
- Cần refresh signed preview với upload capability hợp lệ và hiển thị upload expiry rõ ràng.

### P2 — UI che capacity thay vì phản ánh server

- Public status và admin GET ép `capacity` và `remaining` thành null dù DB có thể đang giới hạn.
- Production hiện unlimited, nên chưa gây lỗi live; các fixture vẫn dùng capacity 100. Khi cấu hình quota trở lại, UI không báo full đúng trong khi POST trả FULL.
- Cần trả dữ liệu DB đúng và kiểm tra cả unlimited lẫn bounded quota.

### P2 — Release/test migration chưa đại diện trạng thái production

- API fixture áp base → film → film v2/v3 → safe edit, bỏ migration remove quota và legacy admin edit. Queue test chỉ áp base + film.
- Có nhiều bản đầy đủ thay thế cùng `photo_print_command`; safe edit wrapper yêu cầu áp sau base/quota/film. Không có bằng chứng clean migration pipeline được chạy và verified cho toàn bộ danh sách hiện tại.
- API fixture sau đổi orientation rồi đổi lại vẫn so byte print đã sửa với `originalPrint` trước edit (`tests/photo/api.integration.mjs:186`); expectation cần cập nhật theo bản lưu sau edit. Đây là vấn đề source của test, chưa kết luận là lỗi runtime vì run chưa tới PASS.

## Luồng đã audit

| Chặng | Cơ chế/evidence | Giới hạn kiểm chứng |
|---|---|---|
| Camera/picker → upload | Guest nén <=3MiB, không gửi khi compression thất bại; test compressor pass | Chưa kiểm chứng iPhone Safari/Android Chrome/camera/HEIC vật lý |
| Normalize → private Storage | EXIF rotate, resize <=2400, JPEG, DB upload token hash/expiry | Source + unit pass; không tạo upload production trong audit |
| Crop/film → request | Server validate crop, compute trusted filter, render postcard 300 DPI; request_key/fingerprint/tracking hash | Image/film/queue tests pass; live film schema thiếu |
| Retry/reload | Guest lưu immutable payload trước POST; retry trả request cũ, không tăng suất | Unit/SQL coverage; preview expiry còn lỗi |
| Admin review/edit | Revision check, operation key, pending-only edit, retry fingerprint, preserve unknown-commit asset | Direct handler/DB tests pass; live API deployment thiếu edit_revision trong response đã đọc |
| Approve → claim | SQL lock, operation idempotency, chỉ một active attempt/station | SQL tests pass; hardware live chưa setup |
| Mac → CUPS | Lock PID, journal fsync trước spool; recovery chỉ ACK/review, không spool lại | Worker tests pass; không in thật |
| Submitted → ready → reprint | Ready do người vận hành xác nhận; reprint explicit; expiry không tự requeue | SQL tests pass; cần diễn tập giấy/mạng/printer |
| Privacy/retention | Bucket live private; anon table/RPC đều 42501; tracking token trong fragment/header | Admin credential làm mất bảo vệ đọc; chưa có cleanup/retention tự động |

## Kết quả kiểm tra hiện tại

- `npm run test:photo`: **21/21 pass**, gồm direct admin edit handler, film/image, compressor, queue/RLS và worker crash/ACK. PGlite tuần tự hóa các query; test 100 callers không chứng minh multi-connection Postgres load.
- `npm run lint`: 0 error, 20 warning về img.
- `npm run build`: pass, Next 16.3.8.
- `node tests/photo/api.integration.mjs`: **chưa pass**; standalone run bị kết thúc exit 137, không có PASS marker/diagnostic đủ xác định nguyên nhân. Một lần chạy qua wrapper log cũng không có PASS marker. Không coi shell wrapper exit 0 là test thành công.
- Browser production: `/photo` có camera/library controls; `/admin/printing` mở được màn hình login.
- Live anonymous access tới photo table và queue RPC: denied 42501. Bucket `public=false`, file limit 12MiB.
- Vercel project/team management API: 403 với credential CLI hiện có. Chưa xác minh plan, Fluid Compute, memory, region, usage/quota hay function metrics. Supabase compute tier/region/IO/connection metrics chưa có management evidence. Không suy ra từ Docker config hay public endpoint.

## Đợt tải đọc production

Một wave 100 GET đồng thời vào `/api/photo/status`, timeout client 30 giây. Endpoint có reconcile side effect theo source, nhưng không tạo ảnh/job hay thay accepting. Payload nhỏ, không liên hệ printer.

| Chỉ số | Kết quả |
|---|---:|
| HTTP 200 + success | 100/100 |
| Lỗi | 0 |
| Min | 1.630 ms |
| p50 | 3.009 ms |
| p95 | 3.597 ms |
| p99 | 3.722 ms |
| Max | 5.169 ms |

Đo từ máy audit, gồm network/TLS/cold starts nếu có; không có server metrics để phân rã. Wave này không đại diện tracking liên tục, upload 3MiB, HEIC conversion, render film, admin 100 thumbnails hoặc nhiều PostgreSQL connections trong test fixture.

## Khả năng phục vụ 100 người

- Guest ingress worst-case theo client limit: 100 × 3MiB = 300MiB. Nếu trải trong 5 phút, riêng ingress trung bình khoảng 8,4 Mbit/s trước overhead; nếu cùng 30 giây khoảng 84 Mbit/s. Đây là phép tính, chưa phải đo Wi-Fi tại địa điểm. Storage originals/prints, download server và admin egress là tải bổ sung.
- Tracking 100 người: khoảng 20 req/s nếu mọi tab active. Đợt đọc ngắn pass; cần soak mixed traffic và theo dõi errors/latency/CPU/locks/egress.
- Printing CP1500: Canon công bố postcard glossy khoảng 41 giây/bản. 100 × 41 / 60 ≈ **68,3 phút chỉ cho chu kỳ in**; chưa có duyệt, download, 3-second worker interval, xác nhận ready, thay giấy/mực, lỗi và in lại. Nguồn: https://gdlp01.c-wss.com/gds/2/0300044832/01/SELPHY_CP1500_Advanced_User_Guide_EN.pdf.
- Thêm worker/printer không tăng throughput với state machine hiện tại: global active-attempt gate và singleton station cố ý chặn song song. Muốn nhiều printer phải thiết kế lại station queues và kiểm tra duplicate protection.
- Docker là một container, restart policy và không có healthcheck/resources/autoscale trong compose. `ADMIN_PASSWORD` mặc định yếu còn bị compose environment override env_file nếu shell không set. Đây là fallback local/self-host, không phải evidence topology Vercel đang chạy.

## Điều kiện nghiệm thu đề xuất

1. Sửa P0 authentication và P1 schema/fallback; deploy release tương ứng, verify persist qua reload và xem request snapshot thực.
2. Setup và nghiệm thu Mac/CP1500 cùng camera/picker trên hai hệ điện thoại; operator thực hành ready/review/reprint và mất mạng.
3. Trên môi trường riêng có cùng Vercel/Supabase cấu hình: 100 virtual users upload JPEG/HEIC, crop/filter/create, retry cùng key và keys khác, rồi tracking 15–30 phút; admin mở queue đủ 100 records và thao tác trong lúc tải. Không dùng ảnh khách thật, không gửi printer thật.
4. Ghi nhận plan/memory/region/usage và telemetry: p95/p99 từng endpoint, HTTP 5xx/429, peak memory/CPU, DB lock wait/statement timeout, storage errors và network tại địa điểm. Tiêu chí tối thiểu: 0 duplicate request/spool, 0 mất request đã ACK, 0 corruption/unauthorized access; latency mục tiêu thống nhất trước khi chạy.
5. Chuẩn bị phương án vận hành: nguồn và Mac không sleep, giấy/mực >=100 cộng dự phòng, internet dự phòng, một người duyệt và một người kiểm tra ảnh/đưa khách nếu lượng ảnh cao. Không hứa thời gian chờ ngắn hơn tốc độ hàng đợi thực.

Audit chỉ tạo báo cáo và evidence tải đọc. Các thay đổi implementation đang có trong worktree được giữ nguyên.
