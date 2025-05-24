
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getHierarchicalCollections, addCollection as dbAddCollection, getCollections } from '@/lib/db';
import type { Collection } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Folder, ChevronDown, ChevronRight, Edit2, Trash2, Loader2, FolderPlus, ListCollapse } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarMenu, SidebarMenuItem as AliasedSidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarMenuSub } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


interface CollectionsPanelProps {
  onCollectionSelect: (collectionId: number | null) => void;
}

interface CollectionItemProps {
  collection: Collection;
  level: number;
  onSelect: (collectionId: number | null) => void;
  onUpdate: () => void; // to refresh list
  imageCounts: Map<number, number>;
  selectedCollectionId: number | null;
  onOpenCreateSubCollectionDialog: (parentId: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

function CollectionItemView({
  collection,
  level,
  onSelect,
  onUpdate,
  imageCounts,
  selectedCollectionId,
  onOpenCreateSubCollectionDialog,
  isOpen,
  onToggleOpen
}: CollectionItemProps) {
  const { toast } = useToast();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(collection.name);

  const count = imageCounts.get(collection.id!) || 0;

  const handleRename = async () => {
    if (newName.trim() === "" || newName === collection.name) {
      setIsRenaming(false);
      return;
    }
    if (newName.length > 50) {
        toast({ variant: "destructive", title: "Error", description: "Collection name cannot exceed 50 characters." });
        return;
    }
    try {
      await db.collections.update(collection.id!, { name: newName });
      toast({ title: "Collection Renamed", description: `"${collection.name}" is now "${newName}".` });
      onUpdate();
      setIsRenaming(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to rename collection." });
    }
  };

  const handleDelete = async () => {
    try {
      await db.collections.delete(collection.id!);
      toast({ title: "Collection Deleted", description: `"${collection.name}" has been deleted.` });
      onUpdate();
      if (selectedCollectionId === collection.id) {
        onSelect(null);
      }
    } catch (error) {
       toast({ variant: "destructive", title: "Error Deleting Collection", description: (error as Error).message });
    }
  };

  const displayName = (level > 0 ? '-'.repeat(level) + ' ' : '') + collection.name;

  return (
    <React.Fragment>
      <AliasedSidebarMenuItem>
        <div className="flex items-center group w-full">
          {collection.children && collection.children.length > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 p-1 mr-0.5 flex-shrink-0 rounded hover:bg-sidebar-accent"
              onClick={(e) => { e.stopPropagation(); onToggleOpen(); }}
              aria-label={isOpen ? `Collapse ${collection.name}` : `Expand ${collection.name}`}
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          ) : (
            <span className="w-7 h-7 mr-0.5 flex-shrink-0"></span> 
          )}

          <SidebarMenuButton
            onClick={() => onSelect(collection.id!)}
            isActive={selectedCollectionId === collection.id}
            className="flex-grow h-auto py-1 px-1.5 text-left"
          >
            <Folder size={16} className="mr-1 flex-shrink-0" />
            <span className="truncate flex-1" title={collection.name}>{displayName}</span>
            <span className="text-xs text-sidebar-foreground/70 ml-2 pl-1 flex-shrink-0">{count}</span>
          </SidebarMenuButton>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center flex-shrink-0 ml-1 pr-1">
             <Button variant="ghost" size="icon" className="h-7 w-7 p-1" onClick={(e) => {e.stopPropagation(); onOpenCreateSubCollectionDialog(collection.id!)}} title={`Add sub-collection to ${collection.name}`}>
              <FolderPlus size={14} />
             </Button>
             <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 p-1" onClick={(e) => e.stopPropagation()} title={`Rename ${collection.name}`}><Edit2 size={14} /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Rename Collection</DialogTitle></DialogHeader>
                <Input 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    placeholder="New collection name"
                    maxLength={50} 
                />
                <p className="text-xs text-muted-foreground mt-1">Max 50 characters.</p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRenaming(false)}>Cancel</Button>
                  <Button onClick={handleRename}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()} title={`Delete ${collection.name}`}><Trash2 size={14} /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete Collection?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogDescription>Are you sure you want to delete "{collection.name}"? This action cannot be undone. If this collection contains images, they will not be deleted but will no longer be in this collection. Sub-collections will become root collections.</AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </AliasedSidebarMenuItem>
    </React.Fragment>
  );
}


