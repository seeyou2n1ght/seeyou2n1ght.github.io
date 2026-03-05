# 开发文档 - Cookie 认证版

## 架构变更

### OAuth vs Cookie 认证对比

| 特性 | OAuth v1.0 | Cookie v2.0 |
|------|-----------|-------------|
| 认证方式 | OAuth 2.0 Token | Cookie (serviceToken) |
| 登录流程 | 复杂（需配置 OAuth 应用） | 简单（直接官网登录） |
| Token 管理 | 需要刷新令牌 | 自动刷新 |
| 存储安全 | 加密存储 | AES-256 加密 |
| 用户体验 | 较复杂 | 简单直观 |

## 核心改动

### 1. 认证模块重构

**旧版 (OAuth)**:
```typescript
// mi-api.ts - OAuth 版本
async validateToken(): Promise<boolean> {
  if (!this.settings.accessToken) return false;
  // Token 过期检查...
}

async refreshAccessToken(): Promise<boolean> {
  // OAuth refresh_token 流程
}
```

**新版 (Cookie)**:
```typescript
// auth/cookie-auth.ts
class CookieAuth {
  async getValidCookies(): Promise<string | null> {
    // 解密 Cookie
    // 检查过期
    // 返回有效 Cookie
  }
  
  async saveCookies(cookies: string): Promise<void> {
    // AES-256 加密
    // 存储到本地
  }
}
```

### 2. API 请求适配

所有 API 请求从 Bearer Token 改为 Cookie Header：

```typescript
// 旧版
headers: {
  'Authorization': `Bearer ${this.settings.accessToken}`,
}

// 新版
headers: {
  'Cookie': cookies, // 包含 serviceToken
}
```

### 3. 错误处理

新增 401/403 自动检测和重新登录触发：

```typescript
private async requestWithAuth(options: {...}): Promise<any> {
  const response = await requestUrl({...});
  
  if (response.status === 401 || response.status === 403) {
    await this.handleAuthError();
    throw new Error('认证失败，请重新登录');
  }
  
  return response;
}
```

### 4. UI 更新

**设置面板新增**:
- 登录状态实时显示
- Cookie 有效期显示
- 一键登录按钮
- 登录指引说明

**登录窗口**:
- 使用 Obsidian Modal
- 打开外部浏览器登录
- 自动检测登录完成

## 技术细节

### Cookie 提取方案

由于 Obsidian 运行在 Electron 环境中，Cookie 提取有以下方案：

#### 方案一：webRequest API（推荐）

```typescript
const { session } = require('electron');

session.defaultSession.webRequest.onBeforeSendHeaders(
  { urls: ['https://i.mi.com/*'] },
  (details, callback) => {
    const cookies = details.requestHeaders['Cookie'];
    if (cookies && cookies.includes('serviceToken')) {
      this.saveCookies(cookies);
    }
    callback({ requestHeaders: details.requestHeaders });
  }
);
```

**优点**: 自动捕获，无需用户干预
**缺点**: 需要在主进程中注册

#### 方案二：手动确认

用户登录完成后手动点击确认，插件从存储中读取。

**优点**: 实现简单
**缺点**: 用户体验较差

### 加密实现

使用 `crypto-js` 进行 AES-256 加密：

```typescript
import { AES, enc } from 'crypto-js';

// 加密
const encrypted = AES.encrypt(
  JSON.stringify(cookieData),
  encryptionKey
).toString();

// 解密
const decrypted = AES.decrypt(encrypted, encryptionKey);
const decryptedStr = decrypted.toString(enc.Utf8);
```

### 自动刷新机制

```typescript
// 同步前检查
const isLoggedIn = await this.cookieAuth?.isLoggedIn();
if (!isLoggedIn) {
  new Notice('Cookie 已过期，请重新登录');
  this.handleLogin();
  return;
}
```

## 构建步骤

```bash
cd obsidian-mi-note-sync-cookie
npm install
npm run build
```

构建产物在 `dist/` 目录。

## 测试清单

- [ ] 登录流程正常
- [ ] Cookie 加密存储
- [ ] Cookie 过期检测
- [ ] 401/403 错误处理
- [ ] 自动同步检查 Cookie
- [ ] 登出清除 Cookie
- [ ] 笔记同步功能正常

## 已知限制

1. **跨域限制**: Electron 的 webRequest API 可能需要特殊权限
2. **自动检测**: 登录成功检测目前需要用户确认
3. **Cookie 有效期**: 小米 Cookie 有效期不确定，需实际测试

## 未来改进

- [ ] 实现自动 Cookie 提取（无需用户确认）
- [ ] 后台静默刷新 Cookie
- [ ] 支持多账号切换
- [ ] 增加 Cookie 有效期提醒
- [ ] 优化登录窗口（使用 webview 内嵌）

## 调试技巧

### 查看加密 Cookie

```typescript
const data = await this.plugin.loadData();
console.log('Encrypted:', data.encryptedCookies);
```

### 模拟 Cookie 过期

```typescript
// 临时修改过期时间测试
this.settings.cookieExpiry = Date.now() - 1000; // 已过期
```

### 监控 API 请求

在开发者控制台中查看网络请求：

```typescript
// 在 requestUrl 前后添加日志
console.log('Request:', url, headers);
console.log('Response:', status);
```

---

**最后更新**: 2026-03-03
**版本**: v2.0.0
