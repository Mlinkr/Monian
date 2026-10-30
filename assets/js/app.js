/* ==========================================================
   Monian · 渲染 + 编辑
   访客：只读，看到什么就是 site.json 里的内容
   本人：登录后可点名字/标语/标签/简介改文字，点头像/背景换图，
         对链接卡片随意增删改，改完一键发布
   ========================================================== */

import { store, loadSite, saveDraft, loadDraft, publish, uid } from './store.js';
import { detectPlatform, normalizeUrl, platformOf, hostOf, PLATFORMS } from './platforms.js';
import { md2html } from './markdown.js';
import { compressImage, srcOf } from './media.js';
import { openLogin, signOut, restore } from './auth.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ================= 通用小工具 ================= */

function toast(msg, type = '') {
  const wrap = $('#toastWrap') || (() => {
    const w = document.createElement('div');
    w.id = 'toastWrap'; w.className = 'toast-wrap';
    document.body.appendChild(w);
    return w;
  })();
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2400);
  setTimeout(() => t.remove(), 2900);
}

/** 标记有未发布修改 */
function touch() {
  store.dirty = true;
  saveDraft();
  syncBar();
}

/** 单行文本：把换行压成空格 */
function cleanLine(v) {
  return String(v || '').replace(/\s*\n\s*/g, ' ').trim();
}

function isEditing() {
  return store.editing;
}

/* ================= 渲染：Hero ================= */

function paintAvatar(node, profile) {
  const src = srcOf(profile.avatar);
  node.classList.remove('is-mono');
  node.onerror = () => mono(node, profile);
  if (src) {
    node.src = src;
    node.alt = `${profile.name || 'Monian'} 的头像`;
    node.referrerPolicy = 'no-referrer';
  } else {
    mono(node, profile);
  }
}

function mono(node, profile) {
  const ch = (profile.name || 'M').trim().slice(0, 1).toUpperCase();
  node.removeAttribute('src');
  node.alt = '';
  node.textContent = ch;
  node.classList.add('is-mono');
}

function paintHero() {
  const p = store.data.profile;
  $$('.hero-cover').forEach(n => {
    n.style.backgroundImage = p.cover ? `url("${srcOf(p.cover)}")` : '';
  });
  $$('.avatar').forEach(n => paintAvatar(n, p));

  $$('.hero-name').forEach(n => { n.textContent = p.name || 'Monian'; });
  $$('.hero-tagline').forEach(n => {
    n.textContent = p.tagline || '';
    n.hidden = !p.tagline && !isEditing();
  });

  const meta = $('#heroMeta');
  meta.innerHTML = '';
  (p.chips || []).forEach((text, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = text;
    chip.dataset.chip = i;
    chip.title = isEditing() ? '点击修改，清空即删除' : '';
    meta.appendChild(chip);
  });
  meta.hidden = !meta.children.length && !isEditing();
}

/* ================= 渲染：简介 ================= */

function paintBio() {
  const box = $('#bioBox');
  const html = md2html(store.data.profile.bio || '');
  box.innerHTML = html || (isEditing() ? '<p class="ph">点击这里写点自我介绍…</p>' : '');
  box.querySelectorAll('a').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
  $('#about').hidden = !html && !isEditing();
}

/* ================= 渲染：链接 ================= */

