/* ==========================================================
   Monian · 图片处理
   上传即压缩为 WebP/JPEG dataURL，直接存进 site.json
   这样不依赖图床、不用额外上传通道，访客打开就能看到
   ========================================================== */

const MAX_KB = { avatar: 150, cover: 320, icon: 40 };

/** 读文件 → 等比缩放 → 编码为 dataURL */
export function compressImage(file, kind = 'cover') {
  const limit = MAX_KB[kind] || 320;
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('请选择图片文件'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片无法解析，换一张试试'));
      img.onload = () => {
        const box = kind === 'avatar' ? 400 : kind === 'icon' ? 160 : 1600;
        const scale = Math.min(1, box / Math.max(img.width, img.height));
        let w = Math.round(img.width * scale);
        let h = Math.round(img.height * scale);

        /* 逐步降质量/降尺寸，直到体积达标或触底 */
        let quality = 0.86;
        let out = draw(img, w, h, quality);
        while (sizeKB(out) > limit && quality > 0.42) {
          quality -= 0.12;
          out = draw(img, w, h, quality);
          if (sizeKB(out) <= limit) break;
          w = Math.round(w * 0.88); h = Math.round(h * 0.88);
          if (w < 80 || h < 80) break;
        }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function draw(img, w, h, quality) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  /* 带透明通道的优先 WebP，否则 JPEG 体积更小 */
  const webp = c.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return webp;
  return c.toDataURL('image/jpeg', quality);
}

function sizeKB(dataUrl) {
  const i = dataUrl.indexOf(',');
  return Math.round((dataUrl.length - i - 1) * 0.75 / 1024);
}

/** 预览用：把 dataURL / 远程地址统一成可显示的 src */
export function srcOf(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^(data:|https?:|blob:)/i.test(s) || s.startsWith('/')) return s;
  return s; // 相对路径原样交给浏览器
}
