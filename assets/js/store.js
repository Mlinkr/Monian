/* ==========================================================
   Monian · 数据层
   · 读：静态 data/site.json（任何人可见）
   · 写：GitHub Contents API（仅登录本人的 token 可写）
   ========================================================== */

const OWNER = 'Mlinkr';
const REPO = 'Monian';
const BRANCH = 'main';
const PATH = 'data/site.json';
const API = 'https://api.github.com';

export const emptyData = () => ({
  version: 1,
  profile: { name: 'Monian', tagline: '', avatar: '', cover: '', chips: [], bio: '' },
  links: [],
  updatedAt: '',
});

export const store = {
  data: emptyData(),
  sha: null,          // 远端文件 sha，提交时用于冲突校验
  dirty: false,       // 有未发布修改
  editing: false,     // 是否处于编辑态
  token: '',          // 本人 GitHub token（只存浏览器本地）
  user: null,         // { login, avatar_url }
  saving: false,
};

/* ---------- 本地缓存：未发布的内容刷新不丢 ---------- */
const DRAFT_KEY = 'monian:draft';

export function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: store.data, at: Date.now() }));
  } catch { /* 隐私模式或超限时忽略 */ }
}
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw).data || null;
  } catch { return null; }
}
export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/* ---------- 读取 ---------- */
export async function loadSite() {
  const res = await fetch(`data/site.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`读取 data/site.json 失败（HTTP ${res.status}）`);
  const json = await res.json();
  return normalize(json);
}

/** 兜底补字段，避免旧数据缺键导致渲染报错 */
export function normalize(raw = {}) {
  const d = emptyData();
  const p = raw.profile || {};
  d.profile = {
    name: String(p.name || 'Monian'),
    tagline: String(p.tagline || ''),
    avatar: String(p.avatar || ''),
    cover: String(p.cover || ''),
    chips: Array.isArray(p.chips) ? p.chips.filter(Boolean).map(String) : [],
    bio: String(p.bio || ''),
  };
  d.links = Array.isArray(raw.links)
    ? raw.links.filter(l => l && (l.title || l.url)).map(l => ({
        id: String(l.id || uid()),
        platform: String(l.platform || 'auto'),
        title: String(l.title || ''),
        desc: String(l.desc || ''),
        url: String(l.url || ''),
        icon: String(l.icon || ''),
      }))
    : [];
  d.updatedAt = String(raw.updatedAt || '');
  return d;
}

export function uid() {
  return 'l-' + Math.random().toString(36).slice(2, 9);
}

/* ---------- 写入 GitHub ---------- */
function headers() {
  return {
    Authorization: `Bearer ${store.token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

/** 读取远端文件当前 sha（发布前对齐，避免 409） */
async function remoteSha() {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`, { headers: headers() });
  if (!res.ok) throw new Error(res.status === 401 ? 'Token 无效或已过期' : `读取远端失败（${res.status}）`);
  const json = await res.json();
  return json.sha;
}

/** 把当前数据提交到仓库；图片已在前端压缩成 dataURL 一并写入 */
export async function publish() {
  if (!store.token) throw new Error('未登录，无法发布');
  store.saving = true;
  try {
    const sha = await remoteSha();
    const payload = { ...store.data, updatedAt: new Date().toISOString() };
    const body = {
      message: `update site.json · ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
      content: b64encode(JSON.stringify(payload, null, 2)),
      sha,
      branch: BRANCH,
    };
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${PATH}`, {
      method: 'PUT', headers: headers(), body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `提交失败（${res.status}）`);
    }
    store.data.updatedAt = payload.updatedAt;
    store.dirty = false;
    clearDraft();
    return true;
  } finally {
    store.saving = false;
  }
}

/* ---------- 登录态：验证 token 是否属于仓库所有者 ---------- */
export async function verifyToken(token) {
  const res = await fetch(`${API}/user`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error('Token 无效或已过期');
  const u = await res.json();
  if (u.login.toLowerCase() !== OWNER.toLowerCase()) {
    throw new Error('这个账号不是站点所有者，只能浏览');
  }
  return { login: u.login, avatar_url: u.avatar_url };
}