function linkCard(item, index) {
  const url = normalizeUrl(item.url);
  const key = item.platform && item.platform !== 'auto' ? item.platform : detectPlatform(url);
  const P = platformOf(key);
  const isMail = url.startsWith('mailto:');
  const host = hostOf(url);

  const a = document.createElement('a');
  a.className = 'link';
  a.href = url || '#';
  a.dataset.id = item.id;
  a.style.setProperty('--brand', P.color);
  a.style.animationDelay = `${Math.min(index, 8) * 45}ms`;
  if (!isMail) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  a.setAttribute('aria-label', `${item.title || P.name}${item.desc ? ' · ' + item.desc : ''}`);

  /* 图标：自定义图片 > 平台字形 > 网站首字母 */
  const icon = document.createElement('span');
  icon.className = 'link-icon';
  const iconSrc = srcOf(item.icon);
  if (iconSrc) {
    const img = document.createElement('img');
    img.src = iconSrc;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.remove(); icon.textContent = badgeOf(P, key, url); };
    icon.appendChild(img);
  } else {
    icon.textContent = badgeOf(P, key, url);
  }

  const main = document.createElement('span');
  main.className = 'link-main';
  const title = document.createElement('span');
  title.className = 'link-title';
  title.textContent = item.title || host || P.name;
  main.appendChild(title);

  const sub = item.desc || (key === 'link' || key === 'email' ? host || P.name : '');
  if (sub) {
    const desc = document.createElement('span');
    desc.className = 'link-desc';
    desc.textContent = sub;
    main.appendChild(desc);
  }

  const go = document.createElement('span');
  go.className = 'link-go';
  go.setAttribute('aria-hidden', 'true');
  go.textContent = isMail ? '✉' : '→';

  a.append(icon, main, go);

  if (isEditing()) {
    a.classList.add('editable');
    a.prepend(toolsOf(item));
    a.addEventListener('click', e => {
      if (e.target.closest('[data-op]')) return;
      e.preventDefault();
      openLinkEditor(item);
    });
  }
  return a;
}

/** 非已知平台：取域名首字母作为图标字形，保证「随便什么网址」也有好看图标 */
function badgeOf(P, key, url) {
  if (key !== 'link') return P.badge;
  const h = hostOf(url);
  return (h || 'link').trim().charAt(0).toUpperCase() || '↗';
}

function toolsOf(item) {
  const bar = document.createElement('span');
  bar.className = 'link-tools';
  const mk = (op, label, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.op = op;
    b.className = 'mini-btn' + (op === 'del' ? ' danger' : '');
    b.title = title;
    b.textContent = label;
    b.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      if (op === 'up') moveLink(item.id, -1);
      if (op === 'down') moveLink(item.id, 1);
      if (op === 'edit') openLinkEditor(item);
      if (op === 'del') removeLink(item.id);
    };
    return b;
  };
  bar.append(mk('edit', '✎', '编辑'), mk('up', '↑', '上移'), mk('down', '↓', '下移'), mk('del', '✕', '删除'));
  return bar;
}

function paintLinks() {
  const host = $('#links');
  if (!host) return;
  host.innerHTML = '';
  const list = store.data.links || [];

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = isEditing() ? '还没有链接，点下方「添加链接」开始' : '还没有添加链接';
    host.appendChild(empty);
  } else {
    list.forEach((item, i) => host.appendChild(linkCard(item, i)));
  }

  const add = $('#addLink');
  if (add) add.hidden = !isEditing();
}

