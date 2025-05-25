
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getHierarchicalCollections, addCollection as dbAddCollection, getCollections } from '@/lib/db';
import type { Collection } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Folder, ChevronDown, ChevronRight, Edit2, Trash2, Loader2, FolderPlus, ListCollapse, AlertTriangle, Unlink } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarMenu, SidebarMenuItem as AliasedSidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarMenuSub } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


interface CollectionsPanelProps {
  onCollectionSelect: (collectionId: number | null) => void;
  onToggleReviewDuplicates: () => void;
  isReviewDuplicatesMode: boolean;
  onToggleShowUnassigned: () => void;
  isShowUnassignedMode: boolean;
}

interface CollectionItemProps {
  collection: Collection;
  level: number;
  onSelect: (collectionId: number | null) => void;
  onUpdate: () => void;
  imageCounts: Map<number, number>;
  selectedCollectionId: number | null;
  onOpenCreateSubCollectionDialog: (parentId: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  isReviewDuplicatesMode: boolean;
  onToggleReviewDuplicates: () => void;
  isShowUnassignedMode: boolean;
  onToggleShowUnassigned: () => void;
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
  onToggleOpen,
  isReviewDuplicatesMode,
  onToggleReviewDuplicates,
  isShowUnassignedMode,
  onToggleShowUnassigned,
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
        toast({ variant: "destructive", title: "Error", description: "El nombre de la colección no puede exceder los 50 caracteres." });
        return;
    }
    try {
      await db.collections.update(collection.id!, { name: newName });
      toast({ title: "Colección Renombrada", description: `"${collection.name}" ahora es "${newName}".` });
      onUpdate();
      setIsRenaming(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo renombrar la colección." });
    }
  };

  const handleDelete = async () => {
    try {
      await db.collections.delete(collection.id!);
      toast({ title: "Colección Eliminada", description: `"${collection.name}" ha sido eliminada.` });
      onUpdate();
      if (selectedCollectionId === collection.id) {
        onSelect(null);
      }
    } catch (error) {
       toast({ variant: "destructive", title: "Error al Eliminar Colección", description: (error as Error).message });
    }
  };

  const displayName = (level > 0 ? '-'.repeat(level) + ' ' : '') + collection.name;

  const handleItemSelect = () => {
    if (isReviewDuplicatesMode) onToggleReviewDuplicates();
    if (isShowUnassignedMode) onToggleShowUnassigned();
    onSelect(collection.id!);
  };

  return (
    <React.Fragment>
      <AliasedSidebarMenuItem>
        <div className="flex flex-col"> {/* Main container for the item's content */}
          {/* Line 1: Expand/Collapse, Folder, Name, Count */}
          <div className="flex items-center w-full">
            {collection.children && collection.children.length > 0 ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-1 mr-0.5 flex-shrink-0 rounded hover:bg-sidebar-accent"
                onClick={(e) => { e.stopPropagation(); onToggleOpen(); }}
                aria-label={isOpen ? `Contraer ${collection.name}` : `Expandir ${collection.name}`}
              >
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </Button>
            ) : (
              <span className="w-7 h-7 mr-0.5 flex-shrink-0"></span>
            )}

            <SidebarMenuButton
              onClick={handleItemSelect}
              isActive={!isReviewDuplicatesMode && !isShowUnassignedMode && selectedCollectionId === collection.id}
              className="flex-grow h-auto py-1 px-1.5 text-left"
            >
              <Folder size={16} className="mr-1 flex-shrink-0" />
              <span className="truncate flex-1" title={collection.name}>{displayName}</span>
              <span className="text-xs text-sidebar-foreground/70 ml-2 pl-1 flex-shrink-0">{count}</span>
            </SidebarMenuButton>
          </div>

          {/* Line 2: Action Icons (always visible) */}
          <div className="flex items-center mt-1 pl-7">
             <Button variant="ghost" size="icon" className="h-7 w-7 p-1" onClick={(e) => {e.stopPropagation(); onOpenCreateSubCollectionDialog(collection.id!)}} title={`Añadir sub-colección a ${collection.name}`}>
              <FolderPlus size={14} />
             </Button>
             <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 p-1" onClick={(e) => e.stopPropagation()} title={`Renombrar ${collection.name}`}><Edit2 size={14} /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Renombrar Colección</DialogTitle></DialogHeader>
                <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nuevo nombre de colección"
                    maxLength={50}
                />
                <p className="text-xs text-muted-foreground mt-1">Máx. 50 caracteres.</p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRenaming(false)}>Cancelar</Button>
                  <Button onClick={handleRename}>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()} title={`Eliminar ${collection.name}`}><Trash2 size={14} /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>¿Eliminar Colección?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogDescription>¿Estás seguro de que quieres eliminar "{collection.name}"? Esta acción no se puede deshacer. Si esta colección contiene imágenes, no se eliminarán, pero ya no estarán en esta colección. Las sub-colecciones se convertirán en colecciones raíz.</AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </AliasedSidebarMenuItem>
      {collection.children && collection.children.length > 0 && openCollectionIds.has(collection.id!) &&
        renderCollectionItems(collection.children, level + 1)
      }
    </React.Fragment>
  );
}


