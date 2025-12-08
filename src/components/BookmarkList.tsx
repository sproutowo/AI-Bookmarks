import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/Store';
import { ViewMode, BookmarkNode } from '../types';
import { ExternalLink, Trash2, Edit2, Tag, CheckSquare, Square, BrainCircuit, RotateCcw, Folder, Move, Plus, Filter, X, Sparkles } from 'lucide-react';
import { analyzeBookmarkWithAi } from '../services/gemini';

interface BookmarkListProps {
  viewMode: ViewMode;
  folderId: string | null;
  tagId: string | null;
  onEdit: (bm: BookmarkNode) => void;
  onBatchMove: (ids: string[]) => void;
  onBatchTag: (ids: string[]) => void;
}

export const BookmarkList: React.FC<BookmarkListProps> = ({ viewMode, folderId, tagId, onEdit, onBatchMove, onBatchTag }) => {
  const { bookmarks, flatBookmarks, allTags, selectedIds, toggleSelection, selectAll, clearSelection, deleteBookmarks, updateBookmark, settings, searchQuery, isSemanticSearch, searchResults, semanticSearchPerformed, smartOrganizeLibrary, t } = useStore();
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedFilterTags, setSelectedFilterTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (viewMode !== ViewMode.All) {
      setShowFilter(false);
      setSelectedFilterTags(new Set());
    }
  }, [viewMode]);

  const toggleFilterTag = (tag: string) => {
    setSelectedFilterTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const displayedBookmarks = useMemo(() => {
    let list: BookmarkNode[] = [];
    if (viewMode === ViewMode.All) {
      list = flatBookmarks.filter(b => b.type === 'bookmark');
      if (selectedFilterTags.size > 0) {
        list = list.filter(b => b.tags && Array.from(selectedFilterTags).every(t => b.tags!.includes(t)));
      }
    } else if (viewMode === ViewMode.MyFolders && folderId) {
      const findFolder = (node: BookmarkNode): BookmarkNode | null => {
        if (node.id === folderId) return node;
        if (node.children) { for (const c of node.children) { const found = findFolder(c); if (found) return found; } }
        return null;
      };
      const folder = findFolder(bookmarks);
      if (folder && folder.children) list = folder.children;
    } else if (viewMode === ViewMode.SmartTags && tagId) {
      list = flatBookmarks.filter(b => b.tags?.includes(tagId) && b.type === 'bookmark');
    } else if (viewMode === ViewMode.Recent) {
      list = [...flatBookmarks].filter(b => b.type === 'bookmark').sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 50);
    } else {
      list = flatBookmarks;
    }

    if (searchQuery) {
      if (isSemanticSearch) {
          if (semanticSearchPerformed) {
              list = list.filter(b => searchResults.has(b.id));
          } else {
              // Optionally show empty or placeholder if strict, but showing filtered by text while waiting is often better UX
              const q = searchQuery.toLowerCase();
              list = list.filter(b => b.title.toLowerCase().includes(q) || b.url?.toLowerCase().includes(q));
          }
      } else {
          const q = searchQuery.toLowerCase();
          list = list.filter(b => b.title.toLowerCase().includes(q) || b.url?.toLowerCase().includes(q) || b.summary?.toLowerCase().includes(q));
      }
    }
    return list;
  }, [bookmarks, flatBookmarks, viewMode, folderId, tagId, searchQuery, selectedFilterTags, isSemanticSearch, searchResults, semanticSearchPerformed]);

  const handleAiAnalyze = async (ids: string[]) => {
    if (settings.aiProvider === 'custom' && !settings.customApiKey) { alert("Please configure Custom API Key in settings first."); return; }
    const toAnalyze = flatBookmarks.filter(b => ids.includes(b.id) && b.type === 'bookmark' && b.url);
    if (toAnalyze.length === 0) return;
    setAnalyzingIds(new Set([...analyzingIds, ...ids]));
    for (const bm of toAnalyze) {
      if (!bm.url) continue;
      try {
          const result = await analyzeBookmarkWithAi(bm.title, bm.url, settings);
          updateBookmark(bm.id, { tags: [...new Set([...(bm.tags || []), ...result.tags])], summary: result.summary, aiClassified: true });
      } catch (e) { console.error(e); }
    }
    setAnalyzingIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
  };
  
  const handleSmartOrganize = async () => { setIsOrganizing(true); await smartOrganizeLibrary(); setIsOrganizing(false); };
  const allSelected = displayedBookmarks.length > 0 && displayedBookmarks.every(b => selectedIds.has(b.id));

  return (
    <div className="flex-1 flex flex-col h-full bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
      <div className="min-h-12 border-b border-gray-200 dark:border-gray-700 flex flex-col justify-center px-2 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
            <button onClick={() => allSelected ? clearSelection() : selectAll(displayedBookmarks.map(b => b.id))} className="text-gray-500 hover:text-primary flex-shrink-0">
              {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>
            
            {selectedIds.size > 0 ? (
              <>
                <button onClick={() => deleteBookmarks(Array.from(selectedIds))} className="p-1.5 text-red-500 hover:bg-red-50 rounded flex-shrink-0"><Trash2 size={16} /></button>
                <button onClick={() => onBatchMove(Array.from(selectedIds))} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded flex-shrink-0"><Move size={16} /></button>
                <button onClick={() => onBatchTag(Array.from(selectedIds))} className="p-1.5 text-green-500 hover:bg-green-50 rounded flex-shrink-0"><Tag size={16} /></button>
                <button onClick={() => handleAiAnalyze(Array.from(selectedIds))} className={`p-1.5 text-purple-600 hover:bg-purple-50 rounded flex-shrink-0 ${analyzingIds.size > 0 ? 'animate-pulse' : ''}`} disabled={analyzingIds.size > 0}><BrainCircuit size={16} /></button>
              </>
            ) : (
                <>
                  {viewMode === ViewMode.All && (
                      <button onClick={handleSmartOrganize} disabled={isOrganizing} className="px-2 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded text-xs font-bold shadow-sm flex items-center disabled:opacity-50">
                         {isOrganizing ? <RotateCcw size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="mr-1"/>}
                         {isOrganizing ? '...' : t('Smart Organize')}
                      </button>
                  )}
                </>
            )}
          </div>
          <div className="flex items-center">
             {viewMode === ViewMode.All && (
               <button onClick={() => setShowFilter(!showFilter)} className={`p-1.5 rounded transition-colors ${showFilter ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  <Filter size={16}/>
               </button>
             )}
          </div>
        </div>
        {viewMode === ViewMode.All && showFilter && (
           <div className="py-1 border-t border-gray-100 dark:border-gray-700">
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar p-1">
                 {allTags.map(tag => (
                   <button key={tag} onClick={() => toggleFilterTag(tag)} className={`text-[10px] px-2 py-0.5 rounded-full border ${selectedFilterTags.has(tag) ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>{tag}</button>
                 ))}
              </div>
           </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {isSemanticSearch && !semanticSearchPerformed && searchQuery ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <BrainCircuit size={32} className="mb-2 text-purple-300 animate-pulse"/>
                <p className="text-xs">{t('Press Enter to search with AI')}</p>
             </div>
        ) : displayedBookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
             <p className="text-sm">{searchQuery ? t('No results found') : t('No bookmarks found')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {displayedBookmarks.map(bm => (
              <div key={bm.id} className={`group relative border rounded-md p-2 hover:shadow-sm ${selectedIds.has(bm.id) ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`} onClick={(e) => { if (e.metaKey || e.ctrlKey) toggleSelection(bm.id, true); }}>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                   <button onClick={(e) => { e.stopPropagation(); toggleSelection(bm.id, true); }} className="text-gray-400 hover:text-primary">{selectedIds.has(bm.id) ? <CheckSquare size={16} className="text-primary"/> : <Square size={16}/>}</button>
                </div>
                <div className="flex items-start mb-1">
                  <div className="mr-2 mt-0.5 flex-shrink-0">
                    {bm.type === 'folder' ? <Folder size={16} className="text-yellow-500" /> : <img src={`https://www.google.com/s2/favicons?domain=${bm.url}&sz=32`} alt="" className="w-4 h-4" onError={(e) => (e.currentTarget.style.display='none')} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate pr-6" title={bm.title}>{bm.title}</h3>
                    {bm.url && <a href={bm.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline truncate block" onClick={(e) => e.stopPropagation()}>{bm.url}</a>}
                  </div>
                </div>
                {bm.summary && <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 mb-1 bg-gray-50 dark:bg-gray-900/50 p-1 rounded">{bm.summary}</p>}
                <div className="flex flex-wrap gap-1">
                   {bm.tags?.slice(0, 3).map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full">{t}</span>)}
                </div>
                <div className="flex justify-end mt-1 pt-1 border-t border-gray-100 dark:border-gray-700 opacity-0 group-hover:opacity-100">
                   <button onClick={(e) => {e.stopPropagation(); onEdit(bm)}} className="text-gray-400 hover:text-blue-500"><Edit2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};