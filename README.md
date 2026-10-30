# Monian · Linktree

参考 [MiragedGeist](https://github.com/Mlinkr/MiragedGeist) 上半部分风格做的一个**极简单页 Linktree**：只有头像背景 + 简介 + 链接目录，没有专栏、编辑面板等复杂功能。纯静态、零依赖、零构建。

## 文件结构

```
Monian/
├── index.html            # 单页入口
├── assets/
│   ├── css/style.css     # 样式（pastel 虹彩主题，多端自适应）
│   └── js/
│       ├── app.js        # 渲染：Hero / 简介 / 链接列表
│       └── platforms.js  # 平台识别：链接 → 品牌色 + 图标
└── data/
    └── site.json         # 所有内容都在这一个文件里
```

## 修改内容

编辑 `data/site.json` 即可，无需碰任何代码：

| 字段 | 说明 |
|---|---|
| `profile.name / tagline` | 名字与一句话简介 |
| `profile.avatar / cover` | 头像 / 封面图（填 URL 或仓库内路径；留空显示首字母色块） |
| `profile.chips` | 名字下方的小标签 |
| `profile.bio` | 简介正文，支持简易 Markdown：`**加粗**`、`` `高亮` ``、`- 列表`、`# 小标题`、`[文字](链接)`、`---` |
| `links` | 链接列表。`platform` 留 `auto` 时按 URL 自动识别平台（微博/小红书/B站/抖音/GitHub/邮箱等 18 种），也可手动指定 |

## 本地预览

```bash
cd Monian
python3 -m http.server 8811
# 打开 http://127.0.0.1:8811/
```

## 部署

任意静态托管皆可（GitHub Pages / Vercel / 腾讯云 COS 静态站等），推送后开启 Pages、根目录即可。