function moveLink(id, delta) {
  const list = store.data.links;
  const i = list.findIndex(l => l.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  store.dirty = true;
  saveDraft();
  paintLinks();
  syncBar();
}

function removeLink(id) {
  const item = store.data.links.find(l => l.id === id);
  if (!item) return;
  if (!confirm(`删除「${item.title || item.url}」？`)) return;
  store.data.links = store.data.links.filter(l => l.id !== id);
  touch();
  paintLinks();
  toast('已删除');
}

/* ================= 链接编辑器 ================= */

function escapeAttr(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function openLinkEditor(item) {
  const isNew = !item;
  const draft = item || { id: uid(), platform: 'auto', title: '', desc: '', url: '', icon: '' };

  const wrap = document.createElement('div');
  wrap.className = 'modal-mask';
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="lkTitle">
      <button class="modal-x" data-x aria-label="关闭">✕</button>
      <h3 id="lkTitle">${isNew ? '添加链接' : '编辑链接'}</h3>

      <label class="field">
        <span>网址 / 邮箱</span>
        <input name="url" type="text" placeholder="https://example.com 或 you@mail.com" value="${escapeAttr(draft.url)}" spellcheck="false" />
        <em class="field-hint" data-host></em>
      </label>

      <label class="field">
        <span>标题</span>
        <input name="title" type="text" placeholder="留空自动用域名" value="${escapeAttr(draft.title)}" maxlength="60" />
      </label>

      <label class="field">
        <span>说明 <i>可选</i></span>
        <input name="desc" type="text" placeholder="一句话描述这个链接" value="${escapeAttr(draft.desc)}" maxlength="90" />
      </label>

      <div class="field">
        <span>平台 / 样式</span>
        <div class="chips-row" data-plats></div>
      </div>

      <div class="field">
        <span>图标 <i>可选，不传则自动匹配</i></span>
        <div class="icon-row">
          <span class="icon-preview" data-preview></span>
          <button type="button" class="btn-ghost" data-pick>上传图片</button>
          <button type="button" class="btn-ghost" data-clearicon>清除</button>
        </div>
        <input type="file" accept="image/*" hidden data-file />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-ghost" data-x>取消</button>
        <button type="button" class="btn-solid" data-save>${isNew ? '添加' : '保存'}</button>
      </div>
    </div>`;

  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');

  const f = name => wrap.querySelector(`[name="${name}"]`);
  const hostHint = wrap.querySelector('[data-host]');
  const platRow = wrap.querySelector('[data-plats]');
  const preview = wrap.querySelector('[data-preview]');
  let chosenPlat = draft.platform || 'auto';
  let iconData = draft.icon || '';

  const close = () => { wrap.remove(); document.body.classList.remove('modal-open'); };
  $$('[data-x]', wrap).forEach(b => b.onclick = close);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });

  const options = [
    { key: 'auto', name: '自动识别' },
    ...['weibo', 'xiaohongshu', 'douyin', 'bilibili', 'zhihu', 'github', 'instagram', 'x', 'youtube', 'email', 'link']
      .map(k => ({ key: k, name: PLATFORMS[k].name })),
  ];

  const paintPlats = () => {
    platRow.innerHTML = '';
    options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip-btn' + (chosenPlat === o.key ? ' on' : '');
      b.textContent = o.name;
      b.style.setProperty('--brand', o.key === 'auto' ? '#b87d6e' : platformOf(o.key).color);
      b.onclick = () => { chosenPlat = o.key; paintPlats(); paintPreview(); };
      platRow.appendChild(b);
    });
  };

  const effectivePlat = () => chosenPlat !== 'auto'
    ? chosenPlat
    : detectPlatform(normalizeUrl(f('url').value));

  const paintPreview = () => {
    const key = effectivePlat();
    const P = platformOf(key);
    preview.style.setProperty('--brand', P.color);
    preview.innerHTML = '';
    if (iconData) {
      const img = document.createElement('img');
      img.src = iconData; img.alt = '';
      preview.appendChild(img);
    } else {
      preview.textContent = badgeOf(P, key, normalizeUrl(f('url').value));
    }
    const h = hostOf(f('url').value);
    hostHint.textContent = h ? `跳转到 ${h}` : '';
  };

  f('url').addEventListener('input', paintPreview);
  wrap.querySelector('[data-pick]').onclick = () => wrap.querySelector('[data-file]').click();
  wrap.querySelector('[data-file]').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      iconData = await compressImage(file, 'icon');
      paintPreview();
    } catch (err) { toast(err.message, 'err'); }
    e.target.value = '';
  };
  wrap.querySelector('[data-clearicon]').onclick = () => { iconData = ''; paintPreview(); };

  wrap.querySelector('[data-save]').onclick = () => {
    const url = f('url').value.trim();
    if (!url) { f('url').focus(); toast('请填写网址', 'err'); return; }
    if (!/^(\S+@\S+\.\S+|https?:\/\/|\/|mailto:|tel:)/i.test(url) && !/\./.test(url)) {
      toast('链接格式好像不太对', 'err'); return;
    }
    const data = {
      id: draft.id,
      platform: chosenPlat,
      title: cleanLine(f('title').value),
      desc: cleanLine(f('desc').value),
      url,
      icon: iconData,
    };
    if (isNew) store.data.links.push(data);
    else Object.assign(item, data);
    touch();
    paintLinks();
    close();
    toast(isNew ? '已添加' : '已更新', 'ok');
  };

  paintPlats();
  paintPreview();
  setTimeout(() => f('url').focus(), 30);
}

/* ================= 就地编辑：文字 ================= */

function inlineEdit(node, { multiline = false, placeholder = '', onSave, onEmpty }) {
  if (!isEditing() || node.isContentEditable) return;
  const before = node.innerText;
  node.contentEditable = 'true';
  node.spellcheck = false;
  node.classList.add('inline-editing');
  node.dataset.ph = placeholder;
  if (placeholder && !before.trim()) node.dataset.empty = '1';

  const finish = commit => {
    node.removeAttribute('contenteditable');
    node.classList.remove('inline-editing');
    node.removeAttribute('data-empty');
    node.removeEventListener('keydown', onKey);
    node.removeEventListener('blur', onBlur);
    if (!commit) { node.innerText = before; paintHero(); return; }
    const val = node.innerText.replace(/\u00a0/g, ' ');
    const out = multiline ? val.trim() : cleanLine(val);
    if (!out) { onEmpty?.(); return; }
    onSave(out);
  };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); node.blur(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); node.blur(); }
  };
  const onBlur = () => finish(true);

  node.addEventListener('keydown', onKey);
  node.addEventListener('blur', onBlur);

  const r = document.createRange();
  r.selectNodeContents(node);
  const s = getSelection();
  s.removeAllRanges(); s.addRange(r);
}

function bindInlineEditors() {
  const p = store.data.profile;

  $$('.hero-name').forEach(n => n.onclick = () => inlineEdit(n, {
    placeholder: '你的名字',
    onSave: v => { p.name = v; touch(); paintHero(); bindInlineEditors(); },
    onEmpty: () => paintHero(),
  }));

  $$('.hero-tagline').forEach(n => n.onclick = () => {
    if (!isEditing()) return;
    n.hidden = false;
    inlineEdit(n, {
      placeholder: '一句话介绍（可留空）',
      onSave: v => { p.tagline = v; touch(); paintHero(); bindInlineEditors(); },
      onEmpty: () => { p.tagline = ''; touch(); paintHero(); bindInlineEditors(); },
    });
  });

  const bio = $('#bioBox');
  bio.onclick = e => {
    if (!isEditing() || bio.isContentEditable) return;
    if (e.target.closest('a')) return;
    openBioEditor();
  };

  $$('.chip').forEach(chip => chip.onclick = () => inlineEdit(chip, {
    placeholder: '标签',
    onSave: v => { p.chips[+chip.dataset.chip] = v; touch(); paintHero(); bindInlineEditors(); },
    onEmpty: () => {
      p.chips.splice(+chip.dataset.chip, 1);
      touch(); paintHero(); bindInlineEditors();
    },
  }));
}

/** 简介用纯文本域编辑，避免把已渲染的 HTML 改坏 */
function openBioEditor() {
  const p = store.data.profile;
  const bio = $('#bioBox');
  if ($('#bioPad')) return;

  const pad = document.createElement('div');
  pad.className = 'bio-editor';
  pad.id = 'bioPad';
  pad.innerHTML = `
    <textarea data-ta spellcheck="false" placeholder="写点自我介绍…">${escapeHtml(p.bio || '')}</textarea>
    <div class="bio-editor-bar">
      <span class="hint">**加粗** · \`高亮\` · - 列表 · # 小标题 · [文字](链接) · ---</span>
      <button class="btn-ghost" type="button" data-cancel>取消</button>
      <button class="btn-solid" type="button" data-ok>完成</button>
    </div>`;

  bio.style.display = 'none';
  bio.after(pad);

  const ta = pad.querySelector('[data-ta]');
  ta.style.height = Math.max(170, Math.min(ta.scrollHeight + 8, 520)) + 'px';
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  const done = keep => {
    if (keep) { p.bio = ta.value; touch(); }
    pad.remove();
    bio.style.display = '';
    paintBio();
  };
  pad.querySelector('[data-ok]').onclick = () => done(true);
  pad.querySelector('[data-cancel]').onclick = () => done(false);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') done(false);
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') done(true);
  });
}

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ================= 图片上传 ================= */

