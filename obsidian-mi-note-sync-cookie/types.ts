// 小米笔记数据结构定义

export interface MiNote {
  id: string;
  title: string;
  content: string; // HTML 格式
  createTime: number;
  updateTime: number;
  folderId?: string;
  folderName?: string;
  tags?: string[];
  attachments?: MiAttachment[];
  isDeleted?: boolean;
}

export interface MiAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface MiFolder {
  id: string;
  name: string;
  parentId?: string;
  noteCount: number;
}

export interface MiUser {
  userId: string;
  nickname: string;
  avatar?: string;
}

export interface SyncConfig {
  syncFolder: string;
  syncMode: 'full' | 'incremental';
  autoSync: boolean;
  syncInterval: number; // 分钟
  includeTags?: string[];
  excludeTags?: string[];
  conflictResolution: 'overwrite' | 'skip' | 'rename';
}

export interface PluginSettings {
  miAccountId?: string;
  // Cookie 认证相关（替代 OAuth Token）
  encryptedCookies?: string; // 加密的 Cookie 字符串
  cookieExpiry?: number; // Cookie 过期时间戳
  lastCookieRefresh?: number; // 上次刷新时间
  
  syncConfig: SyncConfig;
  lastSyncTime?: number;
  lastSyncToken?: string; // 用于增量同步
}

/**
 * 默认插件设置
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  syncConfig: {
    syncFolder: '小米笔记',
    syncMode: 'incremental',
    autoSync: false,
    syncInterval: 30,
    conflictResolution: 'rename',
  },
};

/**
 * Cookie 数据结构（解密后）
 */
export interface CookieData {
  cookies?: string;
  expiry?: number;
  lastRefresh?: number;
}
