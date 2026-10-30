# Monian · Linktree

参考 [MiragedGeist](https://github.com/Mlinkr/MiragedGeist) 上半部分风格做的个人链接页：头像背景 + 简介 + 链接目录。纯静态、零依赖、零构建。

## 功能

**访客**：打开即看，无需登录，没有任何编辑入口。

**站长（仅你本人）**：页脚点「管理」登录 GitHub（支持 OAuth 设备码授权或粘贴 PAT），验证是仓库所有者后进入编辑模式：

- 名字 / 标语 / 标签：点击就地编辑，回车保存，清空删除
- 头像 / 背景：编辑模式下点头像或「换背景」上传，前端自动压缩
- 简介：点击进入文本域，支持简易 Markdown（`**加粗**`、`` `高亮` ``、列表、小标题、链接、`---`）
- 链接：任意网址 / 域名 / 邮箱都可添加，自动识别平台并配色；也可手动指定平台、上传自定义图标；可增删改、上下排序
- 「发布」一键写回仓库 `data/site.json`，GitHub Pages 自动更新；⌘/Ctrl+S 也可发布
- 未发布修改自动存为浏览器草稿，刷新不丢

## 安全

- 写操作走 GitHub Contents API，只有持有你 token 的浏览器能改；他人拿不到 token，就算改了本地内存也会被 GitHub 拒绝
- token 只存浏览器 localStorage，不进仓库、不进页面
- 登录时会校验账号必须是 `Mlinkr`，其他账号即使登录也只能浏览

## 文件结构

```
Monian/
├── index.html
├── assets/
│   ├── css/style.css        # 主题 + 编辑态样式（多端自适应）
│   ├── fonts/               # 自托管 Bodoni Moda（与参考仓库同款）
│   └── js/
│       ├── app.js           # 渲染 + 编辑交互
│       ├── auth.js          # 登录（OAuth 设备码 / PAT）
│       ├── store.js         # 数据读写（GitHub Contents API）
│       ├── media.js         # 图片压缩
│       ├── markdown.js      # 极简 Markdown
│       └── platforms.js     # 平台识别 / 品牌色
└── data/site.json           # 所有内容
```

## 本地预览

```bash
cd Monian && python3 -m http.server 8811
# http://127.0.0.1:8811/  加 ?edit 直达登录
```

## 部署

GitHub Pages（main 分支根目录）或任意静态托管均可。中文正文使用霞鹜铭心宋（zeoseven CDN），英文标题使用自托管 Bodoni Moda。
