/* ==========================================================
   Monian · 渲染
   只做三件事：填 Hero / 渲染简介 / 渲染链接列表
   ========================================================== */

import { detectPlatform, normalizeUrl, platformOf } from './platforms.js';

const $ = (sel, root = document) => root.querySelector(sel);

/** 极简 Markdown → HTML（够用主义：加粗、高亮、列表、小标题、链接、分隔线） */
function md2html(src = '') {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => s
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<em>$1</em>');

  const lines = esc(src).split(/\r?\n/);
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (/^---+$/.test(line)) { closeList(); out.push('<hr>'); continue; }

    let m;
    if ((m = line.match(/^#{1,4}\s+(.*)$/))) {
      closeList(); out.push(`<h3>${inline(m[1])}</h3>`); continue;
    }
    if ((m = line.match(/^[-*+]\s+(.*)$/))) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('');
}

/** 头像：无图时用首字母单色块 */
function paintAvatar(node, profile) {
  const src = (profile.avatar || '').trim();
  if (src) {
    node.src = src;
    node.referrerPolicy = 'no-referrer';
    node.alt = profile.name ? `${profile.name} 的头像` : '头像';
    node.classList.remove('is-mono');
    node.onerror = () => mono(node, profile);
  } else {
    mono(node, profile);
  }
}

function mono(node, profile) {
  const ch = (profile.name || 'M').trim().slice(0, 1).toUpperCase();
  node.removeAttribute('src');
  node.removeAttribute('alt');
  node.textContent = ch;
  node.classList.add('is-mono');
}

function paintHero(profile) {
  const cover = $('.hero-cover');
  if (profile.cover) {
    cover.style.backgroundImage = `url("${profile.cover}")`;
  }
  paintAvatar($('.avatar'), profile);

  $('.hero-name').textContent = profile.name || 'Monian';
  const tag = $('.hero-tagline');
  tag.textContent = profile.tagline || '';
  tag.hidden = !profile.tagline;

  const meta = $('.hero-meta');
  meta.innerHTML = '';
  (profile.chips || []).filter(Boolean).forEach(text => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = text;
    meta.appendChild(chip);
  });
  meta.hidden = !meta.children.length;
}

function paintBio(profile) {
  const box = $('.bio');
  const html = md2html(profile.bio || '');
  box.innerHTML = html;
  box.closest('.about').hidden = !html;
  box.querySelectorAll('a').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

/** 单张链接卡片 */
function linkCard(item, index) {
  const url = normalizeUrl(item.url);
  const key = item.platform && item.platform !== 'auto' ? item.platform : detectPlatform(url);
  const P = platformOf(key);
  const isMail = url.startsWith('mailto:');
  const isInternal = url.startsWith('/');

  const a = document.createElement('a');
  a.className = 'link';
  a.href = url || '#';
  a.style.setProperty('--brand', P.color);
  a.style.animationDelay = `${Math.min(index, 8) * 45}ms`;
  if (!isMail && !isInternal) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer me';
  }
  a.setAttribute('aria-label', `${item.title || P.name}${item.desc ? ' · ' + item.desc : ''}`);

  /* 图标：优先自定义图片，否则品牌色块 + 字形 */
  const icon = document.createElement('span');
  icon.className = 'link-icon';
  if (item.icon) {
    const img = document.createElement('img');
    img.src = item.icon;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { icon.textContent = P.badge; };
    icon.appendChild(img);
  } else {
    icon.textContent = P.badge;
  }

  const main = document.createElement('span');
  main.className = 'link-main';
  const title = document.createElement('span');
  title.className = 'link-title';
  title.textContent = item.title || P.name;
  main.appendChild(title);
  if (item.desc) {
    const desc = document.createElement('span');
    desc.className = 'link-desc';
    desc.textContent = item.desc;
    main.appendChild(desc);
  }

  const go = document.createElement('span');
  go.className = 'link-go';
  go.setAttribute('aria-hidden', 'true');
  go.textContent = isMail ? '✉' : '→';

  a.append(icon, main, go);
  return a;
}

function paintLinks(list) {
  const host = $('.links');
  host.innerHTML = '';
  const items = Array.isArray(list) ? list.filter(i => i && (i.url || '').trim()) : [];

  if (!items.length) {
    host.appendChild(emptyNode('还没有添加链接'));
    return;
  }
  items.forEach((item, i) => host.appendChild(linkCard(item, i)));
}

function emptyNode(text) {
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = text;
  return empty;
}

function paintFooter(data) {
  const name = data.profile?.name || 'Monian';
  $('.foot-mark').textContent = name;
  $('.foot-year').textContent = new Date().getFullYear();
  document.title = `${name} · Links`;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = `${name} — ${data.profile?.tagline || '所有链接都在这里'}`;
}

/* ============ 启动 ============ */
async function boot() {
  const skeleton = $('.skeleton');
  try {
    const res = await fetch('data/site.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    paintHero(data.profile || {});
    paintBio(data.profile || {});
    paintLinks(data.links);
    paintFooter(data);
  } catch (err) {
    console.error('[Monian] 数据读取失败', err);
    paintHero({ name: 'Monian' });
    $('.hero-tagline').hidden = true;
    $('.about').hidden = true;
    const host = $('.links');
    host.innerHTML = '';
    host.appendChild(emptyNode('数据加载失败，请检查 data/site.json 是否存在且格式正确'));
  } finally {
    skeleton?.remove();
    document.body.classList.add('ready');
  }
}

boot();
