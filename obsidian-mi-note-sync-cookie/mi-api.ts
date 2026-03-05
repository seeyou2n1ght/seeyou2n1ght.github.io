import { Notice, requestUrl } from 'obsidian';
import { MiNote, MiFolder, MiUser, PluginSettings } from './types';
import { CookieAuth } from './auth/cookie-auth';

/**
 * 小米云服务 API 封装（Cookie 认证版本）
 */
export class MiApi {
  private baseUrl = 'https://api.micloud.xiaomi.net';
  private settings: PluginSettings;
  private updateSettings: (settings: PluginSettings) => void;
  private cookieAuth: CookieAuth;
  private isReloggingIn = false; // 防止重复登录

  constructor(
    settings: PluginSettings,
    updateSettings: (settings: PluginSettings) => void,
    cookieAuth: CookieAuth
  ) {
    this.settings = settings;
    this.updateSettings = updateSettings;
    this.cookieAuth = cookieAuth;
  }

  /**
   * 获取 Cookie 并添加到请求头
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const cookies = await this.cookieAuth.getValidCookies();
    if (!cookies) {
      throw new Error('未登录或 Cookie 已过期');
    }
    return {
      'Cookie': cookies,
    };
  }

  /**
   * 检查认证状态
   */
  async validateAuth(): Promise<boolean> {
    return await this.cookieAuth.isLoggedIn();
  }

  /**
   * 处理 401/403 错误，触发重新登录
   */
  private async handleAuthError(): Promise<void> {
    if (this.isReloggingIn) {
      return; // 避免重复登录
    }

    this.isReloggingIn = true;
    new Notice('认证失效，请重新登录');
    
    // 清除旧 Cookie
    await this.cookieAuth.clearCookies();
    
    // 触发登录流程（由上层处理）
    this.isReloggingIn = false;
  }

  /**
   * 执行请求并处理认证错误
   */
  private async requestWithAuth(options: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<any> {
    try {
      const authHeaders = await this.getAuthHeaders();
      const response = await requestUrl({
        ...options,
        headers: {
          ...options.headers,
          ...authHeaders,
        },
      });

      // 检查是否需要重新登录
      if (response.status === 401 || response.status === 403) {
        await this.handleAuthError();
        throw new Error('认证失败，请重新登录');
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('401') || error.message.includes('403')) {
        await this.handleAuthError();
      }
      throw error;
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<MiUser | null> {
    try {
      const response = await this.requestWithAuth({
        url: `${this.baseUrl}/api/v1/user/profile`,
        method: 'GET',
      });

      if (response.status === 200) {
        return response.json;
      }
      return null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 获取所有笔记文件夹
   */
  async getFolders(): Promise<MiFolder[]> {
    try {
      const response = await this.requestWithAuth({
        url: `${this.baseUrl}/api/v1/notes/folders`,
        method: 'GET',
      });

      if (response.status === 200) {
        return response.json.folders || [];
      }
      return [];
    } catch (error) {
      console.error('获取文件夹失败:', error);
      return [];
    }
  }

  /**
   * 获取笔记列表
   */
  async getNotes(
    lastModified?: number,
    limit = 100,
    offset = 0
  ): Promise<{ notes: MiNote[]; hasMore: boolean }> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (lastModified) {
        params.append('since', lastModified.toString());
      }

      const response = await this.requestWithAuth({
        url: `${this.baseUrl}/api/v1/notes?${params.toString()}`,
        method: 'GET',
      });

      if (response.status === 200) {
        const data = response.json;
        return {
          notes: data.notes || [],
          hasMore: data.hasMore || false,
        };
      }
      return { notes: [], hasMore: false };
    } catch (error) {
      console.error('获取笔记列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个笔记详情
   */
  async getNoteDetail(noteId: string): Promise<MiNote | null> {
    try {
      const response = await this.requestWithAuth({
        url: `${this.baseUrl}/api/v1/notes/${noteId}`,
        method: 'GET',
      });

      if (response.status === 200) {
        return response.json;
      }
      return null;
    } catch (error) {
      console.error(`获取笔记 ${noteId} 详情失败:`, error);
      return null;
    }
  }

  /**
   * 下载附件
   */
  async downloadAttachment(attachmentId: string): Promise<ArrayBuffer | null> {
    try {
      const response = await this.requestWithAuth({
        url: `${this.baseUrl}/api/v1/attachments/${attachmentId}`,
        method: 'GET',
      });

      if (response.status === 200) {
        return response.arrayBuffer;
      }
      return null;
    } catch (error) {
      console.error(`下载附件 ${attachmentId} 失败:`, error);
      return null;
    }
  }

  /**
   * 创建/更新笔记到小米云
   */
  async syncNoteToMiCloud(
    noteId: string,
    title: string,
    content: string,
    tags?: string[]
  ): Promise<boolean> {
    try {
      const response = await this.requestWithAuth({
        url: `${this.baseUrl}/api/v1/notes/${noteId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          tags,
        }),
      });

      return response.status === 200;
    } catch (error) {
      console.error('同步笔记到小米云失败:', error);
      return false;
    }
  }

  /**
   * 创建新笔记到小米云
   */
  async createNote(
    title: string,
    content: string,
    folderId?: string,
    tags?: string[]
  ): Promise<string | null> {
    try {
      const response = await this.requestWithAuth({
        url: `${this.baseUrl}/api/v1/notes`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          folderId,
          tags,
        }),
      });

      if (response.status === 201) {
        return response.json.id;
      }
      return null;
    } catch (error) {
      console.error('创建笔记失败:', error);
      return null;
    }
  }

  /**
   * 删除笔记
   */
  async deleteNote(noteId: string): Promise<boolean> {
    try {
      const response = await this.requestWithAuth({
        url: `${this.baseUrl}/api/v1/notes/${noteId}`,
        method: 'DELETE',
      });

      return response.status === 200;
    } catch (error) {
      console.error('删除笔记失败:', error);
      return false;
    }
  }
}
