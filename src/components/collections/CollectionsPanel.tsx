
"use client";

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getHierarchicalCollections, getImagesPerCollection, addCollection as dbAddCollection } from '@/lib/db';
import type { Collection } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Folder, ChevronDown, ChevronRight, Edit2, Trash2, Loader2 } from 'lucide-react';
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
import { SidebarMenu, SidebarMenuItem as AliasedSidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarMenuSub, SidebarMenuSubButton } from '@/components/ui/sidebar';


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
}

function CollectionItemView({ collection, level, onSelect, onUpdate, imageCounts, selectedCollectionId }: CollectionItemProps) {
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
          {!collection.children || collection.children.length === 0 && <Folder size={16} className="mr-2" />}
          <span className="truncate flex-1">{collection.name}</span>
          <span className="text-xs text-muted-foreground ml-auto mr-2">{count}</span>
        </SidebarMenuButton>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 flex">
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
        <SidebarMenuSub>
          {collection.children.map(child => (
            <CollectionItemView
              key={child.id}
              collection={child}
              level={level + 1}
              onSelect={onSelect}
              onUpdate={onUpdate}
              imageCounts={imageCounts}
              selectedCollectionId={selectedCollectionId}
            />
          ))}
        </SidebarMenuSub>
      )}
    </AliasedSidebarMenuItem>
  );
}


export default function CollectionsPanel({ onCollectionSelect }: CollectionsPanelProps) {
  const { toast } = useToast();
  const [newCollectionName, setNewCollectionName] = useState('');
  const [parentCollectionId, setParentCollectionId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger re-fetch
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);

  const collections = useLiveQuery(
    async () => {
      return getHierarchicalCollections();
    }, [refreshKey], [] as Collection[]
  );

  const imageCountsResult = useLiveQuery(
    async () => {
      const allCollectionsFlat = collections?.reduce((acc, curr) => {
        acc.push(curr);
        if (curr.children) {
          // Simple recursive helper for flattening, adjust depth as needed
          const flattenChildren = (items: Collection[]): Collection[] => {
            return items.reduce((cAcc, cItem) => {
              cAcc.push(cItem);
              if (cItem.children) {
                cAcc.push(...flattenChildren(cItem.children));
              }
              return cAcc;
            }, [] as Collection[]);
          };
          acc.push(...flattenChildren(curr.children));
        }
        return acc;
      }, [] as Collection[]);

      const countsMap = new Map<number, number>();
      if(allCollectionsFlat) {
        for(const coll of allCollectionsFlat) {
          if(coll.id) {
             const count = await db.images.where('collectionIds').equals(coll.id).count();
             countsMap.set(coll.id, count);
          }
        }
      }
      return countsMap;

    }, [collections, refreshKey], new Map<number,number>()
  );


  const handleAddCollection = async () => {
    if (newCollectionName.trim() === '') return;
    try {
      await dbAddCollection({ name: newCollectionName, parentId: parentCollectionId });
      toast({ title: "Collection Created", description: `"${newCollectionName}" has been added.` });
      setNewCollectionName('');
      setParentCollectionId(null);
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
  
  if (!collections || !imageCountsResult) {
    return <div className="p-4"><Loader2 className="animate-spin" /> Loading collections...</div>;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex justify-between items-center">
        <span>Collections</span>
         <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setParentCollectionId(null)}>
              <Plus size={16} />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
              <DialogDescription>Enter a name for your new collection.</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Collection name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
            />
            {/* TODO: Add dropdown to select parent collection */}
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
        {collections.map((collection) => (
          <CollectionItemView
            key={collection.id}
            collection={collection}
            level={0}
            onSelect={handleSelectCollection}
            onUpdate={() => setRefreshKey(prev => prev + 1)}
            imageCounts={imageCountsResult}
            selectedCollectionId={selectedCollectionId}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

    