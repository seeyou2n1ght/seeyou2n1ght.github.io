import { PluginSettingTab, App, Setting, Notice } from 'obsidian';
import MiNoteSyncPlugin from '../main';
import { LoginModal } from './login-modal';

/**
 * 插件设置面板（Cookie 认证版本）
 */
export class MiNoteSyncSettingTab extends PluginSettingTab {
  plugin: MiNoteSyncPlugin;

  constructor(app: App, plugin: MiNoteSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // 账号设置区域
    containerEl.createEl('h2', { text: '账号设置' });

    // 登录状态显示
    const loginStatusSetting = new Setting(containerEl)
      .setName('登录状态')
      .setDesc('当前小米账号登录状态');

    // 动态更新登录状态显示
    this.updateLoginStatus(loginStatusSetting);

    // 登录按钮
    new Setting(containerEl)
      .setName('登录小米账号')
      .setDesc('打开登录窗口进行认证')
      .addButton(button =>
        button
          .setButtonText('登录')
          .onClick(async () => {
            const loginModal = new LoginModal(
              this.app,
              this.plugin.getCookieAuth(),
              () => {
                this.display(); // 登录成功后刷新面板
              }
            );
            loginModal.open();
          })
      );

    // 退出登录按钮
    new Setting(containerEl)
      .setName('退出登录')
      .setDesc('清除本地保存的 Cookie')
      .addButton(button =>
        button
          .setButtonText('退出登录')
          .setWarning()
          .onClick(async () => {
            await this.plugin.handleLogout();
            this.display();
          })
      );

    // Cookie 有效期显示
    if (this.plugin.settings.cookieExpiry) {
      const expiryDate = new Date(this.plugin.settings.cookieExpiry);
      const isExpired = Date.now() > this.plugin.settings.cookieExpiry;
      
      new Setting(containerEl)
        .setName('Cookie 有效期')
        .setDesc(
          isExpired
            ? '已过期'
            : `有效期至 ${expiryDate.toLocaleString('zh-CN')}`
        );
    }

    // 同步设置区域
    containerEl.createEl('h2', { text: '同步设置' });

    new Setting(containerEl)
      .setName('同步文件夹')
      .setDesc('小米笔记保存到的 Obsidian 文件夹路径')
      .addText(text =>
        text
          .setPlaceholder('例如：小米笔记')
          .setValue(this.plugin.settings.syncConfig.syncFolder)
          .onChange(async value => {
            this.plugin.settings.syncConfig.syncFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('同步模式')
      .setDesc('全量同步：每次同步所有笔记；增量同步：仅同步变更的笔记')
      .addDropdown(dropdown =>
        dropdown
          .addOption('full', '全量同步')
          .addOption('incremental', '增量同步')
          .setValue(this.plugin.settings.syncConfig.syncMode)
          .onChange(async (value: 'full' | 'incremental') => {
            this.plugin.settings.syncConfig.syncMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('冲突处理')
      .setDesc('当遇到同名笔记时的处理方式')
      .addDropdown(dropdown =>
        dropdown
          .addOption('overwrite', '覆盖现有笔记')
          .addOption('skip', '跳过不处理')
          .addOption('rename', '重命名新笔记')
          .setValue(this.plugin.settings.syncConfig.conflictResolution)
          .onChange(async (value: 'overwrite' | 'skip' | 'rename') => {
            this.plugin.settings.syncConfig.conflictResolution = value;
            await this.plugin.saveSettings();
          })
      );

    // 自动同步设置
    containerEl.createEl('h2', { text: '自动同步' });

    new Setting(containerEl)
      .setName('启用自动同步')
      .setDesc('定期自动同步小米笔记')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.syncConfig.autoSync)
          .onChange(async value => {
            this.plugin.settings.syncConfig.autoSync = value;
            await this.plugin.saveSettings();
            this.plugin.toggleAutoSync(value);
          })
      );

    new Setting(containerEl)
      .setName('同步间隔')
      .setDesc('自动同步的时间间隔（分钟）')
      .addText(text =>
        text
          .setPlaceholder('30')
          .setValue(this.plugin.settings.syncConfig.syncInterval.toString())
          .onChange(async value => {
            const interval = parseInt(value) || 30;
            this.plugin.settings.syncConfig.syncInterval = interval;
            await this.plugin.saveSettings();
            this.plugin.toggleAutoSync(this.plugin.settings.syncConfig.autoSync);
          })
      );

    // 标签过滤设置
    containerEl.createEl('h2', { text: '标签过滤' });

    new Setting(containerEl)
      .setName('包含标签')
      .setDesc('只同步包含这些标签的笔记（留空表示同步所有）')
      .addTextArea(text =>
        text
          .setPlaceholder('例如：工作，学习，重要')
          .setValue(this.plugin.settings.syncConfig.includeTags?.join(', ') || '')
          .onChange(async value => {
            this.plugin.settings.syncConfig.includeTags = value
              .split(',')
              .map(t => t.trim())
              .filter(t => t.length > 0);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('排除标签')
      .setDesc('不同步包含这些标签的笔记')
      .addTextArea(text =>
        text
          .setPlaceholder('例如：草稿，临时')
          .setValue(this.plugin.settings.syncConfig.excludeTags?.join(', ') || '')
          .onChange(async value => {
            this.plugin.settings.syncConfig.excludeTags = value
              .split(',')
              .map(t => t.trim())
              .filter(t => t.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // 高级设置
    containerEl.createEl('h2', { text: '高级设置' });

    new Setting(containerEl)
      .setName('最后同步时间')
      .setDesc(
        this.plugin.settings.lastSyncTime
          ? new Date(this.plugin.settings.lastSyncTime).toLocaleString('zh-CN')
          : '从未同步'
      )
      .addButton(button =>
        button.setButtonText('立即同步').onClick(async () => {
          await this.plugin.startSync();
        })
      );

    new Setting(containerEl)
      .setName('清除缓存')
      .setDesc('清除本地缓存的同步数据')
      .addButton(button =>
        button
          .setButtonText('清除缓存')
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.lastSyncToken = undefined;
            await this.plugin.saveSettings();
            new Notice('缓存已清除');
          })
      );

    // 关于
    containerEl.createEl('h2', { text: '关于' });

    containerEl.createEl('p', {
      text: 'Mi Note Sync v2.0.0 (Cookie 认证版) - 小米笔记 Obsidian 同步插件',
      cls: 'mod-muted',
    });

    containerEl.createEl('p', {
      text: '作者：小肉包 | GitHub: seeyou2n1ght',
      cls: 'mod-muted',
    });

    // 认证方式说明
    const authNote = containerEl.createDiv();
    authNote.style.cssText = `
      margin-top: 20px;
      padding: 15px;
      background: var(--background-modifier-form-field);
      border-radius: 8px;
      font-size: 13px;
    `;

    authNote.createEl('h4', {
      text: '🔐 Cookie 认证说明',
      style: { margin: '0 0 10px 0' },
    });

    authNote.createEl('p', {
      text: '本版本使用 Cookie 认证替代 OAuth，优势：',
      style: { margin: '0 0 10px 0' },
      cls: 'mod-muted',
    });

    const advantages = [
      '无需配置 OAuth 应用',
      '直接通过小米官网登录',
      'Cookie 自动刷新，无需手动干预',
      'AES-256 加密存储，安全可靠',
    ];

    const ul = authNote.createEl('ul');
    advantages.forEach(adv => {
      ul.createEl('li', {
        text: adv,
        cls: 'mod-muted',
      });
    });
  }

  /**
   * 更新登录状态显示
   */
  private async updateLoginStatus(setting: Setting) {
    const isLoggedIn = await this.plugin.getCookieAuth().isLoggedIn();
    
    const statusEl = setting.descEl;
    if (isLoggedIn) {
      const userId = await this.plugin.getCookieAuth().getUserId();
      statusEl.setText(`已登录 (用户 ID: ${userId || '未知'})`);
      statusEl.style.color = 'var(--interactive-success)';
    } else {
      statusEl.setText('未登录');
      statusEl.style.color = 'var(--text-error)';
    }
  }
}
