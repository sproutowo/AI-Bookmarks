import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AppSettings, BookmarkNode, Language, SyncConfig, WebDavConfig } from '../types';
import { loadBookmarks, saveBookmarks, flattenTree, deleteNodeRecursive, parseNetscapeHtml, filterTreeByIds, mergeIntoTree } from '../services/mockBrowser';
import { analyzeBookmarkWithAi, searchBookmarksWithAi, testAiConnection } from '../services/gemini';

interface StoreContextType {
  bookmarks: BookmarkNode;
  flatBookmarks: BookmarkNode[];
  allTags: string[];
  selectedIds: Set<string>;
  settings: AppSettings;
  searchQuery: string;
  isSemanticSearch: boolean;
  searchResults: Set<string>; 
  semanticSearchPerformed: boolean;
  importCandidate: BookmarkNode | null;
  setSearchQuery: (q: string) => void;
  toggleSemanticSearch: () => void;
  performSemanticSearch: () => Promise<void>;
  toggleSelection: (id: string, multi: boolean) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  addBookmark: (bm: Partial<BookmarkNode>, parentId: string) => void;
  updateBookmark: (id: string, updates: Partial<BookmarkNode>) => void;
  deleteBookmarks: (ids: string[]) => void;
  moveBookmarks: (ids: string[], targetParentId: string) => void;
  batchAddTags: (ids: string[], tags: string[]) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  refreshTree: () => void;
  stageImportJson: (json: string) => void;
  stageImportHtml: (html: string) => void;
  confirmImport: (selectedIds: Set<string>) => void;
  cancelImport: () => void;
  testWebDavConnection: () => Promise<{success: boolean, message: string}>;
  saveToWebDav: () => Promise<{success: boolean, message: string}>;
  testAiSettings: () => Promise<{success: boolean, message: string}>;
  smartOrganizeLibrary: () => Promise<void>;
  t: (key: string) => string;
  resetNavigation: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'system',
  language: Language.ZH_CN,
  webDav: { enabled: false, url: '', username: '', password: '' },
  localSync: { autoSync: false, interval: 'daily', strategy: 'merge' },
  webDavSync: { autoSync: false, interval: 'daily', strategy: 'merge' },
  aiProvider: 'gemini',
  aiModel: 'gemini-2.5-flash'
};

