/* ==========================================================
   Monian · 登录鉴权（只允许站点所有者进入编辑态）
   两种方式：
   A. GitHub OAuth 设备码流程 —— 点一下、到 GitHub 输 6 位码，自动回填 token
   B. 手动粘贴 Fine-grained PAT（备用，适合不想授权设备码的场景）
   访客永远只能看：没有 token 就没有编辑入口，写操作也会被 GitHub 拒绝。
   ========================================================== */

import { store, verifyToken } from './store.js';

/* GitHub CLI 的公开 client_id，支持 public_repo 范围，用于设备码流程 */
const CLIENT_ID = '01ab8ac9400c4e429b23';
const SCOPE = 'public_repo';
const LS_TOKEN = 'monian:token';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- A. 设备码流程 ---------- */
async function requestDeviceCode() {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
  });
  if (!res.ok) throw new Error('无法发起 GitHub 授权，请稍后重试');
  return res.json(); // { device_code, user_code, verification_uri, interval, expires_in }
}

async function pollAccessToken(deviceCode, interval, expiresIn, onTick) {
  const deadline = Date.now() + expiresIn * 1000;
  let wait = Math.max(interval, 5);
  while (Date.now() < deadline) {
    await sleep(wait * 1000);
    onTick?.(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    });
    const data = await res.json();
    if (data.access_token) return data.access_token;
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') { wait += 5; continue; }
    if (data.error === 'expired_token') throw new Error('授权码已过期，请重新发起');
    if (data.error === 'access_denied') throw new Error('授权被取消');
    throw new Error(data.error_description || '授权失败');
  }
  throw new Error('授权超时，请重试');
}

/* ---------- token 读写 ---------- */
export function savedToken() {
  try { return localStorage.getItem(LS_TOKEN) || ''; } catch { return ''; }
}
function persistToken(t) {
  try { t ? localStorage.setItem(LS_TOKEN, t) : localStorage.removeItem(LS_TOKEN); } catch { /* ignore */ }
}

/** 用 token 登入并校验身份；成功返回 user */
export async function signIn(token) {
  const user = await verifyToken(token);
  store.token = token;
  store.user = user;
  persistToken(token);
  return user;
}

export function signOut() {
  store.token = '';
  store.user = null;
  store.editing = false;
  persistToken('');
}

/** 页面启动时静默恢复上次登录（校验失败就当没登录） */
export async function restore() {
  const t = savedToken();
  if (!t) return null;
  try {
    return await signIn(t);
  } catch {
    persistToken('');
    return null;
  }
}

/* ---------- 登录面板 UI ---------- */
export function openLogin({ onSuccess, onCancel } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-mask';
  wrap.innerHTML = `
    <div class="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
      <button class="modal-x" data-x aria-label="关闭">✕</button>
      <h3 id="loginTitle">登录以编辑</h3>
      <p class="modal-sub">只有站点所有者能修改内容，访客无需登录、直接浏览。</p>

      <div class="login-alt">
        <button class="btn-solid wide" data-device>用 GitHub 授权登录</button>
        <p class="login-hint">点击后按提示在 GitHub 输入 6 位验证码，完成后自动回到这里。</p>
      </div>

      <div class="login-divider"><span>或粘贴个人访问令牌</span></div>

      <form class="login-pat" data-form>
        <input type="password" name="token" placeholder="ghp_… 或 github_pat_…" autocomplete="off" spellcheck="false" />
        <button class="btn-ghost" type="submit">连接</button>
      </form>
      <p class="login-err" data-err hidden></p>
      <p class="login-note">令牌只保存在你自己的浏览器里，不会写进仓库，也不会被访客拿到。需要 <code>Contents: Read and write</code> 权限。</p>
    </div>`;

  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');

  const errBox = wrap.querySelector('[data-err]');
  const showErr = msg => { errBox.hidden = false; errBox.textContent = msg; };
  const resetErr = () => { errBox.hidden = true; };

  const close = () => { wrap.remove(); document.body.classList.remove('modal-open'); onCancel?.(); };
  wrap.querySelector('[data-x]').onclick = close;
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });

  /* 手动令牌 */
  wrap.querySelector('[data-form]').onsubmit = async e => {
    e.preventDefault();
    resetErr();
    const input = e.target.token;
    const t = input.value.trim();
    if (!t) return showErr('请先粘贴令牌');
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = '验证中…';
    try {
      const user = await signIn(t);
      close();
      onSuccess?.(user);
    } catch (err) {
      showErr(err.message);
    } finally {
      btn.disabled = false; btn.textContent = '连接';
    }
  };

  /* 设备码 */
  wrap.querySelector('[data-device]').onclick = async e => {
    resetErr();
    const btn = e.currentTarget;
    btn.disabled = true;
    const old = btn.textContent;
    try {
      const code = await requestDeviceCode();
      const panel = wrap.querySelector('.login-alt');
      panel.innerHTML = `
        <div class="device-box">
          <div class="device-step">在 GitHub 页面输入这个验证码：</div>
          <div class="device-code" data-code>${code.user_code}</div>
          <button class="btn-ghost" data-copy>复制验证码</button>
          <a class="btn-solid wide" href="${code.verification_uri}" target="_blank" rel="noopener">打开 GitHub 授权页 ↗</a>
          <div class="device-wait" data-wait>等待授权…（约 ${Math.ceil(code.expires_in / 60)} 分钟内有效）</div>
        </div>`;
      panel.querySelector('[data-copy]').onclick = async ev => {
        ev.currentTarget.textContent = '已复制';
        try { await navigator.clipboard.writeText(code.user_code); } catch { /* 忽略 */ }
      };
      const waitNode = panel.querySelector('[data-wait]');
      const token = await pollAccessToken(code.device_code, code.interval, code.expires_in, left => {
        waitNode.textContent = `等待授权… 剩余 ${Math.floor(left / 60)}分${left % 60}秒`;
      });
      const user = await signIn(token);
      waitNode.textContent = `授权成功，欢迎 ${user.login}`;
      close();
      onSuccess?.(user);
    } catch (err) {
      showErr(err.message);
      btn.disabled = false; btn.textContent = old;
    }
  };
}
