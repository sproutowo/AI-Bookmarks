import { BookmarkNode } from '../types';

const STORAGE_KEY_BOOKMARKS = 'ai_bookmarks_tree';

// Initial Mock Data
const INITIAL_TREE: BookmarkNode = {
  id: 'root',
  title: 'Root',
  dateAdded: Date.now(),
  type: 'folder',
  children: [
    {
      id: '1',
      parentId: 'root',
      title: 'Bookmarks Bar',
      dateAdded: Date.now(),
      type: 'folder',
      children: [
        {
          id: '101',
          parentId: '1',
          title: 'Google',
          url: 'https://www.google.com',
          dateAdded: Date.now(),
          type: 'bookmark',
          tags: ['Search', 'Tool'],
          summary: 'The world\'s most popular search engine.'
        },
        {
          id: '102',
          parentId: '1',
          title: 'GitHub',
          url: 'https://github.com',
          dateAdded: Date.now(),
          type: 'bookmark',
          tags: ['Dev', 'Code', 'Git'],
          summary: 'Where the world builds software.'
        }
      ]
    },
    {
      id: '2',
      parentId: 'root',
      title: 'Other Bookmarks',
      dateAdded: Date.now(),
      type: 'folder',
      children: []
    }
  ]
};

export const loadBookmarks = (): BookmarkNode => {
  const stored = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
  if (stored) {
    return JSON.parse(stored);
  }
  return INITIAL_TREE;
};

export const saveBookmarks = (root: BookmarkNode) => {
  localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(root));
};

// Helper to find a node by ID recursively
export const findNodeById = (node: BookmarkNode, id: string): BookmarkNode | null => {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
};

// Flatten tree for searching/tag aggregation
export const flattenTree = (node: BookmarkNode): BookmarkNode[] => {
  let list: BookmarkNode[] = [];
  if (node.type === 'bookmark') {
    list.push(node);
  }
  if (node.children) {
    node.children.forEach(child => {
      list = list.concat(flattenTree(child));
    });
  }
  return list;
};

export const deleteNodeRecursive = (root: BookmarkNode, idToDelete: string): BookmarkNode => {
  if (root.children) {
    const idx = root.children.findIndex(c => c.id === idToDelete);
    if (idx !== -1) {
      root.children.splice(idx, 1);
      return root;
    }
    root.children.forEach(child => deleteNodeRecursive(child, idToDelete));
  }
  return root;
};

// Filter a tree to only include specific IDs (and their parents)
export const filterTreeByIds = (root: BookmarkNode, idsToKeep: Set<string>): BookmarkNode | null => {
  // Implementation: Reconstruct tree containing only desired nodes.
  
  const shouldKeep = (node: BookmarkNode): boolean => {
      if (idsToKeep.has(node.id)) return true;
      if (node.children) {
          return node.children.some(child => shouldKeep(child));
      }
      return false;
  };

  if (!shouldKeep(root) && root.id !== 'root') return null;

  const cloneNode = (node: BookmarkNode): BookmarkNode => {
      const newNode = { ...node };
      // If this node is explicitly selected, include all children
      if (idsToKeep.has(node.id)) {
          return JSON.parse(JSON.stringify(node)); 
      }
      // Otherwise, only include children that are selected or contain selected
      if (node.children) {
          newNode.children = node.children
              .filter(child => shouldKeep(child))
              .map(child => cloneNode(child));
      }
      return newNode;
  };

  return cloneNode(root);
};