export default function CollectionsPanel({
  onCollectionSelect,
  onToggleReviewDuplicates,
  isReviewDuplicatesMode,
  onToggleShowUnassigned,
  isShowUnassignedMode,
}: CollectionsPanelProps) {
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
                if (!image.isPotentialDuplicate && image.collectionIds && image.collectionIds.includes(collectionId)) {
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
        toast({ variant: "destructive", title: "Error", description: "El nombre de la colección no puede estar vacío." });
        return;
    }
    if (newCollectionName.length > 50) {
        toast({ variant: "destructive", title: "Error", description: "El nombre de la colección no puede exceder los 50 caracteres." });
        return;
    }
    try {
      const newCollectionId = await dbAddCollection({ name: newCollectionName, parentId: dialogParentId });
      toast({ title: "Colección Creada", description: `"${newCollectionName}" ha sido añadida.` });
      setNewCollectionName('');
      setDialogParentId(null);
      setIsCreateDialogOpen(false);
      setRefreshKey(prev => prev + 1);
      if (dialogParentId !== null && !openCollectionIds.has(dialogParentId)) {
        handleToggleOpen(dialogParentId);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear la colección." });
    }
  };

  const handleSelectCollectionInternal = (collectionId: number | null) => {
    setSelectedCollectionId(collectionId);
    onCollectionSelect(collectionId);
  }

  const handleSelectAllImages = () => {
    if (isReviewDuplicatesMode) onToggleReviewDuplicates();
    if (isShowUnassignedMode) onToggleShowUnassigned();
    handleSelectCollectionInternal(null);
  };

  const handleSelectReviewDuplicates = () => {
    if (!isReviewDuplicatesMode) onToggleReviewDuplicates();
  };

  const handleSelectShowUnassigned = () => {
    if (!isShowUnassignedMode) onToggleShowUnassigned();
  };

  const doRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
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
          onSelect={handleSelectCollectionInternal}
          onUpdate={doRefresh}
          imageCounts={imageCountsResult}
          selectedCollectionId={selectedCollectionId}
          onOpenCreateSubCollectionDialog={openCreateCollectionDialog}
          isOpen={openCollectionIds.has(collection.id!)}
          onToggleOpen={() => handleToggleOpen(collection.id!)}
          isReviewDuplicatesMode={isReviewDuplicatesMode}
          onToggleReviewDuplicates={onToggleReviewDuplicates}
          isShowUnassignedMode={isShowUnassignedMode}
          onToggleShowUnassigned={onToggleShowUnassigned}
        />
        {collection.children && collection.children.length > 0 && openCollectionIds.has(collection.id!) &&
          renderCollectionItems(collection.children, level + 1)
        }
      </React.Fragment>
    ));
  };


  if (!hierarchicalCollections || !imageCountsResult || !flatCollectionsForSelect) {
    return <div className="p-4"><Loader2 className="animate-spin" /> Cargando colecciones...</div>;
  }

  return (
    <SidebarGroup className="px-1 py-2">
      <SidebarGroupLabel className="flex justify-between items-center">
        <span>Colecciones</span>
        <div className="flex items-center">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCollapseAll}>
                        <ListCollapse size={16} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Contraer Todo</p></TooltipContent>
            </Tooltip>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreateCollectionDialog(null)}>
                <Plus size={16} />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Crear Nueva Colección</DialogTitle>
                <DialogDescription>Ingresa un nombre y opcionalmente selecciona una colección padre para tu nueva colección.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="collection-name" className="text-right pt-2">Nombre</Label>
                    <div className="col-span-3">
                        <Input
                        id="collection-name"
                        placeholder="Nombre de la colección"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        maxLength={50}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Máx. 50 caracteres.</p>
                    </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="parent-collection" className="text-right">Padre</Label>
                    <Select
                    value={dialogParentId?.toString() ?? "none"}
                    onValueChange={(value) => setDialogParentId(value === "none" ? null : Number(value))}
                    >
                    <SelectTrigger id="parent-collection" className="col-span-3">
                        <SelectValue placeholder="Seleccionar padre (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">(Sin Padre - Colección Raíz)</SelectItem>
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
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleAddCollection}>Crear</Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        </div>
      </SidebarGroupLabel>
      <SidebarMenu>
        <AliasedSidebarMenuItem>
          <SidebarMenuButton
            onClick={handleSelectReviewDuplicates}
            isActive={isReviewDuplicatesMode}
            className={cn(isReviewDuplicatesMode && "bg-destructive/20 text-destructive-foreground hover:bg-destructive/30")}
          >
            <AlertTriangle size={16} className="mr-1 flex-shrink-0" />
            Revisar Duplicados
          </SidebarMenuButton>
        </AliasedSidebarMenuItem>

        <AliasedSidebarMenuItem>
          <SidebarMenuButton
            onClick={handleSelectShowUnassigned}
            isActive={isShowUnassignedMode}
          >
            <Unlink size={16} className="mr-1 flex-shrink-0" />
            No asignadas
          </SidebarMenuButton>
        </AliasedSidebarMenuItem>

        <AliasedSidebarMenuItem>
          <SidebarMenuButton
            onClick={handleSelectAllImages}
            isActive={!isReviewDuplicatesMode && !isShowUnassignedMode && selectedCollectionId === null}
          >
            Todas las Imágenes
          </SidebarMenuButton>
        </AliasedSidebarMenuItem>
        {renderCollectionItems(hierarchicalCollections, 0)}
      </SidebarMenu>
    </SidebarGroup>
  );
}
