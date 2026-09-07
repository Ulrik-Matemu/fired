import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Loader2, Layers } from 'lucide-react';
import { CollectionInfo } from '@shared/ipc-types';
import { useAppStore } from '../../store';

interface CollectionTreeNodeProps {
  connectionId: string;
  collection: CollectionInfo;
}

interface DocumentTreeNode {
  id: string;
  path: string;
}

export const CollectionTreeNode: React.FC<CollectionTreeNodeProps> = ({
  connectionId,
  collection,
}) => {
  const {
    activeConnectionId,
    activeCollectionPath,
    setActiveConnectionId,
    setActiveCollectionPath,
  } = useAppStore();

  const [expanded, setExpanded] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [documents, setDocuments] = useState<DocumentTreeNode[]>([]);

  // Subcollections per document: docPath -> string[] of subcollection IDs
  const [expandedDocPath, setExpandedDocPath] = useState<string | null>(null);
  const [loadingSubcols, setLoadingSubcols] = useState(false);
  const [subcollectionsByDoc, setSubcollectionsByDoc] = useState<Record<string, string[]>>({});

  const isColActive =
    activeConnectionId === connectionId && activeCollectionPath === collection.path;

  const handleToggleCollection = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConnectionId(connectionId);
    setActiveCollectionPath(collection.path);

    if (!expanded) {
      setExpanded(true);
      if (documents.length === 0) {
        setLoadingDocs(true);
        try {
          const res = await window.api.queryDocuments({
            connectionId,
            collectionPath: collection.path,
            limit: 25,
          });
          setDocuments(
            res.documents.map((d) => ({
              id: d.__id,
              path: d.__path,
            }))
          );
        } catch (err) {
          console.error('Failed to load documents in tree:', err);
        } finally {
          setLoadingDocs(false);
        }
      }
    } else {
      setExpanded(false);
    }
  };

  const handleToggleDoc = async (doc: DocumentTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedDocPath === doc.path) {
      setExpandedDocPath(null);
      return;
    }

    setExpandedDocPath(doc.path);
    if (!subcollectionsByDoc[doc.path]) {
      setLoadingSubcols(true);
      try {
        const subcols = await window.api.listSubcollections({
          connectionId,
          documentPath: doc.path,
        });
        setSubcollectionsByDoc((prev) => ({
          ...prev,
          [doc.path]: subcols,
        }));
      } catch (err) {
        console.error('Failed to list subcollections:', err);
      } finally {
        setLoadingSubcols(false);
      }
    }
  };

  return (
    <div className="text-xs">
      {/* Collection Header Row */}
      <div
        onClick={handleToggleCollection}
        className={`group flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
          isColActive
            ? 'bg-amber-500/20 text-amber-300 font-medium'
            : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="p-0.5 text-gray-500 hover:text-white">
            {loadingDocs ? (
              <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
            ) : expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
          <Folder
            className={`h-3.5 w-3.5 shrink-0 ${
              isColActive ? 'text-amber-400 fill-amber-400/20' : 'text-gray-500'
            }`}
          />
          <span className="truncate">{collection.id}</span>
        </div>
      </div>

      {/* Expanded Documents in Collection */}
      {expanded && (
        <div className="ml-4 pl-1.5 border-l border-[#30363d]/70 space-y-0.5 mt-0.5">
          {documents.length === 0 && !loadingDocs ? (
            <div className="px-2 py-0.5 text-[11px] text-gray-500 italic">No documents</div>
          ) : (
            documents.map((doc) => {
              const isDocExpanded = expandedDocPath === doc.path;
              const subcols = subcollectionsByDoc[doc.path] || [];

              return (
                <div key={doc.path} className="text-[11px]">
                  {/* Document Node */}
                  <div
                    onClick={(e) => handleToggleDoc(doc, e)}
                    className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-gray-400 hover:text-amber-200 hover:bg-[#21262d] cursor-pointer"
                  >
                    <span className="text-gray-500">
                      {loadingSubcols && isDocExpanded ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400" />
                      ) : isDocExpanded ? (
                        <ChevronDown className="h-2.5 w-2.5" />
                      ) : (
                        <ChevronRight className="h-2.5 w-2.5" />
                      )}
                    </span>
                    <FileText className="h-3 w-3 text-gray-500 shrink-0" />
                    <span className="truncate font-mono text-[10.5px]">{doc.id}</span>
                  </div>

                  {/* Document's Subcollections */}
                  {isDocExpanded && (
                    <div className="ml-3.5 pl-1.5 border-l border-amber-500/30 space-y-0.5 my-0.5">
                      {subcols.length === 0 && !loadingSubcols ? (
                        <div className="text-[10px] text-gray-500 italic px-1 py-0.5">
                          No subcollections
                        </div>
                      ) : (
                        subcols.map((subcolName) => {
                          const subcolFullPath = `${doc.path}/${subcolName}`;
                          const isSubcolActive =
                            activeConnectionId === connectionId &&
                            activeCollectionPath === subcolFullPath;

                          return (
                            <div
                              key={subcolFullPath}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveConnectionId(connectionId);
                                setActiveCollectionPath(subcolFullPath);
                              }}
                              className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 cursor-pointer ${
                                isSubcolActive
                                  ? 'bg-amber-500/25 text-amber-300 font-semibold'
                                  : 'text-gray-400 hover:bg-[#21262d] hover:text-white'
                              }`}
                            >
                              <Layers className="h-3 w-3 text-amber-400 shrink-0" />
                              <span className="truncate font-sans text-[11px]">{subcolName}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
