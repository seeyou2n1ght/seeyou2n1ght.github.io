import { Modal, App, Notice } from 'obsidian';
import { CookieAuth } from '../auth/cookie-auth';

/**
 * 小米账号登录弹窗
 * 使用 Obsidian Modal + 内嵌网页或外部浏览器方式
 */
export class LoginModal extends Modal {
  private cookieAuth: CookieAuth;
  private onLoginComplete: () => void;

  constructor(app: App, cookieAuth: CookieAuth, onLoginComplete: () => void) {
    super(app);
    this.cookieAuth = cookieAuth;
    this.onLoginComplete = onLoginComplete;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.setTitle('登录小米账号');

    const container = contentEl.createDiv();
    container.style.cssText = `
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
    `;

    // 说明文字
    const infoBox = container.createDiv();
    infoBox.style.cssText = `
      background: var(--background-modifier-form-field);
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
      width: 100%;
    `;

    infoBox.createEl('h3', {
      text: '登录指引',
      style: {
        margin: '0 0 10px 0',
        color: 'var(--text-normal)',
      }
    });

    const steps = [
      '点击"打开登录页面"按钮',
      '在打开的网页中登录小米账号',
      '登录成功后返回此窗口',
      '点击"我已登录"完成认证',
    ];

    steps.forEach((step, index) => {
      const stepEl = infoBox.createDiv({
        text: `${index + 1}. ${step}`,
        cls: 'mod-muted',
      });
      stepEl.style.cssText = 'margin: 5px 0;';
    });

    // 打开登录按钮
    const openLoginBtn = container.createEl('button', {
      text: '🔐 打开登录页面',
    });
    openLoginBtn.style.cssText = `
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
      background: var(--interactive-accent);
      color: white;
      border: none;
      border-radius: 6px;
      margin: 10px 0;
    `;

    openLoginBtn.onclick = () => {
      // 打开小米云服务登录页面
      window.open('https://i.mi.com/', '_blank');
      new Notice('请在打开的页面中登录小米账号');
      
      // 显示确认按钮
      confirmBtn.style.display = 'block';
      statusEl.setText('等待登录...');
    };

    // 确认登录按钮
    const confirmBtn = container.createEl('button', {
      text: '✅ 我已登录',
    });
    confirmBtn.style.cssText = `
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
      background: var(--interactive-success);
      color: white;
      border: none;
      border-radius: 6px;
      margin: 10px 0;
      display: none;
    `;

    confirmBtn.onclick = async () => {
      statusEl.setText('验证登录状态...');
      
      // 尝试验证 Cookie
      const isLoggedIn = await this.cookieAuth.isLoggedIn();
      
      if (isLoggedIn) {
        new Notice('登录成功！');
        this.close();
        this.onLoginComplete();
      } else {
        new Notice('未检测到有效 Cookie，请确认已完成登录');
        statusEl.setText('登录验证失败');
      }
    };

    // 状态显示
    const statusEl = container.createDiv({
      text: '',
      cls: 'mod-muted',
    });
    statusEl.style.cssText = `
      margin-top: 15px;
      font-size: 14px;
    `;

    // 安全提示
    const securityNote = container.createDiv();
    securityNote.style.cssText = `
      margin-top: 20px;
      padding: 10px;
      background: var(--background-modifier-error);
      border-radius: 6px;
      font-size: 12px;
      color: var(--text-on-accent);
    `;

    securityNote.createEl('p', {
      text: '🔒 安全提示：Cookie 将使用 AES-256 加密存储在本地，不会上传到任何服务器。',
      style: { margin: '0' }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