export default function CollectionsPanel({ onCollectionSelect }: CollectionsPanelProps) {
  const { toast } = useToast();
  const [newCollectionName, setNewCollectionName] = useState('');
  const [dialogParentId, setDialogParentId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [openCollectionIds, setOpenCollectionIds] = useState<Set<number>>(new Set());
  const [initialOpenStateApplied, setInitialOpenStateApplied] = useState(false);

  const hierarchicalCollections = useLiveQuery(
    async () => getHierarchicalCollections(),
    [refreshKey], [] as Collection[]
  );

  useEffect(() => {
    if (hierarchicalCollections && !initialOpenStateApplied && hierarchicalCollections.length > 0) {
        const defaultOpen = new Set<number>();
        const collectOpenIds = (collections: Collection[]) => {
            collections.forEach(c => {
                if (c.id !== undefined && c.children && c.children.length > 0) {
                    defaultOpen.add(c.id); 
                }
                if (c.children) {
                    collectOpenIds(c.children);
                }
            });
        };
        collectOpenIds(hierarchicalCollections);
        setOpenCollectionIds(defaultOpen);
        setInitialOpenStateApplied(true); 
    } else if (hierarchicalCollections && hierarchicalCollections.length === 0 && !initialOpenStateApplied) {
        // Ensure openCollectionIds is empty if no collections and initial state not yet applied
        setOpenCollectionIds(new Set());
        setInitialOpenStateApplied(true);
    }
  }, [hierarchicalCollections, initialOpenStateApplied]);


  const flatCollectionsForSelect = useLiveQuery(
    async () => {
        const allCollections = await getCollections();
        return allCollections.sort((a,b) => a.name.localeCompare(b.name));
    },
    [refreshKey], [] as Collection[]
);


  const imageCountsResult = useLiveQuery(
    async () => {
        const countsMap = new Map<number, number>();
        const allCollections = await getCollections(); 
        const allImages = await db.images.toArray(); 

        const countImagesDirectlyInCollection = (collectionId: number): number => {
            let count = 0;
            allImages.forEach(image => {
                if (image.collectionIds && image.collectionIds.includes(collectionId)) {
                    count++;
                }
            });
            return count;
        };

        for (const coll of allCollections) {
            if (coll.id) {
                countsMap.set(coll.id, countImagesDirectlyInCollection(coll.id));
            }
        }
        return countsMap;
    },
    [refreshKey], 
    new Map<number, number>()
  );

  const openCreateCollectionDialog = (parentId: number | null) => {
    setDialogParentId(parentId);
    setNewCollectionName(''); 
    setIsCreateDialogOpen(true);
  };

  const handleAddCollection = async () => {
    if (newCollectionName.trim() === '') {
        toast({ variant: "destructive", title: "Error", description: "Collection name cannot be empty." });
        return;
    }
    if (newCollectionName.length > 50) {
        toast({ variant: "destructive", title: "Error", description: "Collection name cannot exceed 50 characters." });
        return;
    }
    try {
      const newCollectionId = await dbAddCollection({ name: newCollectionName, parentId: dialogParentId });
      toast({ title: "Collection Created", description: `"${newCollectionName}" has been added.` });
      setNewCollectionName('');
      setDialogParentId(null);
      setIsCreateDialogOpen(false);
      setRefreshKey(prev => prev + 1);
      // If a new collection with children potential is added, it should be open by default
      // For simplicity, we'll let the main useEffect handle new collections based on structure
      // Or, explicitly open its parent if it has one
      if (dialogParentId !== null && !openCollectionIds.has(dialogParentId)) {
        handleToggleOpen(dialogParentId); // Open parent to show new child
      }
      // New collections don't have children yet, so no need to add them to openCollectionIds
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to create collection." });
    }
  };

  const handleSelectCollection = (collectionId: number | null) => {
    setSelectedCollectionId(collectionId);
    onCollectionSelect(collectionId);
  }
  
  const doRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    // Potentially reset initialOpenStateApplied to false if collections might drastically change
    // For now, keep it true to preserve user toggles across simple refreshes.
  }, []);

  const handleToggleOpen = (collectionId: number) => {
    setOpenCollectionIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(collectionId)) {
            newSet.delete(collectionId);
        } else {
            newSet.add(collectionId);
        }
        return newSet;
    });
  };

  const handleCollapseAll = () => {
    setOpenCollectionIds(new Set());
  };
  
  const renderCollectionItems = (collectionsToRender: Collection[], level: number): JSX.Element[] => {
    return collectionsToRender.map(collection => (
      <React.Fragment key={collection.id}>
        <CollectionItemView
          collection={collection}
          level={level}
          onSelect={handleSelectCollection}
          onUpdate={doRefresh}
          imageCounts={imageCountsResult}
          selectedCollectionId={selectedCollectionId}
          onOpenCreateSubCollectionDialog={openCreateCollectionDialog}
          isOpen={openCollectionIds.has(collection.id!)}
          onToggleOpen={() => handleToggleOpen(collection.id!)}
        />
        {collection.children && collection.children.length > 0 && openCollectionIds.has(collection.id!) &&
          renderCollectionItems(collection.children, level + 1)
        }
      </React.Fragment>
    ));
  };


  if (!hierarchicalCollections || !imageCountsResult || !flatCollectionsForSelect) {
    return <div className="p-4"><Loader2 className="animate-spin" /> Loading collections...</div>;
  }

  return (
    <SidebarGroup className="px-1 py-2">
      <SidebarGroupLabel className="flex justify-between items-center">
        <span>Collections</span>
        <div className="flex items-center">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCollapseAll}>
                        <ListCollapse size={16} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Collapse All</p></TooltipContent>
            </Tooltip>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreateCollectionDialog(null)}>
                <Plus size={16} />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Collection</DialogTitle>
                <DialogDescription>Enter a name and optionally select a parent for your new collection.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="collection-name" className="text-right pt-2">Name</Label>
                    <div className="col-span-3">
                        <Input
                        id="collection-name"
                        placeholder="Collection name"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        maxLength={50}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Max 50 characters.</p>
                    </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="parent-collection" className="text-right">Parent</Label>
                    <Select
                    value={dialogParentId?.toString() ?? "none"}
                    onValueChange={(value) => setDialogParentId(value === "none" ? null : Number(value))}
                    >
                    <SelectTrigger id="parent-collection" className="col-span-3">
                        <SelectValue placeholder="Select parent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">(No Parent - Root Collection)</SelectItem>
                        {(function renderSelectOptions(collections: Collection[], level = 0) {
                            let options: JSX.Element[] = [];
                            collections.forEach(collection => {
                                const prefix = level > 0 ? '-'.repeat(level) + ' ' : '';
                                options.push(
                                    <SelectItem 
                                        key={collection.id} 
                                        value={collection.id!.toString()} 
                                    >
                                        {prefix}{collection.name}
                                    </SelectItem>
                                );
                                if (collection.children && collection.children.length > 0) {
                                    options = options.concat(renderSelectOptions(collection.children, level + 1));
                                }
                            });
                            return options;
                        })(hierarchicalCollections)}
                    </SelectContent>
                    </Select>
                </div>
                </div>
                <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAddCollection}>Create</Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        </div>
      </SidebarGroupLabel>
      <SidebarMenu>
        <AliasedSidebarMenuItem>
          <SidebarMenuButton onClick={() => handleSelectCollection(null)} isActive={selectedCollectionId === null}>
            All Images
          </SidebarMenuButton>
        </AliasedSidebarMenuItem>
        {renderCollectionItems(hierarchicalCollections, 0)}
      </SidebarMenu>
    </SidebarGroup>
  );
}

    

      