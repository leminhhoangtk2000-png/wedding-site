/**
 * Client-side precompression for wedding photo print queue.
 * Complies with Vercel/server 4.5MB payload limits by ensuring images are <= 3MB.
 */

export async function processImageForUpload(file) {
  if (!file) throw new Error('Không có tệp ảnh nào được chọn.');

  const isHeic =
    /\.hei[cf]$/i.test(file.name) ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';

  const sizeMb = file.size / (1024 * 1024);

  // HEIC check
  if (isHeic) {
    if (file.size > 3 * 1024 * 1024) {
      return {
        ok: false,
        code: 'HEIC_OVERSIZE',
        error: `Ảnh HEIC (${sizeMb.toFixed(1)}MB) vượt quá giới hạn 3MB của trạm in. Vui lòng xuất hoặc đổi sang định dạng JPEG trước khi tải lên.`,
      };
    }
    // Small HEIC (<=3MB) is accepted directly and converted on backend
    return { ok: true, file, isHeic: true };
  }

  // If already <= 3MB, upload as-is
  if (file.size <= 3 * 1024 * 1024) {
    return { ok: true, file, compressed: false };
  }

  // Precompress standard image (JPEG, PNG, WebP) to <= 3MB
  try {
    const compressedFile = await compressStandardImage(file, 3 * 1024 * 1024);
    if (compressedFile && compressedFile.size <= 3 * 1024 * 1024) {
      return { ok: true, file: compressedFile, compressed: true };
    }
    return {
      ok: false,
      code: 'IMAGE_OVERSIZE_CANNOT_COMPRESS',
      error: `Ảnh có dung lượng ${sizeMb.toFixed(1)}MB vượt quá giới hạn 3MB và không thể tự động nén đủ nhỏ. Vui lòng chọn ảnh khác hoặc giảm dung lượng trước khi tải lên.`,
    };
  } catch (err) {
    return {
      ok: false,
      code: 'IMAGE_COMPRESSION_FAILED',
      error: `Ảnh có dung lượng ${sizeMb.toFixed(1)}MB không thể nén xuống dưới 3MB (${err.message || 'lỗi xử lý'}). Vui lòng chọn ảnh khác.`,
    };
  }
}

async function compressStandardImage(file, maxBytes) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;
        if (!origWidth || !origHeight) {
          reject(new Error('Kích thước ảnh không hợp lệ'));
          return;
        }

        // Try adaptive dimensions if needed: 2400 -> 1800 -> 1400 -> 1000
        const dimensionTargets = [2400, 1800, 1400, 1000];
        let finalBlob = null;

        for (const maxDim of dimensionTargets) {
          let width = origWidth;
          let height = origHeight;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          // Fill white background for transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Quality reduction iteration
          const qualities = [0.85, 0.75, 0.65, 0.50, 0.38];
          for (const quality of qualities) {
            const blob = await new Promise((res) =>
              canvas.toBlob(res, 'image/jpeg', quality)
            );
            if (blob && blob.size <= maxBytes) {
              finalBlob = blob;
              break;
            }
          }

          if (finalBlob && finalBlob.size <= maxBytes) {
            break;
          }
        }

        if (finalBlob && finalBlob.size <= maxBytes) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const newFile = new File([finalBlob], cleanName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(newFile);
        } else {
          reject(new Error('Dung lượng sau nén vẫn vượt 3MB'));
        }
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được tệp ảnh'));
    };

    img.src = url;
  });
}
