
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getHierarchicalCollections, addCollection as dbAddCollection, getCollections } from '@/lib/db';
import type { Collection } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Folder, ChevronDown, ChevronRight, Edit2, Trash2, Loader2, FolderPlus } from 'lucide-react';
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
}

function CollectionItemView({ collection, level, onSelect, onUpdate, imageCounts, selectedCollectionId, onOpenCreateSubCollectionDialog }: CollectionItemProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(collection.name);

  const count = imageCounts.get(collection.id!) || 0;

  const handleRename = async () => {
    if (newName.trim() === "" || newName === collection.name) {
      setIsRenaming(false);
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
      // If the deleted collection was selected, select "All Images"
      if (selectedCollectionId === collection.id) {
        onSelect(null);
      }
    } catch (error) {
       toast({ variant: "destructive", title: "Error Deleting Collection", description: (error as Error).message });
    }
  };

  const displayName = (level > 0 ? '-'.repeat(level) + ' ' : '') + collection.name;

  return (
    <>
      <AliasedSidebarMenuItem>
        <div
          className="flex items-center group w-full"
          // Removed style={{ paddingLeft: `${level * 1.25}rem` }} for flat hierarchy
        >
          {/* Expand/Collapse Button */}
          {collection.children && collection.children.length > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 p-1 mr-1 flex-shrink-0 rounded hover:bg-sidebar-accent"
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              aria-label={isOpen ? `Collapse ${collection.name}` : `Expand ${collection.name}`}
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          ) : (
            <span className="w-7 h-7 mr-1 flex-shrink-0"></span> // Spacer for alignment
          )}

          {/* Main Collection Item (Name, Icon, Count) - Clickable */}
          <SidebarMenuButton
            onClick={() => onSelect(collection.id!)}
            isActive={selectedCollectionId === collection.id}
            className="flex-grow h-auto py-1 px-1.5 text-left" // Adjusted padding
          >
            <Folder size={16} className="mr-1.5 flex-shrink-0" />
            <span className="truncate flex-1" title={collection.name}>{displayName}</span>
            <span className="text-xs text-sidebar-foreground/70 ml-2 pl-1 flex-shrink-0">{count}</span>
          </SidebarMenuButton>

          {/* Action Buttons (Add Sub, Rename, Delete) - Appear on hover */}
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
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New collection name" />
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
                <AlertDialogHeader><DialogTitle>Delete Collection?</DialogTitle></AlertDialogHeader>
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
      {isOpen && collection.children && collection.children.length > 0 && (
        <>
          {collection.children.map(child => (
            <CollectionItemView
              key={child.id}
              collection={child}
              level={level + 1}
              onSelect={onSelect}
              onUpdate={onUpdate}
              imageCounts={imageCounts}
              selectedCollectionId={selectedCollectionId}
              onOpenCreateSubCollectionDialog={onOpenCreateSubCollectionDialog}
            />
          ))}
        </>
      )}
    </>
  );
}


export default function CollectionsPanel({ onCollectionSelect }: CollectionsPanelProps) {
  const { toast } = useToast();
  const [newCollectionName, setNewCollectionName] = useState('');
  const [dialogParentId, setDialogParentId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);

  const hierarchicalCollections = useLiveQuery(
    async () => getHierarchicalCollections(),
    [refreshKey], [] as Collection[]
  );

  const flatCollectionsForSelect = useLiveQuery(
    async () => {
        const allCollections = await getCollections();
        // Function to generate a prefixed name for the select dropdown
        const generatePrefixedName = (collection: Collection, collections: Collection[], currentLevel: number = 0): string => {
            const prefix = currentLevel > 0 ? '-'.repeat(currentLevel) + ' ' : '';
            let parentName = '';
            if (collection.parentId) {
                const parent = collections.find(c => c.id === collection.parentId);
                if (parent) {
                    // This recursive call isn't quite right for flat list prefix.
                    // We need a simpler way to get depth for a flat list for the select.
                    // For now, let's use a simpler depth calculation or just rely on user knowing.
                    // The hierarchical display in the main list is the primary visual cue.
                }
            }
            return prefix + collection.name;
        };

        // We need a way to calculate depth for each item in the flat list for the dropdown prefix
        // This is more complex than it seems if we want perfect prefixes in the flat dropdown.
        // For simplicity in the dropdown, we might omit deep prefixes or just show names.
        // The main list handles visual hierarchy.
        // Let's just return the flat list for now, as the prefix in select can be tricky.
        return allCollections.sort((a,b) => a.name.localeCompare(b.name));
    },
    [refreshKey], [] as Collection[]
);


  const imageCountsResult = useLiveQuery(
    async () => {
        const countsMap = new Map<number, number>();
        const allCollections = await getCollections(); // Fetch all collections flatly
        const allImages = await db.images.toArray(); // Fetch all images once

        // Helper function to count images directly in a collection
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
    try {
      await dbAddCollection({ name: newCollectionName, parentId: dialogParentId });
      toast({ title: "Collection Created", description: `"${newCollectionName}" has been added.` });
      setNewCollectionName('');
      setDialogParentId(null);
      setIsCreateDialogOpen(false);
      setRefreshKey(prev => prev + 1);
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
  }, []);
  
  if (!hierarchicalCollections || !imageCountsResult || !flatCollectionsForSelect) {
    return <div className="p-4"><Loader2 className="animate-spin" /> Loading collections...</div>;
  }

  // Helper to get prefix for select options - simple depth calculation from hierarchical structure
  const getSelectPrefix = (collectionId: number | undefined, collections: Collection[], currentLevel = 0): string => {
    if (!collectionId) return '';
    
    const findPath = (targetId: number, currentCollections: Collection[], level: number): string | null => {
        for (const coll of currentCollections) {
            if (coll.id === targetId) {
                return level > 0 ? '-'.repeat(level) + ' ' : '';
            }
            if (coll.children) {
                const childPath = findPath(targetId, coll.children, level + 1);
                if (childPath !== null) return childPath;
            }
        }
        return null;
    };
    return findPath(collectionId, hierarchicalCollections, 0) || '';
  };


  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex justify-between items-center">
        <span>Collections</span>
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="collection-name" className="text-right">Name</Label>
                <Input
                  id="collection-name"
                  placeholder="Collection name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="col-span-3"
                />
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
                    {/* For select, it's better to display a flat list with prefixes representing hierarchy */}
                    {(function renderSelectOptions(collections: Collection[], level = 0) {
                        let options: JSX.Element[] = [];
                        collections.forEach(collection => {
                            options.push(
                                <SelectItem 
                                    key={collection.id} 
                                    value={collection.id!.toString()} 
                                    disabled={collection.id === dialogParentId /* Or logic to prevent cyclic dependencies */}
                                >
                                    {level > 0 ? '-'.repeat(level) + ' ' : ''}{collection.name}
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
      </SidebarGroupLabel>
      <SidebarMenu>
        <AliasedSidebarMenuItem>
          <SidebarMenuButton onClick={() => handleSelectCollection(null)} isActive={selectedCollectionId === null}>
            All Images
          </SidebarMenuButton>
        </AliasedSidebarMenuItem>
        {hierarchicalCollections.map((collection) => (
          <CollectionItemView
            key={collection.id}
            collection={collection}
            level={0} // Root items are level 0 for prefixing
            onSelect={handleSelectCollection}
            onUpdate={doRefresh}
            imageCounts={imageCountsResult}
            selectedCollectionId={selectedCollectionId}
            onOpenCreateSubCollectionDialog={openCreateCollectionDialog}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
