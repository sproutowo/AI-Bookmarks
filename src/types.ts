
export enum Language {
  ZH_CN = 'zh-CN',
  ZH_TW = 'zh-TW',
  EN = 'en',
  JA = 'ja'
}

export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
  dateAdded: number;
  // Extended properties for AI and Extension
  summary?: string;
  tags?: string[];
  aiClassified?: boolean;
  type: 'folder' | 'bookmark';
}

export interface WebDavConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
}

export interface SyncConfig {
  autoSync: boolean;
  interval: 'hourly' | 'daily' | 'on_change' | 'on_open';
  lastSyncTime?: number;
  strategy: 'local_to_remote' | 'remote_to_local' | 'merge';
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  customBackground?: string; // base64 or url
  language: Language;
  webDav: WebDavConfig;
  localSync: SyncConfig;
  webDavSync: SyncConfig;
  
  // AI Config
  aiProvider: 'gemini' | 'custom'; // 'custom' implies OpenAI compatible
  customApiKey?: string; // Only for custom providers. Gemini uses process.env.API_KEY
  aiBaseUrl?: string; // For custom providers (e.g. https://api.openai.com/v1)
  aiModel?: string;   // e.g. gemini-2.5-flash or gpt-4o
}

export interface AppState {
  root: BookmarkNode; // The root folder
  flatList: BookmarkNode[]; // Helper for searching/tagging
  selectedIds: Set<string>;
  settings: AppSettings;
}

export enum ViewMode {
  All = 'ALL',
  MyFolders = 'MY_FOLDERS',
  SmartTags = 'SMART_TAGS',
  Recent = 'RECENT',
  Settings = 'SETTINGS',
}

export interface ImportOptions {
  targetFolderId: string;
  importTags: boolean;
  mode: 'merge' | 'replace';
}
