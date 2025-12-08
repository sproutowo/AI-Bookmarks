import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/Store';
import { Sidebar } from './components/Sidebar'; // 注意：改为 './Sidebar' 或 './components/Sidebar'
import { BookmarkList } from './components/BookmarkList';
import { SettingsPanel } from './components/Settings';
import { ViewMode, BookmarkNode } from './types';
import { Search, Plus, X, ChevronRight, ChevronDown, FolderOpen, Check, Folder, BrainCircuit, Loader2, Save, Tag, Menu, LayoutGrid, BookmarkPlus } from 'lucide-react';
import { analyzeBookmarkWithAi } from './services/gemini';

declare var chrome: any;

// ... Helper Components (ImportTreeItem, FolderSelectTree) remain same ...
const ImportTreeItem: React.FC<{ node: BookmarkNode, level: number, selectedIds: Set<string>, toggle: (id: string, checked: boolean) => void }> = ({ node, level, selectedIds, toggle }) => {
    const [expanded, setExpanded] = useState(true);
    const checked = selectedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const handleCheck = (e: React.ChangeEvent<HTMLInputElement>) => toggle(node.id, e.target.checked);
    return (
        <div className="select-none">
            <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-gray-700" style={{ paddingLeft: `${level * 16}px` }}>
                <div className="mr-2 cursor-pointer p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => setExpanded(!expanded)}>
                     {hasChildren ? (expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <span className="w-3.5 inline-block"/>}
                </div>
                <input type="checkbox" checked={checked} onChange={handleCheck} className="mr-2 rounded text-primary focus:ring-primary" />
                {node.type === 'folder' ? <FolderOpen size={16} className="text-yellow-500 mr-2"/> : <img src={`https://www.google.com/s2/favicons?domain=${node.url}&sz=16`} className="w-4 h-4 mr-2" onError={(e)=>e.currentTarget.style.display='none'}/>}
                <span className="text-sm truncate text-gray-700 dark:text-gray-200">{node.title}</span>
            </div>
            {expanded && node.children && node.children.map((child: BookmarkNode) => (
                <ImportTreeItem key={child.id} node={child} level={level + 1} selectedIds={selectedIds} toggle={toggle} />
            ))}
        </div>
    );
};

const FolderSelectTree: React.FC<{ node: BookmarkNode, level: number, onSelect: (id: string) => void }> = ({ node, level, onSelect }) => {
     if (node.type !== 'folder') return null;
     return (
         <>
            <div className="py-1.5 px-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 rounded flex items-center transition-colors" style={{ paddingLeft: `${level * 12 + 4}px` }} onClick={() => onSelect(node.id)}>
                <Folder size={16} className="mr-2 text-yellow-500"/>
                <span className="text-sm text-gray-700 dark:text-gray-200">{node.title}</span>
            </div>
            {/* 修复：添加 BookmarkNode 类型 */}
            {node.children?.map((c: BookmarkNode) => <FolderSelectTree key={c.id} node={c} level={level+1} onSelect={onSelect}/>)}
         </>
     );
};

const MainLayout: React.FC = () => {
  const { settings, searchQuery, setSearchQuery, addBookmark, updateBookmark, importCandidate, confirmImport, cancelImport, moveBookmarks, batchAddTags, bookmarks, t, isSemanticSearch, toggleSemanticSearch, performSemanticSearch, resetNavigation } = useStore();
  const [currentView, setView] = useState<ViewMode>(ViewMode.All);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 使用 Partial<BookmarkNode> | null 来明确类型
  const [editingBookmark, setEditingBookmark] = useState<Partial<BookmarkNode> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [importSelection, setImportSelection] = useState<Set<string>>(new Set());
  
  const bgStyle = settings.customBackground ? { backgroundImage: `url(${settings.customBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};

  useEffect(() => {
      if (importCandidate) {
          const allIds = new Set<string>();
          const traverse = (n: BookmarkNode) => { allIds.add(n.id); n.children?.forEach(traverse); };
          traverse(importCandidate);
          setImportSelection(allIds);
      }
  }, [importCandidate]);

  // Fix Bug 5: Reset filters when view changes from Sidebar
  const handleViewChange = (mode: ViewMode) => {
      setView(mode);
      if (mode === ViewMode.All || mode === ViewMode.Recent) {
          resetNavigation(); // Clears semantic results and search query
      }
  };

  const toggleImportNode = (id: string, checked: boolean) => {
      setImportSelection(prev => {
          const next = new Set(prev);
          const findAndToggle = (root: BookmarkNode) => {
              if (root.id === id) {
                   const toggleDescendants = (n: BookmarkNode) => { if (checked) next.add(n.id); else next.delete(n.id); n.children?.forEach(toggleDescendants); };
                   if (checked) next.add(root.id); else next.delete(root.id);
                   root.children?.forEach(toggleDescendants);
                   return true;
              }
              if (root.children) { for (const c of root.children) { if (findAndToggle(c)) return true; } }
              return false;
          };
          if (importCandidate) findAndToggle(importCandidate);
          return next;
      });
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value);
  const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (isSemanticSearch && searchQuery.trim()) {
            setIsSearching(true);
            await performSemanticSearch();
            setIsSearching(false);
        }
      }
  };

  const openAddModal = () => {
    setEditingBookmark({ title: '', url: '', type: 'bookmark', parentId: selectedFolderId || 'root' });
    setIsModalOpen(true);
  };

  // 修复：添加类型
  const handleEdit = (bm: BookmarkNode) => { setEditingBookmark({ ...bm }); setIsModalOpen(true); };
  const handleSave = () => {
    if (!editingBookmark) return;
    if (editingBookmark.id) updateBookmark(editingBookmark.id, editingBookmark as BookmarkNode);
    else addBookmark(editingBookmark, editingBookmark.parentId || 'root');
    setIsModalOpen(false);
    setEditingBookmark(null);
  };

  const handleAutoAnalyze = async () => {
    if (!editingBookmark?.url) return;
    if (settings.aiProvider === 'custom' && !settings.customApiKey) { alert(t('Please set Custom API Key in settings.')); return; }
    setAiLoading(true);
    try {
      const result = await analyzeBookmarkWithAi(editingBookmark.title || '', editingBookmark.url, settings);
      // 修复：添加类型 (Partial<BookmarkNode> | null)
      setEditingBookmark((prev: Partial<BookmarkNode> | null) => (prev ? { ...prev, tags: [...new Set([...(prev?.tags || []), ...result.tags])], summary: result.summary } : null));
    } catch (error) { console.error(error); alert('AI Analysis failed. Please check settings.'); } finally { setAiLoading(false); }
  };

  const handleBatchMove = (ids: string[]) => { setMoveIds(ids); setIsMoveModalOpen(true); };
  const confirmMove = (targetId: string) => { moveBookmarks(moveIds, targetId); setIsMoveModalOpen(false); };
  const handleBatchTag = (ids: string[]) => { setTagIds(ids); setTagInput(''); setIsTagModalOpen(true); };
  const confirmBatchTag = () => {
      if (tagInput.trim()) { const tags = tagInput.split(',').map(s => s.trim()).filter(Boolean); batchAddTags(tagIds, tags); }
      setIsTagModalOpen(false);
  };

  // One-Click Save logic for Side Panel
  const handleSaveCurrentPage = () => {
     if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
         // IMPORTANT: Use lastFocusedWindow: true to capture the browser window, not the side panel itself
         chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs: any[]) => {
             const activeTab = tabs[0];
             if (activeTab && activeTab.url) {
                 const newBookmark: Partial<BookmarkNode> = {
                     title: activeTab.title || 'New Bookmark',
                     url: activeTab.url,
                     type: 'bookmark',
                     parentId: selectedFolderId || 'root',
                     tags: [],
                     summary: ''
                 };
                 setEditingBookmark(newBookmark);
                 setIsModalOpen(true);
                 setTimeout(handleAutoAnalyze, 500); 
             } else {
                 alert("Could not retrieve active tab. Please ensure you are focused on a web page.");
             }
         });
     } else {
         const dummy: Partial<BookmarkNode> = { title: 'Current Page (Demo)', url: 'https://example.com/demo-page', type: 'bookmark', parentId: selectedFolderId || 'root' };
         setEditingBookmark(dummy);
         setIsModalOpen(true);
         setTimeout(handleAutoAnalyze, 500);
     }
  };

  return (
    <div className={`flex flex-col h-screen text-gray-800 dark:text-gray-100 font-sans transition-colors duration-200 ${settings.theme === 'dark' ? 'dark' : ''}`} style={bgStyle}>
      {/* Header */}
      <div className="h-14 bg-white/90 dark:bg-gray-900/90 backdrop-blur shadow-sm z-20 flex items-center px-2 justify-between border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center">
            <button className="lg:hidden mr-2 p-1.5 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={20} />
            </button>
            <div className="font-bold text-lg text-primary hidden md:block">AI Bookmarks</div>
        </div>

        <div className="flex-1 max-w-sm mx-2 relative">
          <input
            type="text"
            placeholder={t('Search bookmarks')}
            className={`w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-all ${isSemanticSearch ? 'border-purple-300 ring-purple-100 focus:ring-purple-500 bg-purple-50 dark:bg-gray-800' : 'border-gray-300 focus:ring-primary dark:bg-gray-800 dark:border-gray-700'}`}
            value={searchQuery}
            onChange={handleSearch}
            onKeyDown={handleSearchKeyDown}
          />
          <Search className="absolute left-2.5 top-2 text-gray-400" size={16} />
          {isSearching && <Loader2 className="absolute right-9 top-2 text-primary animate-spin" size={16}/>}
          <button onClick={toggleSemanticSearch} className={`absolute right-1.5 top-1 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isSemanticSearch ? 'text-purple-600' : 'text-gray-400'}`} title={t('Semantic Search')}>
             <BrainCircuit size={16} />
          </button>
        </div>

        <div className="flex items-center space-x-1">
            <button onClick={handleSaveCurrentPage} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg" title={t('Save Current Page')}>
                <BookmarkPlus size={20} />
            </button>
            <button onClick={openAddModal} className="text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 p-2 rounded-lg">
                <Plus size={20} />
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="hidden lg:block w-60 h-full z-10">
           <Sidebar 
             currentView={currentView} setView={handleViewChange} selectedFolderId={selectedFolderId} setSelectedFolderId={setSelectedFolderId} selectedTag={selectedTag} setSelectedTag={setSelectedTag}
           />
        </div>

        {isMobileMenuOpen && (
            <div className="absolute inset-0 z-30 lg:hidden">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 shadow-xl animate-fade-in-right">
                    <Sidebar 
                        currentView={currentView} setView={handleViewChange} selectedFolderId={selectedFolderId} setSelectedFolderId={setSelectedFolderId} selectedTag={selectedTag} setSelectedTag={setSelectedTag} onMobileClose={() => setIsMobileMenuOpen(false)}
                    />
                </div>
            </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {currentView === ViewMode.Settings ? (
            <SettingsPanel />
          ) : (
            <BookmarkList viewMode={currentView} folderId={selectedFolderId} tagId={selectedTag} onEdit={handleEdit} onBatchMove={handleBatchMove} onBatchTag={handleBatchTag} />
          )}
        </div>
      </div>

      {/* Modals ... */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-base font-bold">{editingBookmark?.id ? t('Edit Bookmark') : t('Add Bookmark')}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">{t('URL')}</label>
                <div className="flex">
                  <input type="text" className="flex-1 p-1.5 text-sm rounded-l border dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={editingBookmark?.url || ''} onChange={(e) => setEditingBookmark((prev: Partial<BookmarkNode> | null) => (prev ? { ...prev, url: e.target.value } : null))} placeholder="https://..." />
                  <button onClick={handleAutoAnalyze} disabled={aiLoading || !editingBookmark?.url} className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 px-3 py-1.5 rounded-r border border-l-0 border-purple-200 dark:border-purple-700">{aiLoading ? <Loader2 size={16} className="animate-spin"/> : <BrainCircuit size={16}/>}</button>
                </div>
              </div>
              {/* 修复：添加类型 (Partial<BookmarkNode> | null) */}
              <div><label className="block text-xs font-medium mb-1">{t('Title')}</label><input type="text" className="w-full p-1.5 text-sm rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={editingBookmark?.title || ''} onChange={(e) => setEditingBookmark((prev: Partial<BookmarkNode> | null) => (prev ? { ...prev, title: e.target.value } : null))} /></div>
              {/* 修复：添加类型 (Partial<BookmarkNode> | null) */}
              <div><label className="block text-xs font-medium mb-1">{t('Tags')}</label><input type="text" className="w-full p-1.5 text-sm rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="comma separated" value={editingBookmark?.tags?.join(', ') || ''} onChange={(e) => setEditingBookmark((prev: Partial<BookmarkNode> | null) => (prev ? { ...prev, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) } : null))} /></div>
              {/* 修复：添加类型 (Partial<BookmarkNode> | null) */}
              <div><label className="block text-xs font-medium mb-1">{t('Summary')}</label><textarea className="w-full p-1.5 text-sm rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white h-20" value={editingBookmark?.summary || ''} onChange={(e) => setEditingBookmark((prev: Partial<BookmarkNode> | null) => (prev ? { ...prev, summary: e.target.value } : null))} /></div>
            </div>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 flex justify-end space-x-2">
              <button onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 rounded">{t('Cancel')}</button>
              <button onClick={handleSave} className="px-3 py-1.5 bg-primary text-white text-xs rounded hover:bg-primary/90 flex items-center"><Save size={14} className="mr-1" /> {t('Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Simplified other modals for brevity, logic remains identical to previous fully expanded version */}
      {importCandidate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg h-[80vh] flex flex-col">
                  <div className="px-4 py-3 border-b flex justify-between"><h3 className="font-bold">{t('Import Wizard')}</h3><button onClick={cancelImport}><X size={18}/></button></div>
                  <div className="flex-1 overflow-y-auto p-4"><ImportTreeItem node={importCandidate} level={0} selectedIds={importSelection} toggle={toggleImportNode}/></div>
                  <div className="p-4 border-t flex justify-end space-x-2"><button onClick={cancelImport} className="px-3 py-1.5 text-sm hover:bg-gray-100 rounded">{t('Cancel')}</button><button onClick={() => confirmImport(importSelection)} className="px-3 py-1.5 bg-primary text-white text-sm rounded">{t('Import Selected')}</button></div>
              </div>
          </div>
      )}
      {isMoveModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm max-h-[60vh] overflow-y-auto">
                   <div className="p-3 border-b font-bold">{t('Select Destination')}</div>
                   {/* 修复：添加类型 (BookmarkNode) */}
                   <div className="p-2"><div className="py-2 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded flex items-center" onClick={() => confirmMove('root')}><LayoutGrid size={16} className="mr-2"/> {t('Root')}</div>{bookmarks.children?.map((c: BookmarkNode) => <FolderSelectTree key={c.id} node={c} level={0} onSelect={confirmMove}/>)}</div>
              </div>
          </div>
      )}
      {isTagModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-xs p-4">
                  <h3 className="font-bold mb-2">{t('Batch Tagging')}</h3>
                  <input type="text" className="w-full border p-2 rounded mb-4 dark:bg-gray-700 dark:text-white" value={tagInput} onChange={e=>setTagInput(e.target.value)} autoFocus />
                  <div className="flex justify-end space-x-2"><button onClick={()=>setIsTagModalOpen(false)} className="px-3 py-1 text-sm bg-gray-100 rounded">{t('Cancel')}</button><button onClick={confirmBatchTag} className="px-3 py-1 text-sm bg-primary text-white rounded">{t('Save')}</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
};

export default App;