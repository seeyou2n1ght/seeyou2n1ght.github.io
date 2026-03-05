import { Notice, requestUrl } from 'obsidian';
import { MiNote, MiFolder, MiUser, PluginSettings } from './types';

/**
 * 小米云服务 API 封装
 * 注意：小米笔记 API 未公开，以下端点基于逆向工程，可能需要更新
 */
export class MiApi {
  private baseUrl = 'https://api.micloud.xiaomi.net';
  private settings: PluginSettings;
  private updateSettings: (settings: PluginSettings) => void;

  constructor(settings: PluginSettings, updateSettings: (settings: PluginSettings) => void) {
    this.settings = settings;
    this.updateSettings = updateSettings;
  }

  /**
   * 检查 Token 是否有效
   */
  async validateToken(): Promise<boolean> {
    if (!this.settings.accessToken) return false;
    
    const expiry = this.settings.tokenExpiry || 0;
    const now = Date.now();
    
    // Token 已过期，尝试刷新
    if (now > expiry && this.settings.refreshToken) {
      return await this.refreshAccessToken();
    }
    
    return now < expiry;
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.settings.refreshToken) {
      new Notice('小米账号：刷新令牌不存在，请重新登录');
      return false;
    }

    try {
      // 注意：这是模拟的刷新端点，实际端点需要抓包获取
      const response = await requestUrl({
        url: `${this.baseUrl}/oauth2/token`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.settings.refreshToken,
          client_id: 'com.miui.notes',
        }).toString(),
      });

      if (response.status === 200) {
        const data = response.json;
        this.settings.accessToken = data.access_token;
        this.settings.refreshToken = data.refresh_token || this.settings.refreshToken;
        this.settings.tokenExpiry = Date.now() + (data.expires_in * 1000);
        this.updateSettings(this.settings);
        new Notice('小米账号：Token 已刷新');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('刷新 Token 失败:', error);
      new Notice('小米账号：Token 刷新失败，请重新登录');
      return false;
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<MiUser | null> {
    try {
      const response = await requestUrl({
        url: `${this.baseUrl}/api/v1/user/profile`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.accessToken}`,
        },
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
      const response = await requestUrl({
        url: `${this.baseUrl}/api/v1/notes/folders`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.accessToken}`,
        },
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
   * @param lastModified 最后修改时间戳，用于增量同步
   * @param limit 每页数量
   * @param offset 偏移量
   */
  async getNotes(lastModified?: number, limit = 100, offset = 0): Promise<{ notes: MiNote[], hasMore: boolean }> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (lastModified) {
        params.append('since', lastModified.toString());
      }

      const response = await requestUrl({
        url: `${this.baseUrl}/api/v1/notes?${params.toString()}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.accessToken}`,
        },
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
      const response = await requestUrl({
        url: `${this.baseUrl}/api/v1/notes/${noteId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.accessToken}`,
        },
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
      const response = await requestUrl({
        url: `${this.baseUrl}/api/v1/attachments/${attachmentId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.accessToken}`,
        },
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
  async syncNoteToMiCloud(noteId: string, title: string, content: string, tags?: string[]): Promise<boolean> {
    try {
      const response = await requestUrl({
        url: `${this.baseUrl}/api/v1/notes/${noteId}`,
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.settings.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content, // HTML 格式
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
  async createNote(title: string, content: string, folderId?: string, tags?: string[]): Promise<string | null> {
    try {
      const response = await requestUrl({
        url: `${this.baseUrl}/api/v1/notes`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.settings.accessToken}`,
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
      const response = await requestUrl({
        url: `${this.baseUrl}/api/v1/notes/${noteId}`,
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.settings.accessToken}`,
        },
      });

      return response.status === 200;
    } catch (error) {
      console.error('删除笔记失败:', error);
      return false;
    }
  }
}
