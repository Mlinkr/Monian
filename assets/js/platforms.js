/* ==========================================================
   Monian · 平台表
   只负责：链接 → 平台识别 / 图标字形 / 品牌色
   ========================================================== */

export const PLATFORMS = {
  weibo:       { name: '微博',   badge: '微', color: '#E6162D' },
  xiaohongshu: { name: '小红书', badge: '书', color: '#FF2442' },
  douyin:      { name: '抖音',   badge: '抖', color: '#FE2C55' },
  bilibili:    { name: '哔哩哔哩', badge: 'B', color: '#00A1D6' },
  zhihu:       { name: '知乎',   badge: '知', color: '#0084FF' },
  wechat:      { name: '微信',   badge: '信', color: '#07C160' },
  instagram:   { name: 'Instagram', badge: 'IG', color: '#E1306C' },
  x:           { name: 'X',      badge: 'X',  color: '#1d9bf0' },
  youtube:     { name: 'YouTube', badge: '▶', color: '#FF0000' },
  tiktok:      { name: 'TikTok', badge: 'TT', color: '#25F4EE' },
  github:      { name: 'GitHub', badge: 'GH', color: '#3d3a44' },
  behance:     { name: 'Behance', badge: 'Be', color: '#1769FF' },
  zcool:       { name: '站酷',   badge: '酷', color: '#F85455' },
  netease:     { name: '网易云音乐', badge: '云', color: '#C20C0C' },
  lofter:      { name: 'LOFTER', badge: 'LO', color: '#3B7CFF' },
  pixiv:       { name: 'pixiv',  badge: 'P',  color: '#0096FA' },
  email:       { name: '邮箱',   badge: '@',  color: '#7c5cff' },
  link:        { name: '链接',   badge: '↗',  color: '#7c5cff' },
};

/* 域名 → 平台 key，顺序敏感：先匹配更具体的域名 */
const RULES = [
  [/(^|\.)weibo\.(com|cn)/i, 'weibo'],
  [/xiaohongshu\.com|xhslink\.com|xhslink\.cn/i, 'xiaohongshu'],
  [/douyin\.com|iesdouyin\.com/i, 'douyin'],
  [/bilibili\.com|b23\.tv/i, 'bilibili'],
  [/zhihu\.com/i, 'zhihu'],
  [/weixin\.qq\.com|mp\.weixin/i, 'wechat'],
  [/instagram\.com/i, 'instagram'],
  [/(^|\.)(x|twitter)\.com/i, 'x'],
  [/youtube\.com|youtu\.be/i, 'youtube'],
  [/tiktok\.com/i, 'tiktok'],
  [/github\.com|github\.io/i, 'github'],
  [/behance\.net/i, 'behance'],
  [/zcool\.com\.cn/i, 'zcool'],
  [/music\.163\.com/i, 'netease'],
  [/lofter\.com/i, 'lofter'],
  [/pixiv\.net/i, 'pixiv'],
  [/^mailto:|^[^\s@]+@[^\s@]+\.[^\s@]+$/i, 'email'],
];

/** 由链接推断平台 */
export function detectPlatform(url = '') {
  const u = String(url).trim();
  for (const [re, key] of RULES) if (re.test(u)) return key;
  return 'link';
}

/** 补全协议；裸邮箱转 mailto */
export function normalizeUrl(raw = '') {
  let u = String(raw).trim();
  if (!u) return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u;
  if (!/^https?:\/\//i.test(u) && !/^mailto:/i.test(u) && !/^\//.test(u)) u = 'https://' + u;
  return u;
}

/** 取平台配置，未知平台回落到通用链接样式 */
export function platformOf(key) {
  return PLATFORMS[key] || PLATFORMS.link;
}
