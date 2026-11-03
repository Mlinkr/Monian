/* ==========================================================
   Monian · 站点图标
   把当前头像（dataURL / 远程地址）画成正方形 PNG，
   用于 <link rel=icon> 与 manifest，保证「加到主屏幕」显示的就是头像
   ========================================================== */

/** 载入图片（支持 dataURL 与跨域图片，失败时 reject） */
function loadImage(src, { crossOrigin = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('empty'));
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed'));
    img.src = src;
  });
}

/**
 * 把图片绘制成 size×size 的方形 PNG dataURL
 * @param {HTMLImageElement} img
 * @param {number} size
 * @param {boolean} rounded 是否加圆角（iOS 会自己裁圆，安卓 maskable 需要留边）
 */
function toSquarePng(img, size, { rounded = false, pad = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, size, size);

  const inner = size - pad * 2;
  /* 等比铺满并居中裁切（cover） */
  const s = Math.max(inner / img.width, inner / img.height);
  const w = img.width * s;
  const h = img.height * s;
  const x = pad + (inner - w) / 2;
  const y = pad + (inner - h) / 2;

  if (rounded) {
    const r = size * 0.22;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, 0, size, size, r) : ctx.rect(0, 0, size, size);
    ctx.clip();
  }
  ctx.drawImage(img, x, y, w, h);
  return c.toDataURL('image/png');
}

/** 首字母兜底图标（没有头像时用名字首字） */
export function letterIcon(name = 'M', size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#6a95b5');
  g.addColorStop(1, '#7fb5c4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${size * 0.44}px "Bodoni Moda", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(name).trim().slice(0, 1).toUpperCase() || 'M', size / 2, size * 0.54);
  return c.toDataURL('image/png');
}

/**
 * 由头像地址生成一组图标
 * @returns {{png192:string, png512:string, png180:string, maskable:string, dataUrl:string}}
 *          dataUrl 是 192 的，用于直接写进 <link rel=icon>
 */
export async function buildIcons(avatar, name = 'M') {
  let img = null;
  try {
    img = await loadImage(avatar, { crossOrigin: /^https?:/i.test(avatar) });
  } catch {
    img = null;
  }

  if (!img) {
    const fallback = letterIcon(name, 512);
    const fb = await loadImage(fallback);
    return {
      png192: toSquarePng(fb, 192),
      png512: toSquarePng(fb, 512),
      png180: toSquarePng(fb, 180),
      maskable: toSquarePng(fb, 512, { pad: 72 }),
      dataUrl: fallback,
    };
  }

  return {
    png192: toSquarePng(img, 192),
    png512: toSquarePng(img, 512),
    png180: toSquarePng(img, 180),
    /* maskable 需要安全边距，否则安卓会裁掉头像边缘 */
    maskable: toSquarePng(img, 512, { pad: 72 }),
    dataUrl: toSquarePng(img, 192),
  };
}

/** 即时更新页面上的标签页图标（不必等发布） */
export function applyFavicon(dataUrl) {
  if (!dataUrl) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.sizes = '192x192';
  link.href = dataUrl;

  let apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    document.head.appendChild(apple);
  }
  apple.href = dataUrl;
}

/** dataURL → { base64, size }，供 GitHub API 直接提交 */
export function dataUrlToBase64(dataUrl) {
  const i = dataUrl.indexOf(',');
  return dataUrl.slice(i + 1);
}
