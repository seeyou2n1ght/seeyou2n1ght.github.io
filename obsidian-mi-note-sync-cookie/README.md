# Mi Note Sync (Cookie 认证版) v2.0.0

小米笔记 Obsidian 同步插件 - **Cookie 认证版本**

## 🎯 版本说明

本版本是 OAuth 认证版的升级版，使用 **Cookie 认证**替代传统的 OAuth 流程，主要优势：

- ✅ **无需配置 OAuth 应用** - 直接使用小米官网登录
- ✅ **自动刷新机制** - Cookie 过期自动提示重新登录
- ✅ **更安全** - AES-256 加密存储 Cookie
- ✅ **更简单** - 无需申请 API 密钥

## 📦 安装方法

### 方法一：手动安装

1. 下载插件文件夹
2. 复制到 Obsidian 仓库的 `.obsidian/plugins/` 目录
3. 在 Obsidian 设置中启用插件

### 方法二：BRAT 插件安装

1. 安装 BRAT 插件
2. 添加此仓库地址
3. 安装插件

## 🔐 登录流程

1. 打开插件设置面板
2. 点击「登录小米账号」按钮
3. 在打开的浏览器窗口中登录小米账号
4. 登录成功后返回 Obsidian
5. 点击「我已登录」完成认证

## 🚀 使用方法

### 同步命令

- **同步所有小米笔记** - 双向同步
- **从小米云拉取笔记** - 仅下载
- **推送笔记到小米云** - 仅上传
- **插入小米笔记到当前位置** - 选择笔记插入编辑器

### 自动同步

在设置中启用自动同步，插件会定期检查并同步笔记。

## 📁 文件结构

```
obsidian-mi-note-sync-cookie/
├── auth/
│   └── cookie-auth.ts      # Cookie 认证模块
├── ui/
│   ├── login-modal.ts      # 登录窗口 UI
│   ├── settings-tab.ts     # 设置面板
│   └── sync-modal.ts       # 同步进度弹窗
├── utils/
│   └── file-helper.ts      # 文件操作辅助
├── main.ts                 # 插件主入口
├── mi-api.ts               # 小米 API 封装
├── sync-engine.ts          # 同步引擎
├── types.ts                # 类型定义
└── manifest.json           # 插件清单
```

## 🔧 核心模块

### CookieAuth (auth/cookie-auth.ts)

```typescript
class CookieAuth {
  // 打开登录窗口
  async openLoginWindow(): Promise<void>
  
  // 保存 Cookie（加密存储）
  async saveCookies(cookies: string): Promise<void>
  
  // 获取有效 Cookie
  async getValidCookies(): Promise<string | null>
  
  // 清除 Cookie
  async clearCookies(): Promise<void>
  
  // 检查登录状态
  async isLoggedIn(): Promise<boolean>
}
```

### MiApi (mi-api.ts)

所有 API 请求自动携带 Cookie，并处理 401/403 认证错误。

## 🔒 安全说明

- **加密存储**: Cookie 使用 AES-256 加密
- **不存储密码**: 仅保存必要的 serviceToken
- **本地存储**: 所有数据仅保存在本地
- **自动过期**: Cookie 默认 30 天过期

## ⚠️ 注意事项

1. **Electron 限制**: 由于 Obsidian 基于 Electron，Cookie 提取可能受到跨域限制
2. **登录检测**: 目前需要手动确认登录完成，未来版本将实现自动检测
3. **API 端点**: 小米笔记 API 未公开，端点可能变化

## 🐛 故障排除

### Cookie 无法保存

- 确保已正确登录小米账号
- 检查浏览器是否允许 Cookie
- 尝试重新登录

### 同步失败

- 检查网络连接
- 确认 Cookie 未过期
- 查看开发者控制台错误信息

### 401/403 错误

- Cookie 已过期，请重新登录
- 账号可能被锁定，检查小米账号状态

## 📝 更新日志

### v2.0.0 (Cookie 认证版)

- ✅ 移除 OAuth 认证流程
- ✅ 新增 Cookie 认证模块
- ✅ 实现 Cookie 加密存储
- ✅ 新增登录窗口 UI
- ✅ 自动检测认证失效
- ✅ 设置面板更新

### v1.0.0 (OAuth 版)

- 初始版本
- OAuth 2.0 认证
- 基础同步功能

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👤 作者

- **小肉包**
- GitHub: [@seeyou2n1ght](https://github.com/seeyou2n1ght)
- 网站: https://seeyou2n1ght.github.io

---

**提示**: 使用前请备份重要笔记数据，避免同步冲突导致数据丢失。
