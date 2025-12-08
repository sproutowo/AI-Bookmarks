import React, { useState } from 'react';
import { useStore } from '../context/Store';
import { ViewMode, BookmarkNode } from '../types';
import { Folder, FolderOpen, Tag, Settings, Clock, LayoutGrid, ChevronRight, ChevronDown, Plus, Home } from 'lucide-react';

interface SidebarProps {
  currentView: ViewMode;
  setView: (v: ViewMode) => void;
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  onMobileClose?: () => void; // New prop for closing sidebar on mobile
}

const TreeNode: React.FC<{ 
  node: BookmarkNode; 
  level: number;
  selectedFolderId: string | null;
  onSelect: (id: string) => void;
}> = ({ node, level, selectedFolderId, onSelect }) => {
  const [expanded, setExpanded] = useState(false);

  if (node.type !== 'folder') return null;

  const isSelected = selectedFolderId === node.id;
  const hasChildren = node.children && node.children.some(c => c.type === 'folder');

  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-2 px-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700 dark:text-gray-300'}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <div 
          className="p-1 mr-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : <span className="w-[14px] h-[14px] block" />}
        </div>
        {expanded ? <FolderOpen size={16} className="mr-2 text-yellow-500" /> : <Folder size={16} className="mr-2 text-yellow-500" />}
        <span className="truncate text-sm">{node.title}</span>
      </div>
      {expanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              level={level + 1} 
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, setView, selectedFolderId, setSelectedFolderId, selectedTag, setSelectedTag, onMobileClose 
}) => {
  const { bookmarks, flatBookmarks, t } = useStore();
  const [expandMyFolders, setExpandMyFolders] = useState(true);
  const [expandTags, setExpandTags] = useState(false);

  // Extract unique tags
  const tags = Array.from(new Set(flatBookmarks.flatMap(b => b.tags || []))).sort();

  const handleNavigation = (action: () => void) => {
    action();
    if (onMobileClose) onMobileClose();
  };

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between h-16">
        <h1 className="font-bold text-lg text-gray-800 dark:text-white flex items-center">
          <LayoutGrid className="mr-2 text-primary" size={20} />
          AI Bookmarks
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {/* Navigation Section */}
        <div className="mb-4 px-2 space-y-1">
          <div 
            onClick={() => handleNavigation(() => {
              setView(ViewMode.All);
              setSelectedFolderId(null);
              setSelectedTag(null);
            })}
            className={`flex items-center px-3 py-2 rounded-lg cursor-pointer ${currentView === ViewMode.All ? 'bg-white dark:bg-gray-800 shadow-sm text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
          >
            <Home size={18} className="mr-3" />
            <span className="text-sm font-medium">{t('Home')}</span>
          </div>

          <div 
            onClick={() => handleNavigation(() => setView(ViewMode.Recent))}
            className={`flex items-center px-3 py-2 rounded-lg cursor-pointer ${currentView === ViewMode.Recent ? 'bg-white dark:bg-gray-800 shadow-sm text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
          >
            <Clock size={18} className="mr-3" />
            <span className="text-sm font-medium">{t('Recent')}</span>
          </div>
        </div>

        {/* My Folders */}
        <div className="mb-4 px-2">
          <div 
            className="flex items-center px-3 py-1 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
            onClick={() => setExpandMyFolders(!expandMyFolders)}
          >
            <span>{t('My Folders')}</span>
            {expandMyFolders ? <ChevronDown size={12} className="ml-auto" /> : <ChevronRight size={12} className="ml-auto" />}
          </div>
          
          {expandMyFolders && (
            <div className="mt-1">
               {/* Root level children */}
               {bookmarks.children?.map(child => (
                 <TreeNode 
                   key={child.id} 
                   node={child} 
                   level={0} 
                   selectedFolderId={selectedFolderId}
                   onSelect={(id) => handleNavigation(() => {
                     setView(ViewMode.MyFolders);
                     setSelectedFolderId(id);
                     setSelectedTag(null);
                   })}
                 />
               ))}
               <button 
                  className="flex items-center px-8 py-2 text-xs text-gray-500 hover:text-primary mt-1 w-full text-left"
                  onClick={() => alert("Not implemented: Add folder from Sidebar. Please use Add button.")}
               >
                 <Plus size={12} className="mr-2" /> {t('Add Folder')}
               </button>
            </div>
          )}
        </div>

        {/* AI Smart Tags */}
        <div className="mb-4 px-2">
           <div 
            className="flex items-center px-3 py-1 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
            onClick={() => setExpandTags(!expandTags)}
          >
            <span>{t('Smart Tags')}</span>
            {expandTags ? <ChevronDown size={12} className="ml-auto" /> : <ChevronRight size={12} className="ml-auto" />}
          </div>
          {expandTags && (
             <div className="mt-1 space-y-0.5">
                {tags.map(tag => (
                  <div 
                    key={tag}
                    onClick={() => handleNavigation(() => {
                      setView(ViewMode.SmartTags);
                      setSelectedTag(tag);
                      setSelectedFolderId(null);
                    })}
                    className={`flex items-center px-3 py-1.5 rounded-md cursor-pointer ml-4 ${selectedTag === tag ? 'bg-secondary/10 text-secondary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                  >
                    <Tag size={14} className="mr-2" />
                    <span className="text-sm truncate">{tag}</span>
                  </div>
                ))}
             </div>
          )}
        </div>
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        <div 
          onClick={() => handleNavigation(() => setView(ViewMode.Settings))}
          className={`flex items-center px-3 py-2 rounded-lg cursor-pointer ${currentView === ViewMode.Settings ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
        >
          <Settings size={18} className="mr-3" />
          <span className="text-sm font-medium">{t('Settings')}</span>
        </div>
      </div>
    </div>
  );
};