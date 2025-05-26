
"use client";

import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Loader2, FolderSearch, Search } from 'lucide-react';
import { getCollections } from '@/lib/db';
import type { Collection } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';

interface CollectionExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCollectionSelectAndClose: (collectionId: number | null) => void;
}

export default function CollectionExplorerModal({ isOpen, onClose, onCollectionSelectAndClose }: CollectionExplorerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const allCollections = useLiveQuery(
    async () => getCollections(), // getCollections already sorts by name
    [], // dependencies
    null // initial value
  );

  const filteredCollections = useMemo(() => {
    if (!allCollections) return [];
    if (!searchTerm.trim()) return allCollections;
    return allCollections.filter(collection =>
      collection.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allCollections, searchTerm]);

  const handleCollectionClick = (collectionId: number) => {
    onCollectionSelectAndClose(collectionId);
  };

  if (allCollections === null) { // Loading state
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FolderSearch className="mr-2 h-5 w-5" />
              Explorador de Colecciones
            </DialogTitle>
            <DialogDescription>Cargando colecciones...</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center items-center h-60">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FolderSearch className="mr-2 h-5 w-5" />
            Explorador de Colecciones
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona una colección para ver sus imágenes.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar colecciones por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>

        <ScrollArea className="max-h-[400px] my-4 border rounded-md">
          <div className="p-4">
            {filteredCollections.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredCollections.map(collection => (
                  <Badge
                    key={collection.id}
                    variant="outline"
                    className="text-sm px-3 py-1 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleCollectionClick(collection.id!)}
                    title={`Seleccionar ${collection.name}`}
                  >
                    {collection.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                {searchTerm ? "No se encontraron colecciones con ese nombre." : "No hay colecciones creadas."}
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