function pickImage(kind, cb) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    toast('正在压缩图片…');
    try {
      const dataUrl = await compressImage(file, kind);
      cb(dataUrl);
    } catch (err) { toast(err.message, 'err'); }
  };
  input.click();
}

/* ================= 编辑工具条 ================= */

function syncBar() {
  document.body.classList.toggle('editing', store.editing);
  const bar = $('#editBar');
  if (!bar) return;
  bar.hidden = !store.editing;

  if (store.editing) {
    const name = store.user?.login || '';
    $('#editWho').textContent = name ? `@${name}` : '编辑中';
    const btn = $('#publishBtn');
    btn.textContent = store.saving ? '发布中…' : '发布';
    btn.disabled = store.saving || !store.dirty;
    $('#dirtyDot').hidden = !store.dirty;
  }

  const loginBtn = $('#loginBtn');
  if (loginBtn) loginBtn.hidden = store.editing;

  paintHero();
  paintBio();
  paintLinks();
  bindInlineEditors();
}

function enterEdit() {
  store.editing = true;
  syncBar();
  toast('编辑模式：点文字直接改，点卡片改链接', 'ok');
}

function leaveEdit() {
  if (store.dirty && !confirm('有修改还没发布，确定退出编辑？未发布的内容会保留为草稿。')) return;
  store.editing = false;
  syncBar();
  $('#loginBtn').hidden = false;
}