// Generate standard Netscape Bookmark HTML
export const exportToHtml = (root: BookmarkNode): string => {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  const processNode = (node: BookmarkNode, level: number) => {
    const indent = '    '.repeat(level);
    if (node.type === 'folder') {
      if (node.id !== 'root') { // Don't print root header, just children
        html += `${indent}<DT><H3 ADD_DATE="${Math.floor(node.dateAdded / 1000)}">${node.title}</H3>\n`;
        html += `${indent}<DL><p>\n`;
      }
      node.children?.forEach(c => processNode(c, level + 1));
      if (node.id !== 'root') {
        html += `${indent}</DL><p>\n`;
      }
    } else {
      const tagsAttr = node.tags && node.tags.length > 0 ? ` TAGS="${node.tags.join(',')}"` : '';
      html += `${indent}<DT><A HREF="${node.url}" ADD_DATE="${Math.floor(node.dateAdded / 1000)}"${tagsAttr}>${node.title}</A>\n`;
    }
  };

  processNode(root, 0);
  html += `</DL><p>`;
  return html;
};

// Parse standard Netscape Bookmark HTML
export const parseNetscapeHtml = (html: string): BookmarkNode => {
  const root: BookmarkNode = {
    id: 'root',
    title: 'Root',
    dateAdded: Date.now(),
    type: 'folder',
    children: []
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const processList = (dl: Element, parentId: string): BookmarkNode[] => {
    const nodes: BookmarkNode[] = [];
    
    // Netscape format is loose. We look for DT elements.
    const dts = Array.from(dl.children).filter(el => el.tagName === 'DT');
    
    dts.forEach((dt) => {
        const h3 = dt.querySelector('h3');
        const a = dt.querySelector('a');
        const nextDl = dt.querySelector('dl'); 
        
        if (h3) {
            const folderId = Date.now().toString() + Math.random().toString().slice(2, 8);
            const newNode: BookmarkNode = {
                id: folderId,
                parentId,
                title: h3.textContent || 'Untitled Folder',
                dateAdded: parseInt(h3.getAttribute('add_date') || '0') * 1000 || Date.now(),
                type: 'folder',
                children: nextDl ? processList(nextDl, folderId) : []
            };
            nodes.push(newNode);
        } else if (a) {
             const newNode: BookmarkNode = {
                id: Date.now().toString() + Math.random().toString().slice(2, 8),
                parentId,
                title: a.textContent || 'Untitled',
                url: a.getAttribute('href') || '',
                dateAdded: parseInt(a.getAttribute('add_date') || '0') * 1000 || Date.now(),
                type: 'bookmark',
                tags: a.getAttribute('tags')?.split(',').filter(Boolean) || [],
                summary: ''
            };
            nodes.push(newNode);
        }
    });

    return nodes;
  };
  
  // Find the first DL (usually inside body, or first DL in doc)
  const rootDl = doc.querySelector('dl');
  if (rootDl) {
      root.children = processList(rootDl, 'root');
  }

  return root;
};

// NEW: Helper to regenerate IDs for imported nodes to avoid collisions
export const regenerateIds = (node: BookmarkNode): BookmarkNode => {
    const newNode = { ...node, id: Date.now().toString() + Math.random().toString().slice(2, 8) };
    if (newNode.children) {
        newNode.children = newNode.children.map(c => regenerateIds(c));
    }
    return newNode;
};

// NEW: Helper to merge source nodes into a target folder, handling duplicate folder names
export const mergeIntoTree = (targetParent: BookmarkNode, sourceNodes: BookmarkNode[]) => {
    if (!targetParent.children) targetParent.children = [];

    sourceNodes.forEach(sourceNode => {
        if (sourceNode.type === 'folder') {
            // Case-insensitive, whitespace-trimmed comparison to catch "Bookmarks Bar" vs "Bookmarks bar"
            const existingFolder = targetParent.children?.find(c => 
              c.type === 'folder' && 
              c.title.trim().toLowerCase() === sourceNode.title.trim().toLowerCase()
            );
            
            if (existingFolder) {
                // Merge content recursively
                if (sourceNode.children) {
                    mergeIntoTree(existingFolder, sourceNode.children);
                }
            } else {
                // Just add the folder (regenerating IDs)
                targetParent.children?.push(regenerateIds(sourceNode));
            }
        } else {
            // Bookmarks are always added. (Could check URL for duplicates if stricter de-dupe needed)
            targetParent.children?.push(regenerateIds(sourceNode));
        }
    });
};