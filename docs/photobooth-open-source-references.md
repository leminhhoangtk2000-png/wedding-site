# Tham khảo mã nguồn mở cho photobooth theo hướng Dazz Cam

Ngày kiểm tra: 2026-10-02. Phạm vi: màu film cho ảnh điện thoại sRGB, thumbnail, grain và JPEG gửi in. Đây là nghiên cứu nguồn và mã, chưa chạy/benchmark các ứng dụng bên thứ ba trên điện thoại hoặc CP1500.

## Nguồn đã kiểm tra

| Dự án | Bằng chứng | Phù hợp với website | Giới hạn |
| --- | --- | --- | --- |
| [GrainLab](https://github.com/seamys/grainlab) | Vue/TypeScript, bộ preset có Fuji Superia/C200/Velvia và CineStill; mã preset, grain và LICENSE đã đọc | Tham khảo gần nhất cho web: tách màu, tone curve và texture; so sánh ảnh trước/sau | Thông số là lựa chọn của tác giả, chưa chứng minh khớp film thật |
| [Film Lab](https://github.com/thedevmark/film-lab) | Python/Flask; HaldCLUT và nội suy tetrahedral; mã LUT và attribution đã đọc | Tham khảo màu sRGB, nội suy giữ trục xám, grain theo seed và kích thước đầu ra | Không dùng trực tiếp runtime Python trong renderer hiện tại; LUT có giấy phép riêng |
| [DAZZ Retro Camera](https://github.com/ganjmeng/dazz-retro-camera) | Flutter + lớp native; preset JSON chia resources và parameters; tài liệu preset và LICENSE đã đọc | Tham khảo cách tổ chức các camera/look với LUT, grain, bloom, frame độc lập | Dự án độc lập, không phải mã nguồn chính thức của Dazz Cam; không phải SDK web và chưa xác minh chất lượng chạy thực tế |
| [RawTherapee Film Simulation](https://rawpedia.rawtherapee.com/Film_Simulation) | Tài liệu chính thức giải thích HaldCLUT và LUT tạo từ chỉnh màu toàn ảnh | Thiết kế nhập LUT/HaldCLUT trong một giai đoạn sau | LUT chỉ biểu diễn màu/tone; grain, blur, halation và hiệu ứng theo vị trí cần xử lý riêng |
| [FujiLUT](https://github.com/sohan-shingade/fujiLUT) | README có recipe, LUT pipeline, .cube và HaldCLUT; API tree đã kiểm tra | Tham khảo mô hình recipe, tone theo kênh và nhóm màu | README ghi MIT nhưng tree được kiểm tra không có LICENSE; chưa đưa mã/asset vào website |

## Mã và giấy phép được kiểm tra tại revision cụ thể

- GrainLab `32010ba410acba067ac8784ec4e2d51713f9c294`: [preset definitions](https://github.com/seamys/grainlab/blob/32010ba410acba067ac8784ec4e2d51713f9c294/src/presets/index.ts), [grain](https://github.com/seamys/grainlab/blob/32010ba410acba067ac8784ec4e2d51713f9c294/src/filters/grain.ts), [MIT license](https://github.com/seamys/grainlab/blob/32010ba410acba067ac8784ec4e2d51713f9c294/LICENSE).
- Film Lab `81aa35ccfd88c8b9125f26a5ac79542ba588af2e`: [LUT interpolation](https://github.com/thedevmark/film-lab/blob/81aa35ccfd88c8b9125f26a5ac79542ba588af2e/filmlab/lut.py), [LUT attribution](https://github.com/thedevmark/film-lab/blob/81aa35ccfd88c8b9125f26a5ac79542ba588af2e/luts/open/ATTRIBUTION.md). Repo code is MIT; its Kodak Gold LUT attribution states CC BY-SA 4.0. No bundled LUT was imported.
- DAZZ Retro Camera `c8a7f269900cacfb9388d0beb3998036af1f5104`: [preset model](https://github.com/ganjmeng/dazz-retro-camera/blob/c8a7f269900cacfb9388d0beb3998036af1f5104/docs/preset-design.md), [MIT license](https://github.com/ganjmeng/dazz-retro-camera/blob/c8a7f269900cacfb9388d0beb3998036af1f5104/LICENSE).
- FujiLUT tree `f3bead9b6d8dbc3f8ea489b70850fbc42fb4db46`: README checked; no license file in recursive tree. Treat this as a research reference pending a complete reuse grant.

## Áp dụng vào thay đổi hiện tại

Đề xuất kỹ thuật từ nghiên cứu: mỗi stock cần có palette và tone riêng, màu và texture là các bước độc lập, seed cố định theo ảnh, và kích thước texture tính theo đầu ra. Website đã dùng chung engine cho preview và server JPEG, chỉ xử lý vùng ảnh bên trong khung. Bản mở rộng này bổ sung 5 ID/profile riêng, tone curve và chuyển màu xanh/đỏ/vùng sáng/tối riêng, cường độ khởi đầu 100%, và giữ cấu hình lịch sử.

Bộ mới: Velvia Vivid (rực), Classic Neg. Retro (cyan/đỏ ấm), Nostalgic Neg. Amber (mật ong), ETERNA Bleach Bypass (gần đơn sắc, tương phản mạnh), Sepia Archive (nâu cổ). Đây là các mô phỏng do website tự viết theo hướng đặc tính [Fujifilm công bố](https://www.fujifilm-x.com/global/products/film-simulation/), chưa phải LUT đo được từ camera hay cuộn film. Source code và LUT bên thứ ba chưa được chép vào sản phẩm.

Hướng mở rộng phù hợp: bộ Fuji Superia 400 / C200 và một look tungsten cho tiệc tối, bộ nhập LUT sRGB với metadata giấy phép và checksum, grain có kích thước/texture riêng, halation tùy chọn ở nguồn sáng. Các mục này là đề xuất, chưa nằm trong bản đã thực thi. Không bật light leak hay ngày tháng tự động trên ảnh cưới vì có thể che khuôn mặt và trùng với phần chữ của khung.

## Kiểm chứng hiện tại

- Hai ảnh đã có trên website: `000047.webp` (trong nhà) và `000040.webp` (ngoài trời). Đây là ảnh đã chỉnh màu, chưa phải ảnh camera mới chụp ở tiệc tối.
- `node tools/photo-film/compare.mjs [local-image-path] [output-directory]`: tạo JPEG bằng renderer gửi in rồi trích vùng ảnh làm bảng so sánh; khung hoa được kiểm tra riêng trong tests.
- Kiểm tra thông số màu, phục hồi cường độ 0, vùng trắng, khác biệt giữa stock, cấu hình lịch sử, snapshot, retry và JPEG. Không khẳng định khớp Dazz Cam, Fujifilm hay màu giấy CP1500 từ kiểm tra phần mềm.