async function doPublish() {
  if (!store.token) { openLogin({ onSuccess: () => enterEdit() }); return; }
  const btn = $('#publishBtn');
  if (btn) { btn.disabled = true; btn.textContent = '发布中…'; }
  try {
    await publish();
    store.editing = true;
    syncBar();
    toast('已发布，约半分钟后全站生效', 'ok');
  } catch (err) {
    toast(err.message, 'err');
    if (btn) { btn.disabled = false; btn.textContent = '发布'; }
  }
}

/* ================= 启动 ================= */

async function boot() {
  let fresh = null;
  try {
    fresh = await loadSite();
  } catch (err) {
    console.error('[Monian] 读取失败', err);
  }

  const draft = loadDraft();
  if (draft) {
    /* 草稿存在 = 上次有未发布修改，优先恢复，避免刷新丢内容 */
    store.data = draft;
    store.dirty = true;
  } else if (fresh) {
    store.data = fresh;
  } else {
    toast('内容加载失败，请稍后刷新', 'err');
  }

  $('#skeleton')?.remove();
  document.body.classList.add('ready');

  paintHero();
  paintBio();
  paintLinks();
  paintFooter();
  bindInlineEditors();

  /* 登录态静默恢复：是本人直接进编辑态 */
  const user = await restore();
  const loginBtn = $('#loginBtn');
  loginBtn.hidden = false;
  if (user) {
    enterEdit();
  } else {
    if (store.dirty) toast('检测到未发布的草稿，登录后可继续编辑');
    syncBar();
  }

  /* ---- 交互 ---- */
  loginBtn.onclick = () => {
    if (store.user) { enterEdit(); return; }
    openLogin({
      onSuccess: u => { toast(`欢迎回来，${u.login}`, 'ok'); enterEdit(); },
    });
  };
  $('#addLink').onclick = () => openLinkEditor(null);
  $('#publishBtn').onclick = doPublish;
  $('#exitEditBtn').onclick = leaveEdit;
  $('#logoutBtn').onclick = () => {
    if (!confirm('退出登录？未发布的修改会留作草稿。')) return;
    signOut();
    $('#loginBtn').hidden = false;
    syncBar();
    toast('已退出，现在是访客视角');
  };

  $('#avatarWrap').onclick = () => {
    if (!isEditing()) return;
    pickImage('avatar', data => {
      store.data.profile.avatar = data;
      touch();
      toast('头像已更新，记得发布', 'ok');
    });
  };
  $('#coverBtn').onclick = e => {
    e.stopPropagation();
    if (!isEditing()) return;
    pickImage('cover', data => {
      store.data.profile.cover = data;
      touch();
      toast('背景已更新，记得发布', 'ok');
    });
  };
  $('#chipAdd').onclick = () => {
    store.data.profile.chips.push('新标签');
    touch();
    bindInlineEditors();
  };

  /* ⌘/Ctrl + S 发布 */
  document.addEventListener('keydown', e => {
    if (store.editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (store.dirty) doPublish();
    }
  });

  window.addEventListener('beforeunload', e => {
    if (store.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  if ((location.search + location.hash).includes('edit') && !store.editing) loginBtn.click();
}

function paintFooter() {
  const p = store.data.profile;
  $$('.foot-mark').forEach(n => { n.textContent = p.name || 'Monian'; });
  $$('.foot-year').forEach(n => { n.textContent = new Date().getFullYear(); });
  document.title = `${p.name || 'Monian'} · Links`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = `${p.name || 'Monian'} — ${p.tagline || '所有链接都在这里'}`;
}

boot();
