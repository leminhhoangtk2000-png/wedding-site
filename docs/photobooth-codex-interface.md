> Implemented film contract: see [photo-film-presets.md](photo-film-presets.md). The sections below describe the original Antigravity handoff; localStorage and client-computed color are no longer authoritative. The implementation stores versioned server presets and resolves colors on the server. Frame aperture geometry below remains valid.

# Giao Diện Tích Hợp Backend Photobooth (Codex Interface Spec)

Tài liệu này xác định giao diện dữ liệu, thông số kỹ thuật xử lý ảnh và các điểm phối hợp giữa UI Photobooth (`/photo` & `/admin/printing`) và hệ thống backend / in ấn (Codex).

---

## 1. Tổng Quan Kiến Trúc & Quy Trình

```
Khách (/photo)
  ├── 1. Tải ảnh lên -> POST /api/photo/uploads (nhận upload_id, upload_token, temp image)
  ├── 2. Căn khung (Portrait / Landscape + normalized crop)
  ├── 3. Chọn tone màu film (4 presets + 3 slider khách)
  ├── 4. Xem lại bản in hoàn chỉnh có khung & thông số
  └── 5. Gửi in -> POST /api/photo/requests (idempotent request_key, tracking_token)
         │
         ▼
Backend (Codex / Sharp / PGlite / CUPS)
  ├── Lưu DB photo_requests (trạng thái 'pending', trừ hạn mức quota 100 ảnh)
  ├── Render ảnh in hoàn chỉnh (Sharp composite ảnh khách lồng dưới khung hoa Figma)
  └── Trạm in Mac CUPS kéo lệnh -> Canon Selphy CP1500 (in 1 mặt, 300 DPI)
         │
         ▼
Admin (/admin/printing)
  ├── Cấu hình màu preset trước tiệc cưới (lưu localStorage / DB)
  ├── Giám sát hàng đợi FIFO & trạm in Mac
  ├── Xem trước bản in hoàn chỉnh (lightbox preview_url từ backend)
  └── Duyệt in (approve) / Từ chối (reject) / In lại (reprint)
```

---

## 2. Đặc Tả Khung Ảnh (Frame Specifications)

