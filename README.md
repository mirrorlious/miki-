# 杨的背诵器 Web

这是一个自用的网页版背诵工具，目标很明确：

- 电脑和手机同步
- 不上架应用商店
- 通过一个网址直接使用

## 技术路线

- 前端：React + Vite
- 账号与同步：Firebase Auth（邮箱密码 + Google）+ Firestore
- 本地兜底：localStorage

未配置 Firebase 时，应用仍然可以本地使用；配置后登录同一个账号即可跨设备同步。

## 启动

```bash
npm install
npm run dev
```

## 配置账号与同步

1. 复制 `.env.example` 为 `.env`
2. 在 Firebase 控制台创建 Web App
3. 填入 `.env` 里的 Firebase 参数
4. 在 Firebase Auth 的 Sign-in method 中启用 Email/Password 和 Google
5. 在 Firebase Auth 的 Authorized domains 中加入你的 Vercel 域名，例如 `your-site.vercel.app`
6. 在 Firestore 中创建数据库
7. 把 `firestore.rules` 发布到 Firestore Rules，确保用户只能读写自己的同步文档

同步使用 Firebase Auth 的 `uid` 作为路径：

```text
users/{uid}/cards/{cardId}
users/{uid}/decks/{deckId}
users/{uid}/profile/main
memorizerUsers/{uid}
```

`memorizerUsers/{uid}` 只用于旧版整包 payload 迁移；如果旧路径没有权限，应用会跳过旧迁移并继续使用新版 `users/{uid}/...` 子集合。

## Vercel 部署

Vercel 上如果右上角显示“本地模式”，通常是部署环境里没有这些 `VITE_FIREBASE_*` 环境变量。进入 Vercel 项目：

1. 打开 Settings / Environment Variables
2. 添加 `.env.example` 里的 6 个变量
3. 保存后重新部署

Vite 会在构建时写入环境变量，所以添加变量后需要 redeploy 才会从“本地模式”变成“待登录”。

## 目前已完成

- 首页
- 仪表盘
- 卡组页
- 学习页
- 简化版 SM-2 排程
- 本地存储
- 邮箱注册/登录
- Google 登录
- 登录后自动云同步
- Anki APKG/COLPKG 导入
- Anki 模板 HTML / cloze / FrontSide 渲染
- APKG 导入只保存文本、HTML 和卡片字段，不上传图片、音频或媒体文件