// Expanded Dictionary
const DICTIONARY: Record<string, Record<string, string>> = {
  [Language.ZH_CN]: {
    'My Folders': '我的文件夹',
    'Smart Tags': '智能标签',
    'All Bookmarks': '所有书签',
    'Home': '主页',
    'Recent': '最近访问',
    'Settings': '设置',
    'General': '常规',
    'Appearance': '外观',
    'Sync & WebDAV': '同步与 WebDAV',
    'Backup & Restore': '备份与恢复',
    'Test Connection': '测试连接',
    'Export Data': '导出数据',
    'Import Data': '导入数据',
    'Export HTML': '导出 HTML',
    'Import HTML': '导入 HTML',
    'Add Folder': '新建文件夹',
    'Add Bookmark': '添加书签',
    'Search bookmarks': '搜索书签、标签...',
    'Light': '浅色',
    'Dark': '深色',
    'System': '跟随系统',
    'Language': '语言',
    'AI Configuration': 'AI 配置',
    'WebDAV Configuration': 'WebDAV 配置',
    'Server URL': '服务器地址',
    'Username': '用户名',
    'Password': '密码',
    'Enable WebDAV Sync': '启用 WebDAV 同步',
    'Connection Successful': '连接成功',
    'Connection Failed': '连接失败',
    'Import Successful': '导入成功',
    'Invalid File': '无效文件',
    'AI Classify': 'AI 智能分类',
    'Smart Organize': '一键智能整理',
    'Thinking...': '思考中...',
    'Edit Bookmark': '编辑书签',
    'Save': '保存',
    'Cancel': '取消',
    'Title': '标题',
    'URL': '网址',
    'Tags': '标签',
    'Summary': '简介',
    'Auto-Generate': '自动生成',
    'Folders': '文件夹',
    'No bookmarks found': '此处没有书签',
    'Selected': '项已选择',
    'Batch Actions': '批量操作',
    'Delete': '删除',
    'Move to': '移动到',
    'Add Tags': '添加标签',
    'Import Wizard': '导入向导',
    'Select Bookmarks to Import': '选择要导入的书签',
    'Import Selected': '导入选中',
    'No file selected': '未选择文件',
    'Select Destination': '选择目标文件夹',
    'Batch Tagging': '批量添加标签',
    'Enter tags separated by commas': '输入标签，用逗号分隔',
    'Root': '根目录',
    'Move': '移动',
    'Select All': '全选',
    'Expand All': '展开全部',
    'Collapse All': '折叠全部',
    'Testing...': '测试中...',
    'Checking Connection': '正在检查连接...',
    'WebDAV Success': 'WebDAV 连接成功！',
    'WebDAV Failed': '连接失败。请检查 URL 和凭证 (跨域/CORS 限制可能存在)',
    'Full Backup (JSON)': '完整备份 (JSON)',
    'Browser Compatible (HTML)': '浏览器兼容 (HTML)',
    'Backs up everything including settings and AI tags.': '备份所有内容，包括设置和 AI 标签。',
    'Standard bookmarks file for Chrome, Edge, Firefox.': 'Chrome, Edge, Firefox 的标准书签文件。',
    'Custom Background Image': '自定义背景图片',
    'Filter by Tags': '按标签筛选',
    'Clear': '清除',
    'AI Provider': 'AI 提供商',
    'Base URL': 'Base URL (API 地址)',
    'Model Name': '模型名称',
    'Gemini API Key': 'Gemini API Key',
    'Custom API Key': 'Custom API Key',
    'API Key': 'API Key',
    'Organizing...': '正在整理...',
    'Download Extension Icon': '下载扩展图标',
    'Download Icon': '下载图标',
    'Semantic Search': '语义搜索',
    'Search Mode': '搜索模式',
    'New Bookmark': '新书签',
    'Please set Custom API Key in settings.': '请在设置中配置自定义 API Key。',
    'Save Current Page': '收藏当前页',
    'No results found': '未找到结果',
    'Press Enter to search with AI': '按回车键使用 AI 搜索',
    'Sync Now': '立即同步 (保存到云端)',
    'Sync Success': '同步成功',
    'Test AI': '测试 AI 连接',
    'AI Test Passed': 'AI 连接测试通过！',
    'AI Test Failed': 'AI 连接测试失败: ',
    'Extension Icon': '扩展图标',
    'Auto Sync Settings': '自动同步设置',
    'Enable Auto Sync': '启用自动同步',
    'Sync Frequency': '同步频率',
    'Hourly': '每小时',
    'Daily': '每天',
    'On Change': '书签变动时 (实时)',
    'On Open': '扩展打开时',
    'Last Sync': '上次同步',
    'Never': '从未',
    'Sync Strategy': '同步策略',
    'Merge (Recommended)': '合并 (推荐)',
    'Overwrite Remote': '覆盖云端 (强制上传)',
    'Overwrite Local': '覆盖本地 (强制下载)',
    'Real-time': '实时',
    'Startup': '启动时'
  },
  [Language.ZH_TW]: {
    'My Folders': '我的資料夾',
    'Smart Tags': '智能標籤',
    'All Bookmarks': '所有書籤',
    'Home': '主頁',
    'Recent': '最近訪問',
    'Settings': '設置',
    'General': '常規',
    'Appearance': '外觀',
    'Sync & WebDAV': '同步與 WebDAV',
    'Backup & Restore': '備份與恢復',
    'Test Connection': '測試連接',
    'Export Data': '導出數據',
    'Import Data': '導入數據',
    'Export HTML': '導出 HTML',
    'Import HTML': '導入 HTML',
    'Add Folder': '新建資料夾',
    'Add Bookmark': '添加書籤',
    'Search bookmarks': '搜索書籤、標籤...',
    'Light': '淺色',
    'Dark': '深色',
    'System': '跟隨系統',
    'Language': '語言',
    'AI Configuration': 'AI 配置',
    'WebDAV Configuration': 'WebDAV 配置',
    'Server URL': '服務器地址',
    'Username': '用戶名',
    'Password': '密碼',
    'Enable WebDAV Sync': '啟用 WebDAV 同步',
    'Connection Successful': '連接成功',
    'Connection Failed': '連接失敗',
    'Import Successful': '導入成功',
    'Invalid File': '無效文件',
    'AI Classify': 'AI 智能分類',
    'Smart Organize': '一鍵智能整理',
    'Thinking...': '思考中...',
    'Edit Bookmark': '編輯書籤',
    'Save': '保存',
    'Cancel': '取消',
    'Title': '標題',
    'URL': '網址',
    'Tags': '標籤',
    'Summary': '簡介',
    'Auto-Generate': '自動生成',
    'Folders': '資料夾',
    'No bookmarks found': '此處沒有書籤',
    'Selected': '項已選擇',
    'Batch Actions': '批量操作',
    'Delete': '刪除',
    'Move to': '移動到',
    'Add Tags': '添加標籤',
    'Import Wizard': '導入嚮導',
    'Select Bookmarks to Import': '選擇要導入的書籤',
    'Import Selected': '導入選中',
    'No file selected': '未選擇文件',
    'Select Destination': '選擇目標資料夾',
    'Batch Tagging': '批量添加標籤',
    'Enter tags separated by commas': '輸入標籤，用逗號分隔',
    'Root': '根目錄',
    'Move': '移動',
    'Select All': '全選',
    'Expand All': '展開全部',
    'Collapse All': '折疊全部',
    'Testing...': '測試中...',
    'Checking Connection': '正在檢查連接...',
    'WebDAV Success': 'WebDAV 連接成功！',
    'WebDAV Failed': '連接失敗。請檢查 URL 和憑證 (跨域/CORS 限制可能存在)',
    'Full Backup (JSON)': '完整備份 (JSON)',
    'Browser Compatible (HTML)': '瀏覽器兼容 (HTML)',
    'Backs up everything including settings and AI tags.': '備份所有內容，包括設置和 AI 標籤。',
    'Standard bookmarks file for Chrome, Edge, Firefox.': 'Chrome, Edge, Firefox 的標準書籤文件。',
    'Custom Background Image': '自定義背景圖片',
    'Filter by Tags': '按標籤篩選',
    'Clear': '清除',
    'AI Provider': 'AI 提供商',
    'Base URL': 'Base URL (API 地址)',
    'Model Name': '模型名稱',
    'Gemini API Key': 'Gemini API Key',
    'Custom API Key': 'Custom API Key',
    'API Key': 'API Key',
    'Organizing...': '正在整理...',
    'Download Extension Icon': '下載擴展圖標',
    'Download Icon': '下載圖標',
    'Semantic Search': '語義搜索',
    'Search Mode': '搜索模式',
    'New Bookmark': '新書籤',
    'Please set Custom API Key in settings.': '請在設置中配置自定義 API Key。',
    'Save Current Page': '收藏當前頁',
    'No results found': '未找到結果',
    'Press Enter to search with AI': '按回車鍵使用 AI 搜索',
    'Sync Now': '立即同步 (保存到雲端)',
    'Sync Success': '同步成功',
    'Test AI': '測試 AI 連接',
    'AI Test Passed': 'AI 連接測試通過！',
    'AI Test Failed': 'AI 連接測試失敗: ',
    'Extension Icon': '擴展圖標',
    'Auto Sync Settings': '自動同步設置',
    'Enable Auto Sync': '啟用自動同步',
    'Sync Frequency': '同步頻率',
    'Hourly': '每小時',
    'Daily': '每天',
    'On Change': '書籤變動時 (實時)',
    'On Open': '擴展打開時',
    'Last Sync': '上次同步',
    'Never': '從未',
    'Sync Strategy': '同步策略',
    'Merge (Recommended)': '合併 (推薦)',
    'Overwrite Remote': '覆蓋雲端 (強制上傳)',
    'Overwrite Local': '覆蓋本地 (強制下載)',
    'Real-time': '實時',
    'Startup': '啟動時'
  },
  [Language.JA]: {
    'My Folders': 'マイフォルダ',
    'Smart Tags': 'スマートタグ',
    'All Bookmarks': 'すべてのブックマーク',
    'Home': 'ホーム',
    'Recent': '最近',
    'Settings': '設定',
    'General': '一般',
    'Appearance': '外観',
    'Sync & WebDAV': '同期 & WebDAV',
    'Backup & Restore': 'バックアップと復元',
    'Test Connection': '接続テスト',
    'Export Data': 'データのエクスポート',
    'Import Data': 'データのインポート',
    'Export HTML': 'HTMLのエクスポート',
    'Import HTML': 'HTMLのインポート',
    'Add Folder': 'フォルダを追加',
    'Add Bookmark': 'ブックマークを追加',
    'Search bookmarks': 'ブックマークを検索...',
    'Light': 'ライト',
    'Dark': 'ダーク',
    'System': 'システム',
    'Language': '言語',
    'AI Configuration': 'AI設定',
    'WebDAV Configuration': 'WebDAV設定',
    'Server URL': 'サーバーURL',
    'Username': 'ユーザー名',
    'Password': 'パスワード',
    'Enable WebDAV Sync': 'WebDAV同期を有効にする',
    'Connection Successful': '接続成功',
    'Connection Failed': '接続失敗',
    'Import Successful': 'インポート成功',
    'Invalid File': '無効なファイル',
    'AI Classify': 'AI分類',
    'Smart Organize': 'スマート整理',
    'Thinking...': '思考中...',
    'Edit Bookmark': 'ブックマークを編集',
    'Save': '保存',
    'Cancel': 'キャンセル',
    'Title': 'タイトル',
    'URL': 'URL',
    'Tags': 'タグ',
    'Summary': '概要',
    'Auto-Generate': '自動生成',
    'Folders': 'フォルダ',
    'No bookmarks found': 'ブックマークが見つかりません',
    'Selected': '件選択中',
    'Batch Actions': '一括操作',
    'Delete': '削除',
    'Move to': '移動',
    'Add Tags': 'タグを追加',
    'Import Wizard': 'インポートウィザード',
    'Select Bookmarks to Import': 'インポートするブックマークを選択',
    'Import Selected': '選択項目をインポート',
    'No file selected': 'ファイルが選択されていません',
    'Select Destination': '移動先を選択',
    'Batch Tagging': '一括タグ付け',
    'Enter tags separated by commas': 'タグをカンマ区切りで入力',
    'Root': 'ルート',
    'Move': '移動',
    'Select All': 'すべて選択',
    'Expand All': 'すべて展開',
    'Collapse All': 'すべて折りたたむ',
    'Testing...': 'テスト中...',
    'Checking Connection': '接続を確認中...',
    'WebDAV Success': 'WebDAV接続成功！',
    'WebDAV Failed': '接続失敗。URLと認証情報を確認してください',
    'Full Backup (JSON)': '完全バックアップ (JSON)',
    'Browser Compatible (HTML)': 'ブラウザ互換 (HTML)',
    'Backs up everything including settings and AI tags.': '設定やAIタグを含むすべてをバックアップします。',
    'Standard bookmarks file for Chrome, Edge, Firefox.': 'Chrome, Edge, Firefox用の標準ブックマークファイル。',
    'Custom Background Image': 'カスタム背景画像',
    'Filter by Tags': 'タグでフィルタ',
    'Clear': 'クリア',
    'AI Provider': 'AIプロバイダー',
    'Base URL': 'Base URL',
    'Model Name': 'モデル名',
    'Gemini API Key': 'Gemini APIキー',
    'Custom API Key': 'カスタムAPIキー',
    'API Key': 'APIキー',
    'Organizing...': '整理中...',
    'Download Extension Icon': '拡張機能アイコンをダウンロード',
    'Download Icon': 'アイコンをダウンロード',
    'Semantic Search': 'セマンティック検索',
    'Search Mode': '検索モード',
    'New Bookmark': '新しいブックマーク',
    'Please set Custom API Key in settings.': '設定でカスタムAPIキーを設定してください。',
    'Save Current Page': '現在のページを保存',
    'No results found': '結果が見つかりません',
    'Press Enter to search with AI': 'EnterキーでAI検索',
    'Sync Now': '今すぐ同期',
    'Sync Success': '同期成功',
    'Test AI': 'AI接続テスト',
    'AI Test Passed': 'AI接続成功！',
    'AI Test Failed': 'AI接続失敗: ',
    'Extension Icon': '拡張機能アイコン',
    'Auto Sync Settings': '自動同期設定',
    'Enable Auto Sync': '自動同期を有効化',
    'Sync Frequency': '同期頻度',
    'Hourly': '1時間ごと',
    'Daily': '毎日',
    'On Change': '変更時 (リアルタイム)',
    'On Open': '起動時',
    'Last Sync': '最終同期',
    'Never': 'なし',
    'Sync Strategy': '同期戦略',
    'Merge (Recommended)': 'マージ (推奨)',
    'Overwrite Remote': 'クラウドを上書き (アップロード)',
    'Overwrite Local': 'ローカルを上書き (ダウンロード)',
    'Real-time': 'リアルタイム',
    'Startup': '起動時'
  },
  [Language.EN]: {
    'Auto Sync Settings': 'Auto Sync Settings',
    'Enable Auto Sync': 'Enable Auto Sync',
    'Sync Frequency': 'Sync Frequency',
    'Hourly': 'Hourly',
    'Daily': 'Daily',
    'On Change': 'On Change (Real-time)',
    'On Open': 'On Startup',
    'Last Sync': 'Last Sync',
    'Never': 'Never',
    'Sync Strategy': 'Sync Strategy',
    'Merge (Recommended)': 'Merge (Recommended)',
    'Overwrite Remote': 'Overwrite Remote (Force Upload)',
    'Overwrite Local': 'Overwrite Local (Force Download)',
    'Real-time': 'Real-time',
    'Startup': 'Startup'
  }
};

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookmarks, setBookmarks] = useState<BookmarkNode>(loadBookmarks());
  const [flatBookmarks, setFlatBookmarks] = useState<BookmarkNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = localStorage.getItem('ai_bm_settings');
    return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings;
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bug 4 Fix: Default to Semantic Search = True
  const [isSemanticSearch, setIsSemanticSearch] = useState(true);
  const [searchResults, setSearchResults] = useState<Set<string>>(new Set());
  const [semanticSearchPerformed, setSemanticSearchPerformed] = useState(false);

  const [importCandidate, setImportCandidate] = useState<BookmarkNode | null>(null);

  useEffect(() => {
    setFlatBookmarks(flattenTree(bookmarks));
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  // Derived unique tags
  const allTags = useMemo(() => {
    return Array.from(new Set(flatBookmarks.flatMap(b => b.tags || []))).sort();
  }, [flatBookmarks]);

  useEffect(() => {
    localStorage.setItem('ai_bm_settings', JSON.stringify(settings));
    const root = window.document.documentElement;
    if (settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings]);

  // Auto-Sync Logic: On Change
  const isInitialMount = React.useRef(true);
  useEffect(() => {
      if (isInitialMount.current) {
          isInitialMount.current = false;
          return;
      }
      if (settings.webDavSync.autoSync && settings.webDavSync.interval === 'on_change') {
          const timer = setTimeout(() => {
              saveToWebDav();
          }, 5000); // 5s debounce
          return () => clearTimeout(timer);
      }
  }, [bookmarks, settings.webDavSync]);

  // Auto-Sync Logic: Time Based
  useEffect(() => {
      if (!settings.webDavSync.autoSync) return;
      
      const checkAndSync = () => {
          const last = settings.webDavSync.lastSyncTime || 0;
          const now = Date.now();
          const diff = now - last;
          
          let shouldSync = false;
          if (settings.webDavSync.interval === 'hourly' && diff > 3600000) shouldSync = true;
          if (settings.webDavSync.interval === 'daily' && diff > 86400000) shouldSync = true;
          
          if (shouldSync) {
              saveToWebDav();
          }
      };

      const interval = setInterval(checkAndSync, 60000); // Check every minute
      checkAndSync(); // Check immediately
      return () => clearInterval(interval);
  }, [settings.webDavSync]);

  // Auto-Sync Logic: On Open
  useEffect(() => {
      if (settings.webDavSync.autoSync && settings.webDavSync.interval === 'on_open') {
           saveToWebDav();
      }
  }, []); // Runs once on mount

  const t = useCallback((key: string): string => {
    const lang = settings.language;
    const val = DICTIONARY[lang]?.[key] || DICTIONARY[Language.EN]?.[key] || key;
    return val;
  }, [settings.language]);

  // Bug 5 Fix: Reset Navigation state
  const resetNavigation = useCallback(() => {
      setSearchQuery('');
      setSearchResults(new Set());
      setSemanticSearchPerformed(false);
  }, []);

  const toggleSelection = useCallback((id: string, multi: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(multi ? prev : []);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const refreshTree = useCallback(() => {
    setBookmarks(loadBookmarks());
  }, []);

  const addBookmark = useCallback((bm: Partial<BookmarkNode>, parentId: string) => {
    const newNode: BookmarkNode = {
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      parentId,
      title: bm.title || t('New Bookmark'),
      url: bm.url,
      type: bm.type || 'bookmark',
      dateAdded: Date.now(),
      children: bm.type === 'folder' ? [] : undefined,
      tags: bm.tags || [],
      summary: bm.summary || '',
      aiClassified: bm.aiClassified || false
    };

    setBookmarks(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const addToNode = (node: BookmarkNode) => {
        if (node.id === parentId) {
          if (!node.children) node.children = [];
          node.children.push(newNode);
          return true;
        }
        if (node.children) {
          for (const child of node.children) {
            if (addToNode(child)) return true;
          }
        }
        return false;
      };
      if (!addToNode(copy)) {
         copy.children.push(newNode);
      }
      return copy;
    });
  }, [t]);

  const updateBookmark = useCallback((id: string, updates: Partial<BookmarkNode>) => {
    setBookmarks(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const updateNode = (node: BookmarkNode) => {
        if (node.id === id) {
          Object.assign(node, updates);
          return true;
        }
        if (node.children) {
          for (const child of node.children) {
            if (updateNode(child)) return true;
          }
        }
        return false;
      };
      updateNode(copy);
      return copy;
    });
  }, []);

  const deleteBookmarks = useCallback((ids: string[]) => {
    setBookmarks(prev => {
      let copy = JSON.parse(JSON.stringify(prev));
      ids.forEach(id => {
        copy = deleteNodeRecursive(copy, id);
      });
      return copy;
    });
    setSelectedIds(new Set());
  }, []);

  const moveBookmarks = useCallback((ids: string[], targetParentId: string) => {
     setBookmarks(prev => {
         const copy = JSON.parse(JSON.stringify(prev));
         const nodesToMove: BookmarkNode[] = [];
         const remove = (node: BookmarkNode, id: string): boolean => {
             if (!node.children) return false;
             const idx = node.children.findIndex(c => c.id === id);
             if (idx !== -1) {
                 const moved = node.children[idx];
                 moved.parentId = targetParentId;
                 nodesToMove.push(moved);
                 node.children.splice(idx, 1);
                 return true;
             }
             return node.children.some(c => remove(c, id));
         };
         ids.forEach(id => {
             if (id !== targetParentId) remove(copy, id);
         });
         const add = (node: BookmarkNode): boolean => {
             if (node.id === targetParentId) {
                 if (!node.children) node.children = [];
                 node.children.push(...nodesToMove);
                 return true;
             }
             if (node.children) {
                 return node.children.some(c => add(c));
             }
             return false;
         };
         add(copy);
         return copy;
     });
     setSelectedIds(new Set());
  }, []);

  const batchAddTags = useCallback((ids: string[], newTags: string[]) => {
      setBookmarks(prev => {
          const copy = JSON.parse(JSON.stringify(prev));
          const process = (node: BookmarkNode) => {
              if (ids.includes(node.id) && node.type === 'bookmark') {
                  const existing = new Set(node.tags || []);
                  newTags.forEach(tag => existing.add(tag));
                  node.tags = Array.from(existing);
              }
              node.children?.forEach(process);
          };
          process(copy);
          return copy;
      });
      setSelectedIds(new Set());
  }, []);

  const updateSettings = useCallback((s: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...s }));
  }, []);

  const stageImportJson = useCallback((jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      const root = data.bookmarks || (data.id === 'root' ? data : null);
      if (root) {
        setImportCandidate(root);
      } else {
        alert(t('Invalid File'));
      }
    } catch (e) {
      console.error(e);
      alert(t('Invalid File'));
    }
  }, [t]);

  const stageImportHtml = useCallback((htmlStr: string) => {
    try {
      const newRoot = parseNetscapeHtml(htmlStr);
      setImportCandidate(newRoot);
    } catch (e) {
      console.error(e);
      alert(t('Invalid File'));
    }
  }, [t]);

  const confirmImport = useCallback((selectedIdsToImport: Set<string>) => {
      if (!importCandidate) return;
      const filtered = filterTreeByIds(importCandidate, selectedIdsToImport);
      if (!filtered) {
          setImportCandidate(null);
          return;
      }
      setBookmarks(prev => {
          const copy = JSON.parse(JSON.stringify(prev));
          if (filtered.children) {
               mergeIntoTree(copy, filtered.children);
          }
          return copy;
      });
      alert(t('Import Successful'));
      setImportCandidate(null);
  }, [importCandidate, t]);

  const cancelImport = useCallback(() => {
      setImportCandidate(null);
  }, []);

  // WebDAV Logic - Connection Test
  const testWebDavConnection = useCallback(async (): Promise<{success: boolean, message: string}> => {
    const { url, username, password } = settings.webDav;
    if (!url) return { success: false, message: 'URL is empty' };

    try {
      const headers = new Headers();
      headers.set('Authorization', 'Basic ' + btoa(username + ":" + password));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Using method 'OPTIONS' or 'PROPFIND' for testing existence
      const res = await fetch(url, {
        method: 'OPTIONS',
        headers: headers,
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok || res.status === 401 || res.status === 200 || res.status === 201) {
         return { success: true, message: t('WebDAV Success') };
      }
      return { success: false, message: `Status: ${res.status}` };
    } catch (e: any) {
      console.warn("WebDAV Check Failed", e);
      return { success: false, message: t('WebDAV Failed') + " (" + e.message + ")" };
    }
  }, [settings.webDav, t]);

  // Bug 1 Fix: WebDAV Save (PUT)
  const saveToWebDav = useCallback(async (): Promise<{success: boolean, message: string}> => {
      const { url, username, password } = settings.webDav;
      if (!url) return { success: false, message: 'URL not configured' };

      const dataToSave = {
          version: "1.0",
          bookmarks: bookmarks,
          settings: settings
      };

      try {
          const headers = new Headers();
          headers.set('Authorization', 'Basic ' + btoa(username + ":" + password));
          headers.set('Content-Type', 'application/json');

          const res = await fetch(url, {
              method: 'PUT',
              headers: headers,
              body: JSON.stringify(dataToSave)
          });

          if (res.ok || res.status === 201 || res.status === 204) {
              // Update last sync time on success
              const now = Date.now();
              setSettings(prev => ({
                  ...prev,
                  webDavSync: { ...prev.webDavSync, lastSyncTime: now }
              }));
              return { success: true, message: t('Sync Success') };
          }
          return { success: false, message: `Save Failed: ${res.status}` };
      } catch (e: any) {
          return { success: false, message: e.message };
      }
  }, [settings, bookmarks, t]);

  // Bug 3 Fix: AI Connection Test
  const testAiSettings = useCallback(async () => {
      return await testAiConnection(settings);
  }, [settings]);

  const smartOrganizeLibrary = useCallback(async () => {
      if (settings.aiProvider === 'custom' && !settings.customApiKey) {
          alert("Please configure Custom API Key in settings first.");
          return;
      }
      const unclassified = flatBookmarks.filter(b => b.type === 'bookmark' && b.url && !b.aiClassified);
      const batch = unclassified.slice(0, 5); // Conservative batch

      if (batch.length === 0) {
          alert("All bookmarks are already classified!");
          return;
      }
      let updatedCount = 0;
      for (const bm of batch) {
          if (!bm.url) continue;
          try {
              const result = await analyzeBookmarkWithAi(bm.title, bm.url, settings);
              updateBookmark(bm.id, {
                  tags: [...new Set([...(bm.tags || []), ...result.tags])],
                  summary: result.summary,
                  aiClassified: true
              });
              updatedCount++;
          } catch (e) {
              console.error("Failed to analyze", bm.title);
          }
      }
      if (updatedCount > 0) {
        alert(`Organized ${updatedCount} bookmarks.`);
      }
  }, [flatBookmarks, settings, updateBookmark]);

  const toggleSemanticSearch = useCallback(() => {
      setIsSemanticSearch(prev => {
          const newState = !prev;
          if (!newState) {
              setSearchResults(new Set());
              setSemanticSearchPerformed(false);
          }
          return newState;
      });
  }, []);

  const handleSetSearchQuery = useCallback((q: string) => {
      setSearchQuery(q);
      setSemanticSearchPerformed(false);
  }, []);

  const performSemanticSearch = useCallback(async () => {
      if (!searchQuery.trim()) return;
      const candidates = flatBookmarks.filter(b => b.type === 'bookmark');
      if (candidates.length === 0) return;

      const ids = await searchBookmarksWithAi(searchQuery, candidates, settings);
      setSearchResults(new Set(ids));
      setSemanticSearchPerformed(true);
  }, [searchQuery, flatBookmarks, settings]);

  return (
    <StoreContext.Provider value={{
      bookmarks, flatBookmarks, allTags, selectedIds, settings, searchQuery, importCandidate,
      isSemanticSearch, searchResults, semanticSearchPerformed,
      setSearchQuery: handleSetSearchQuery, toggleSelection, selectAll, clearSelection,
      addBookmark, updateBookmark, deleteBookmarks, moveBookmarks, batchAddTags, updateSettings, refreshTree,
      stageImportJson, stageImportHtml, confirmImport, cancelImport, 
      testWebDavConnection, saveToWebDav, testAiSettings, smartOrganizeLibrary, t,
      toggleSemanticSearch, performSemanticSearch, resetNavigation
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};