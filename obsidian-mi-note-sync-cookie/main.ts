import { Plugin, Notice, Command, TFile } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './types';
import { MiApi } from './mi-api';
import { SyncEngine } from './sync-engine';
import { FileHelper } from './utils/file-helper';
import { MiNoteSyncSettingTab } from './ui/settings-tab';
import { SyncModal } from './ui/sync-modal';
import { CookieAuth } from './auth/cookie-auth';

/**
 * 小米笔记同步插件主类（Cookie 认证版本）
 */
export default class MiNoteSyncPlugin extends Plugin {
  settings: PluginSettings;
  private miApi: MiApi | null = null;
  private syncEngine: SyncEngine | null = null;
  private fileHelper: FileHelper | null = null;
  private cookieAuth: CookieAuth | null = null;
  private autoSyncInterval: number | null = null;
  private syncModal: SyncModal | null = null;

  async onload() {
    console.log('Mi Note Sync (Cookie 版): 插件已加载');

    // 加载设置
    await this.loadSettings();

    // 初始化 Cookie 认证
    this.cookieAuth = new CookieAuth(this);

    // 初始化辅助类
    this.fileHelper = new FileHelper(this.app.vault);
    
    // 初始化 API（传入 CookieAuth 实例）
    this.miApi = new MiApi(
      this.settings,
      (settings) => {
        this.settings = settings;
        this.saveSettings();
      },
      this.cookieAuth
    );

    this.syncEngine = new SyncEngine(
      this.miApi,
      this.fileHelper,
      this.settings,
      (settings) => {
        this.settings = settings;
        this.saveSettings();
      }
    );

    // 添加设置面板
    this.addSettingTab(new MiNoteSyncSettingTab(this.app, this));

    // 添加命令
    this.addCommands();

    // 添加 Ribbon 图标
    this.addRibbonIcon('sync', '同步小米笔记', async () => {
      await this.startSync();
    });

    // 启动自动同步（如果启用）
    if (this.settings.syncConfig.autoSync) {
      this.toggleAutoSync(true);
    }

    // 监听文件变化（用于双向同步）
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (
          file instanceof TFile &&
          file.path.startsWith(this.settings.syncConfig.syncFolder)
        ) {
          // 文件在同步文件夹中被修改，可以触发自动推送
          // 为避免频繁同步，这里可以添加防抖逻辑
        }
      })
    );
  }

  onunload() {
    console.log('Mi Note Sync (Cookie 版): 插件已卸载');
    this.toggleAutoSync(false);
  }

  /**
   * 获取 CookieAuth 实例（供设置面板使用）
   */
  getCookieAuth(): CookieAuth {
    if (!this.cookieAuth) {
      this.cookieAuth = new CookieAuth(this);
    }
    return this.cookieAuth;
  }

  /**
   * 添加插件命令
   */
  private addCommands() {
    const commands: Command[] = [
      {
        id: 'sync-all',
        name: '同步所有小米笔记',
        callback: async () => {
          await this.startSync();
        },
      },
      {
        id: 'sync-pull',
        name: '从小米云拉取笔记',
        callback: async () => {
          await this.startSync('pull');
        },
      },
      {
        id: 'sync-push',
        name: '推送笔记到小米云',
        callback: async () => {
          await this.startSync('push');
        },
      },
      {
        id: 'insert-note',
        name: '插入小米笔记到当前位置',
        callback: async () => {
          await this.showNotePicker();
        },
      },
      {
        id: 'sync-settings',
        name: '打开同步设置',
        callback: () => {
          this.app.setting.open();
          this.app.setting.openTabById('mi-note-sync');
        },
      },
      {
        id: 'login',
        name: '登录小米账号',
        callback: async () => {
          const { LoginModal } = await import('./ui/login-modal');
          const loginModal = new LoginModal(
            this.app,
            this.getCookieAuth(),
            () => {
              new Notice('登录成功！');
            }
          );
          loginModal.open();
        },
      },
      {
        id: 'logout',
        name: '退出登录',
        callback: async () => {
          await this.handleLogout();
        },
      },
    ];

    commands.forEach((command) => this.addCommand(command));
  }

  /**
   * 开始同步
   */
  async startSync(
    mode: 'pull' | 'push' | 'bidirectional' = 'pull'
  ): Promise<void> {
    if (!this.syncEngine) {
      new Notice('同步引擎未初始化');
      return;
    }

    // 检查登录状态
    const valid = await this.miApi?.validateAuth();
    if (!valid) {
      new Notice('请先登录小米账号');
      this.app.setting.open();
      this.app.setting.openTabById('mi-note-sync');
      return;
    }

    // 显示进度弹窗
    this.syncModal = new SyncModal(this.app, () => {
      this.syncEngine?.cancelSync();
    });
    this.syncModal.open();

    // 设置进度回调
    this.syncEngine.setProgressCallback((current, total, message) => {
      this.syncModal?.updateProgress(current, total, message);
    });

    // 执行同步
    try {
      const result = await this.syncEngine.sync(mode);

      if (!result.success && result.errors.length > 0) {
        this.syncModal?.setError(result.errors[0]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '同步失败';
      this.syncModal?.setError(message);
    }
  }

  /**
   * 处理登录
   */
  async handleLogin() {
    const { LoginModal } = await import('./ui/login-modal');
    const loginModal = new LoginModal(
      this.app,
      this.getCookieAuth(),
      async () => {
        new Notice('登录成功！');
        // 刷新设置面板
        this.app.setting.openTabById('mi-note-sync');
      }
    );
    loginModal.open();
  }

  /**
   * 处理登出
   */
  async handleLogout() {
    await this.cookieAuth?.clearCookies();
    
    this.settings.miAccountId = undefined;
    this.settings.encryptedCookies = undefined;
    this.settings.cookieExpiry = undefined;
    this.settings.lastCookieRefresh = undefined;
    await this.saveSettings();

    // 重新初始化 API
    this.miApi = new MiApi(
      this.settings,
      (settings) => {
        this.settings = settings;
        this.saveSettings();
      },
      this.cookieAuth!
    );

    new Notice('已退出登录');
  }

  /**
   * 切换自动同步
   */
  toggleAutoSync(enabled: boolean) {
    if (this.autoSyncInterval) {
      window.clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }

    if (enabled) {
      const intervalMinutes = this.settings.syncConfig.syncInterval || 30;
      this.autoSyncInterval = window.setInterval(async () => {
        console.log('Mi Note Sync: 执行自动同步');
        
        // 同步前检查 Cookie 有效性
        const isLoggedIn = await this.cookieAuth?.isLoggedIn();
        if (!isLoggedIn) {
          new Notice('Cookie 已过期，请重新登录');
          this.handleLogin();
          return;
        }
        
        await this.startSync('pull');
      }, intervalMinutes * 60 * 1000);

      new Notice(`自动同步已启用，间隔 ${intervalMinutes} 分钟`);
    } else {
      new Notice('自动同步已禁用');
    }
  }

  /**
   * 显示笔记选择器
   */
  async showNotePicker() {
    if (!this.miApi) return;

    const valid = await this.miApi.validateAuth();
    if (!valid) {
      new Notice('请先登录小米账号');
      return;
    }

    try {
      const result = await this.miApi.getNotes(undefined, 50, 0);

      if (result.notes.length === 0) {
        new Notice('没有找到笔记');
        return;
      }

      // 创建简单的选择器
      const modal = new (require('obsidian').Modal)(this.app);
      modal.setTitle('选择要插入的笔记');

      const container = modal.contentEl.createDiv();
      container.style.cssText = 'max-height: 400px; overflow-y: auto;';

      result.notes.forEach((note) => {
        const item = container.createDiv();
        item.style.cssText = `
          padding: 10px;
          cursor: pointer;
          border-bottom: 1px solid #ddd;
        `;
        item.setText(note.title || '无标题');
        item.onmouseover = () => {
          item.style.backgroundColor = '#f0f0f0';
        };
        item.onmouseout = () => {
          item.style.backgroundColor = 'transparent';
        };
        item.onclick = async () => {
          modal.close();
          if (this.syncEngine) {
            await this.syncEngine.insertNoteAtCursor(note.id);
          }
        };
      });

      modal.open();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '获取笔记列表失败';
      new Notice(message);
    }
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }
}