Khung được trích xuất và chuẩn hóa từ Figma Wedding Asset ([node 172-2](https://www.figma.com/design/NoBTIbRYTmtPf1Z62Fex5A/Wedding-Asset?node-id=172-2)):
- **Phong cách**: Nền kem (`#FDFAF5`), viền hoa vintage mềm mại, chữ calligraphy "Minh Hoàng 💍 Hạnh Duyên" và ngày cưới "03.10.2026".
- **Vị trí ảnh**: Nằm trong cửa sổ (aperture) trong suốt ở giữa.
- **Quy tắc bất biến**: Màu film và hiệu ứng chỉ áp dụng cho ảnh của khách; **khung hoa văn, giấy nền kem và chữ typography giữ nguyên 100% màu gốc**.

### Kích thước & Tọa độ cửa sổ (Aperture):

| Chiều | Kích thước Frame (px) | Tỷ lệ | Tọa độ Cửa sổ Ảnh (px) | Kích thước Cửa sổ Ảnh (px) | Tỷ lệ Cửa sổ |
|---|---|---|---|---|---|
| **Khổ Ngang (Landscape)** | 1748 × 1181 | 148 / 100 (1.48) | x = 245, y = 205 (14.02%, 17.36%) | w = 1258, h = 850 (71.97%, 71.97%) | 1.48 |
| **Khổ Dọc (Portrait)** | 1181 × 1748 | 100 / 148 (0.6757) | x = 178, y = 264 (15.07%, 15.10%) | w = 824, h = 1220 (69.77%, 69.79%) | 0.6754 |

- **Asset files**:
  - `public/images/photobooth-frame-landscape.png` (bản sao tại `src/lib/photo/assets/photobooth-frame-landscape.png`)
  - `public/images/photobooth-frame-portrait.png` (bản sao tại `src/lib/photo/assets/photobooth-frame-portrait.png`)

---

## 3. Cấu Trúc Payload Mở Rộng: `POST /api/photo/requests`

UI frontend hiện tại gửi payload tương thích ngược và bổ sung metadata `filter`:

```json
{
  "upload_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "upload_token": "cfd076d29944f77c3857321ee7b60e68d0674c93540bf554",
  "request_key": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "tracking_token": "1057e937-2cf3-487c-87d2-7ec97e2ec313",
  "guest_name": "Nguyễn Văn A",
  "orientation": "portrait",
  "crop": {
    "x": 0.150,
    "y": 0.100,
    "width": 0.700,
    "height": 0.800
  },
  "filter": {
    "preset_id": "warm_film",
    "preset_name": "Film ấm",
    "adjustments": {
      "intensity": 100,
      "brightness": 5,
      "warmth": 10
    },
    "computed": {
      "brightness": 10,
      "warmth": 36,
      "contrast": 8,
      "saturation": -6,
      "fade": 10,
      "grain": 16
    }
  }
}
```

### Giải thích các trường `filter`:
- `preset_id`: Mã preset (`natural`, `warm_film`, `vintage_soft`, `bw_classic`).
- `preset_name`: Tên hiển thị tiếng Việt của preset để in ra nhãn và hiển thị trong admin queue.
- `adjustments`: 3 thông số khách tinh chỉnh trực tiếp trên điện thoại:
  - `intensity`: 0 đến 100% (mặc định 100)
  - `brightness`: -50 đến +50 (mặc định 0)
  - `warmth`: -50 đến +50 (mặc định 0)
- `computed`: Giá trị tổng hợp 6 thông số sau khi nhân tỉ lệ cường độ của khách với preset chuẩn (để backend Sharp áp dụng trực tiếp):
  - `brightness`: -50 đến +50
  - `warmth`: -50 đến +50
  - `contrast`: -50 đến +50
  - `saturation`: -100 đến +50
  - `fade`: 0 đến 50
  - `grain`: 0 đến 50

---

## 4. Hướng Dẫn Render Sharp Trên Backend (Codex Composite Pipeline)

Khi xử lý lệnh in hoặc tạo `preview_url` hoàn chỉnh có khung:

```javascript
import sharp from 'sharp';
import path from 'path';

export async function renderPrintPhoto({ originalBuffer, orientation, crop, filter }) {
  const isPortrait = orientation === 'portrait';
  const framePath = path.join(process.cwd(), 'public/images', 
    isPortrait ? 'photobooth-frame-portrait.png' : 'photobooth-frame-landscape.png'
  );

  const targetWidth = isPortrait ? 1181 : 1748;
  const targetHeight = isPortrait ? 1748 : 1181;
  const aperture = isPortrait
    ? { left: 178, top: 264, width: 824, height: 1220 }
    : { left: 245, top: 205, width: 1258, height: 850 };

  // 1. Trích xuất vùng crop từ ảnh gốc
  const meta = await sharp(originalBuffer).metadata();
  const extractRegion = {
    left: Math.round(crop.x * meta.width),
    top: Math.round(crop.y * meta.height),
    width: Math.round(crop.width * meta.width),
    height: Math.round(crop.height * meta.height),
  };

  let photoPipeline = sharp(originalBuffer)
    .extract(extractRegion)
    .resize(aperture.width, aperture.height, { fit: 'fill' });

  // 2. Áp dụng hiệu ứng màu sắc (chỉ tác động lên ảnh khách)
  const c = filter?.computed || {};
  if (c.brightness || c.saturation) {
    photoPipeline = photoPipeline.modulate({
      brightness: 1 + (c.brightness || 0) * 0.007,
      saturation: Math.max(0, 1 + (c.saturation || 0) * 0.01),
    });
  }

  // 3. Ghép ảnh khách nằm dưới khung hoa
  const photoBuffer = await photoPipeline.png().toBuffer();

  const finalComposite = await sharp({
    create: {
      width: targetWidth,
      height: targetHeight,
      channels: 4,
      background: '#FDFAF5FF', // Nền giấy kem chuẩn
    }
  })
  .composite([
    // Lớp 1: Ảnh khách căn đúng vào cửa sổ
    { input: photoBuffer, left: aperture.left, top: aperture.top },
    // Lớp 2: Khung hoa và chữ calligraphy đè lên trên
    { input: framePath, left: 0, top: 0, blend: 'over' }
  ])
  .jpeg({ quality: 98 })
  .toBuffer();

  return finalComposite;
}
```

---

## 5. Quy Định Ràng Buộc Phần Cứng (Canon Selphy CP1500)

1. **In 1 mặt**: Canon Selphy CP1500 là máy in nhiệt nhuộm thăng hoa (dye-sublimation) chỉ hỗ trợ in một mặt khổ giấy bưu thiếp 100×148 mm (4×6 inch). **Không bổ sung tùy chọn in 2 mặt**.
2. **Khổ giấy & DPI**:
   - Landscape: 148 × 100 mm (1748 × 1181 px @ 300 DPI)
   - Portrait: 100 × 148 mm (1181 × 1748 px @ 300 DPI)
3. **Hardware Lock & Quota**:
   - `PHOTO_PRINT_HARDWARE_VERIFIED=true`: Yêu cầu kiểm tra phần cứng trước khi mở nhận ảnh.
   - Hạn mức: Cố định 100 lượt in mỗi sự kiện tiệc cưới. Lệnh duyệt in (`approve`) trừ hạn mức, từ chối (`reject`) hoàn trả hạn mức, in lại (`reprint`) tiêu hao thêm 1 lượt.
