# 杨的背诵器 Web

这是一个自用的网页版背诵工具，目标很明确：

- 电脑和手机同步
- 不上架应用商店
- 通过一个网址直接使用

## 技术路线

- 前端：React + Vite
- 同步：Firebase Auth + Firestore
- 本地兜底：localStorage

未配置 Firebase 时，应用仍然可以本地使用；配置后登录同一个 Google 账号即可跨设备同步。

## 启动

```bash
npm install
npm run dev
```

## 配置同步

1. 复制 `.env.example` 为 `.env`
2. 在 Firebase 控制台创建 Web App
3. 填入 `.env` 里的 Firebase 参数
4. 在 Firebase Auth 中启用 Google 登录
5. 在 Firestore 中创建数据库

## 目前已完成

- 首页
- 仪表盘
- 卡组页
- 学习页
- 简化版 SM-2 排程
- 本地存储
- Google 登录后自动云同步