
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
      await db.collections.delete(collection.id!); // Assumes db.collections.delete handles cascading or checks
      toast({ title: "Collection Deleted", description: `"${collection.name}" has been deleted.` });
      onUpdate();
    } catch (error) {
       toast({ variant: "destructive", title: "Error Deleting Collection", description: (error as Error).message });
    }
  };

  return (
    <AliasedSidebarMenuItem>
      <div className="flex items-center group">
        <SidebarMenuButton
          onClick={() => onSelect(collection.id!)}
          isActive={selectedCollectionId === collection.id}
          className="flex-grow"
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        >
          {collection.children && collection.children.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="mr-1 p-0.5 rounded hover:bg-sidebar-accent">
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          {!collection.children || collection.children.length === 0 && <Folder size={16} className="mr-2 flex-shrink-0" />}
          <span className="truncate flex-1">{collection.name}</span>
          <span className="text-xs text-muted-foreground ml-auto mr-2">{count}</span>
        </SidebarMenuButton>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-1 flex items-center">
           <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); onOpenCreateSubCollectionDialog(collection.id!)}}>
            <FolderPlus size={14} />
           </Button>
           <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"><Edit2 size={14} /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Rename Collection</DialogTitle></DialogHeader>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRenaming(false)}>Cancel</Button>
                <Button onClick={handleRename}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"><Trash2 size={14} /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><DialogTitle>Delete Collection?</DialogTitle></AlertDialogHeader>
              <AlertDialogDescription>Are you sure you want to delete "{collection.name}"? This cannot be undone.</AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {isOpen && collection.children && collection.children.length > 0 && (
        // Removed SidebarMenuSub from here as per original styling. Nesting is handled by padding.
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
    </AliasedSidebarMenuItem>
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
    async () => getCollections(), // Fetches a flat list of all collections
    [refreshKey], [] as Collection[]
  );

  const imageCountsResult = useLiveQuery(
    async () => {
      const countsMap = new Map<number, number>();
      if(flatCollectionsForSelect) {
        for(const coll of flatCollectionsForSelect) {
          if(coll.id) {
             const count = await db.images.where('collectionIds').equals(coll.id).count();
             countsMap.set(coll.id, count);
          }
        }
      }
      return countsMap;
    }, [flatCollectionsForSelect, refreshKey], new Map<number,number>()
  );

  const openCreateCollectionDialog = (parentId: number | null) => {
    setDialogParentId(parentId);
    setNewCollectionName(''); // Reset name for new entry
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
  
  if (!hierarchicalCollections || !imageCountsResult || !flatCollectionsForSelect) {
    return <div className="p-4"><Loader2 className="animate-spin" /> Loading collections...</div>;
  }

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
                    {flatCollectionsForSelect.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id!.toString()}>
                        {collection.name}
                      </SelectItem>
                    ))}
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
            level={0}
            onSelect={handleSelectCollection}
            onUpdate={() => setRefreshKey(prev => prev + 1)}
            imageCounts={imageCountsResult}
            selectedCollectionId={selectedCollectionId}
            onOpenCreateSubCollectionDialog={openCreateCollectionDialog}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
