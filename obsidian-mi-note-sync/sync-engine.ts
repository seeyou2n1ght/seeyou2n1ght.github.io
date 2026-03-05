import { Notice } from 'obsidian';
import { MiApi } from './mi-api';
import { FileHelper } from './utils/file-helper';
import { MarkdownConverter } from './utils/markdown-converter';
import { MiNote, PluginSettings, SyncConfig } from './types';

/**
 * 同步引擎
 * 负责协调小米云和 Obsidian 之间的双向同步
 */
export class SyncEngine {
  private miApi: MiApi;
  private fileHelper: FileHelper;
  private settings: PluginSettings;
  private updateSettings: (settings: PluginSettings) => void;
  private isSyncing = false;
  private syncProgressCallback?: (current: number, total: number, message: string) => void;

  constructor(
    miApi: MiApi,
    fileHelper: FileHelper,
    settings: PluginSettings,
    updateSettings: (settings: PluginSettings) => void
  ) {
    this.miApi = miApi;
    this.fileHelper = fileHelper;
    this.settings = settings;
    this.updateSettings = updateSettings;
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: (current: number, total: number, message: string) => void) {
    this.syncProgressCallback = callback;
  }

  /**
   * 执行同步
   */
  async sync(mode: 'pull' | 'push' | 'bidirectional' = 'pull'): Promise<{
    success: boolean;
    pulled: number;
    pushed: number;
    errors: string[];
  }> {
    if (this.isSyncing) {
      new Notice('同步正在进行中，请稍候...');
      return { success: false, pulled: 0, pushed: 0, errors: ['同步正在进行中'] };
    }

    this.isSyncing = true;
    const errors: string[] = [];
    let pulled = 0;
    let pushed = 0;

    try {
      // 验证 Token
      const valid = await this.miApi.validateToken();
      if (!valid) {
        throw new Error('小米账号认证失败，请重新登录');
      }

      const config = this.settings.syncConfig;

      // 拉取模式
      if (mode === 'pull' || mode === 'bidirectional') {
        const pullResult = await this.pullFromMiCloud(config);
        pulled = pullResult.count;
        errors.push(...pullResult.errors);
      }

      // 推送模式
      if (mode === 'push' || mode === 'bidirectional') {
        const pushResult = await this.pushToMiCloud(config);
        pushed = pushResult.count;
        errors.push(...pushResult.errors);
      }

      // 更新最后同步时间
      this.settings.lastSyncTime = Date.now();
      this.updateSettings(this.settings);

      const message = `同步完成：拉取 ${pulled} 条，推送 ${pushed} 条`;
      new Notice(errors.length > 0 ? `${message}，${errors.length} 个错误` : message);

      return { success: errors.length === 0, pulled, pushed, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '同步失败';
      new Notice(errorMessage);
      errors.push(errorMessage);
      return { success: false, pulled, pushed, errors };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 从小米云拉取笔记
   */
  private async pullFromMiCloud(config: SyncConfig): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      this.reportProgress(0, 0, '获取笔记列表...');

      // 增量同步或全量同步
      const lastModified = config.syncMode === 'incremental' 
        ? this.settings.lastSyncTime 
        : undefined;

      let offset = 0;
      const limit = 100;
      let hasMore = true;
      const allNotes: MiNote[] = [];

      // 获取所有笔记
      while (hasMore) {
        const result = await this.miApi.getNotes(lastModified, limit, offset);
        allNotes.push(...result.notes);
        hasMore = result.hasMore;
        offset += limit;
      }

      this.reportProgress(0, allNotes.length, `找到 ${allNotes.length} 条笔记`);

      // 过滤标签
      const filteredNotes = this.filterByTags(allNotes, config);

      // 逐条处理笔记
      for (let i = 0; i < filteredNotes.length; i++) {
        const note = filteredNotes[i];
        this.reportProgress(i + 1, filteredNotes.length, `处理：${note.title}`);

        try {
          // 获取笔记详情（包含完整内容）
          const detail = await this.miApi.getNoteDetail(note.id);
          if (!detail) {
            errors.push(`无法获取笔记详情：${note.title}`);
            continue;
          }

          // 转换 HTML 为 Markdown
          const markdown = MarkdownConverter.htmlToMarkdown(detail.content);

          // 保存或更新文件
          const existingFile = await this.fileHelper.findNoteFile(
            config.syncFolder,
            note.id
          );

          if (existingFile) {
            await this.fileHelper.updateNote(existingFile, detail, markdown);
          } else {
            await this.fileHelper.saveNote(config.syncFolder, detail, markdown);
          }

          // 下载附件
          if (detail.attachments && detail.attachments.length > 0) {
            const attachmentFolder = `${config.syncFolder}/attachments`;
            for (const attachment of detail.attachments) {
              await this.fileHelper.downloadAttachment(attachment, attachmentFolder, note.id);
            }
          }

          count++;
        } catch (error) {
          const errorMsg = `处理笔记失败 ${note.title}: ${error instanceof Error ? error.message : '未知错误'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return { count, errors };
    } catch (error) {
      const errorMsg = `拉取失败：${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMsg);
      return { count: 0, errors };
    }
  }

  /**
   * 推送笔记到小米云
   */
  private async pushToMiCloud(config: SyncConfig): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      this.reportProgress(0, 0, '扫描本地笔记...');

      // 获取所有本地笔记文件
      const noteFiles = await this.fileHelper.getNoteFiles(config.syncFolder);
      
      this.reportProgress(0, noteFiles.length, `找到 ${noteFiles.length} 个本地笔记`);

      for (let i = 0; i < noteFiles.length; i++) {
        const filePath = noteFiles[i];
        this.reportProgress(i + 1, noteFiles.length, `处理：${filePath}`);

        try {
          const parsed = await this.fileHelper.parseNoteFile(filePath);
          if (!parsed || !parsed.id) {
            // 没有 ID 的笔记可能是本地创建的，跳过或创建新笔记
            continue;
          }

          // 转换 Markdown 为 HTML
          const html = MarkdownConverter.markdownToHtml(parsed.content);

          // 同步到小米云
          const success = await this.miApi.syncNoteToMiCloud(
            parsed.id,
            parsed.title || '无标题',
            html,
            parsed.tags
          );

          if (success) {
            count++;
          } else {
            errors.push(`同步失败：${filePath}`);
          }
        } catch (error) {
          const errorMsg = `推送笔记失败 ${filePath}: ${error instanceof Error ? error.message : '未知错误'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return { count, errors };
    } catch (error) {
      const errorMsg = `推送失败：${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMsg);
      return { count: 0, errors };
    }
  }

  /**
   * 根据标签过滤笔记
   */
  private filterByTags(notes: MiNote[], config: SyncConfig): MiNote[] {
    return notes.filter(note => {
      // 排除标签
      if (config.excludeTags && config.excludeTags.length > 0) {
        const noteTags = note.tags || [];
        if (noteTags.some(tag => config.excludeTags?.includes(tag))) {
          return false;
        }
      }

      // 包含标签
      if (config.includeTags && config.includeTags.length > 0) {
        const noteTags = note.tags || [];
        return noteTags.some(tag => config.includeTags?.includes(tag));
      }

      return true;
    });
  }

  /**
   * 报告进度
   */
  private reportProgress(current: number, total: number, message: string) {
    if (this.syncProgressCallback) {
      this.syncProgressCallback(current, total, message);
    }
  }

  /**
   * 插入笔记到当前光标位置
   */
  async insertNoteAtCursor(noteId: string): Promise<boolean> {
    try {
      const note = await this.miApi.getNoteDetail(noteId);
      if (!note) {
        new Notice('无法获取笔记详情');
        return false;
      }

      const markdown = MarkdownConverter.htmlToMarkdown(note.content);
      
      // 获取当前活动的编辑器
      const activeView = window.app.workspace.getActiveViewOfType(window.app.workspace.getLeavesOfType('markdown')[0]?.constructor as any);
      if (!activeView || !('editor' in activeView)) {
        new Notice('请在编辑器中打开一个笔记');
        return false;
      }

      const editor = (activeView as any).editor;
      editor.replaceSelection(markdown);
      
      new Notice(`已插入笔记：${note.title}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '插入失败';
      new Notice(errorMsg);
      return false;
    }
  }

  /**
   * 取消同步
   */
  cancelSync() {
    this.isSyncing = false;
    new Notice('同步已取消');
  }
}
