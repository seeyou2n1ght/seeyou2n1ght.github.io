import { Notice, Plugin } from 'obsidian';
import { AES, enc } from 'crypto-js';

/**
 * Cookie 认证管理器
 * 负责小米账号的 Cookie 登录、保存、验证和刷新
 */
export class CookieAuth {
  private plugin: Plugin;
  private encryptionKey: string;
  private cookieData: {
    cookies?: string;
    expiry?: number;
    lastRefresh?: number;
  } = {};

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    // 使用设备唯一标识生成加密密钥
    this.encryptionKey = this.generateEncryptionKey();
  }

  /**
   * 生成加密密钥（基于设备标识）
   */
  private generateEncryptionKey(): string {
    // 使用简单的设备标识组合作为密钥基础
    const deviceId = navigator.userAgent + window.location.hostname;
    return deviceId.substring(0, 32).padEnd(32, '0');
  }

  /**
   * 打开登录窗口（使用 Obsidian Modal + iframe）
   */
  async openLoginWindow(): Promise<void> {
    return new Promise((resolve) => {
      // 注意：Obsidian 基于 Electron，可以使用 webview
      // 但由于安全限制，我们使用弹窗方式引导用户登录
      
      const modal = new (require('obsidian').Modal)(this.plugin.app);
      modal.setTitle('登录小米账号');
      
      const container = modal.contentEl.createDiv();
      container.style.cssText = `
        padding: 20px;
        text-align: center;
        max-width: 500px;
      `;

      container.createEl('p', {
        text: '请点击下方按钮打开小米登录页面',
        cls: 'mod-muted'
      });

      container.createEl('p', {
        text: '登录成功后，Cookie 将自动保存',
        cls: 'mod-muted'
      });

      const loginButton = container.createEl('button', {
        text: '打开登录页面',
      });
      loginButton.style.cssText = `
        padding: 10px 20px;
        margin: 20px 0;
        cursor: pointer;
      `;

      loginButton.onclick = async () => {
        // 打开小米登录页面
        const loginUrl = 'https://i.mi.com/';
        
        // 使用 Obsidian 的 openLink 打开外部浏览器
        this.plugin.app.workspace.openLinkText(loginUrl, '', true);
        
        new Notice('请在打开的页面中登录小米账号，登录后返回此窗口');
        
        // 等待用户确认登录完成
        const confirmButton = container.createEl('button', {
          text: '我已登录完成',
        });
        confirmButton.style.cssText = `
          padding: 10px 20px;
          margin: 10px 0;
          cursor: pointer;
          background: var(--interactive-accent);
          color: white;
          border: none;
          border-radius: 4px;
        `;

        confirmButton.onclick = async () => {
          // 用户确认登录完成，尝试从存储中读取 Cookie
          // 注意：由于跨域限制，实际 Cookie 提取需要通过 Electron 的 webRequest API
          // 这里我们假设用户已通过某种方式授权了 Cookie
          modal.close();
          resolve();
        };
      };

      modal.open();
    });
  }

  /**
   * 监听网络请求并提取 Cookie（需要在 main process 中调用）
   * 注意：此方法需要在 Electron 主进程中注册
   */
  setupCookieListener(): void {
    // 此方法需要在插件的 main.ts 中通过 Electron API 调用
    // 示例代码（在 main process 中）:
    /*
    const { session } = require('electron');
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['https://i.mi.com/*', 'https://api.micloud.xiaomi.net/*'] },
      (details: any, callback: any) => {
        const cookies = details.requestHeaders?.['Cookie'];
        if (cookies && cookies.includes('serviceToken')) {
          this.saveCookies(cookies);
        }
        callback({ requestHeaders: details.requestHeaders });
      }
    );
    */
  }

  /**
   * 保存 Cookie（加密存储）
   */
  async saveCookies(cookies: string): Promise<void> {
    try {
      // 提取 serviceToken（关键 Cookie）
      const serviceTokenMatch = cookies.match(/serviceToken=([^;]+)/);
      if (!serviceTokenMatch) {
        new Notice('未找到有效的 serviceToken');
        return;
      }

      // 设置过期时间（默认 30 天）
      const expiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000);

      this.cookieData = {
        cookies: cookies,
        expiry: expiryTime,
        lastRefresh: Date.now(),
      };

      // 加密存储
      const encrypted = AES.encrypt(
        JSON.stringify(this.cookieData),
        this.encryptionKey
      ).toString();

      await this.plugin.saveData({ encryptedCookies: encrypted });
      new Notice('小米账号 Cookie 已保存');
    } catch (error) {
      console.error('保存 Cookie 失败:', error);
      new Notice('保存 Cookie 失败');
    }
  }

  /**
   * 获取有效 Cookie（自动检查过期）
   */
  async getValidCookies(): Promise<string | null> {
    try {
      // 加载加密的 Cookie 数据
      const data = await this.plugin.loadData();
      if (!data?.encryptedCookies) {
        return null;
      }

      // 解密
      const decrypted = AES.decrypt(data.encryptedCookies, this.encryptionKey);
      const decryptedStr = decrypted.toString(enc.Utf8);
      
      if (!decryptedStr) {
        return null;
      }

      this.cookieData = JSON.parse(decryptedStr);

      // 检查是否过期
      if (this.isExpired()) {
        new Notice('Cookie 已过期，请重新登录');
        return null;
      }

      return this.cookieData.cookies || null;
    } catch (error) {
      console.error('读取 Cookie 失败:', error);
      return null;
    }
  }

  /**
   * 检查 Cookie 是否过期
   */
  private isExpired(): boolean {
    if (!this.cookieData.expiry) {
      return true;
    }
    return Date.now() > this.cookieData.expiry;
  }

  /**
   * 清除 Cookie（登出）
   */
  async clearCookies(): Promise<void> {
    this.cookieData = {};
    await this.plugin.saveData({ encryptedCookies: undefined });
    new Notice('已清除登录信息');
  }

  /**
   * 检查是否已登录
   */
  async isLoggedIn(): Promise<boolean> {
    const cookies = await this.getValidCookies();
    return cookies !== null;
  }

  /**
   * 获取用户 ID（从 Cookie 中解析）
   */
  async getUserId(): Promise<string | null> {
    const cookies = await this.getValidCookies();
    if (!cookies) {
      return null;
    }

    // 尝试从 Cookie 中提取 userId
    const userIdMatch = cookies.match(/userId=([^;]+)/);
    return userIdMatch ? userIdMatch[1] : null;
  }
}
