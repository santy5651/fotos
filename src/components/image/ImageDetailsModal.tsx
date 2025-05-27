
"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ImageMetadata, Collection } from "@/types";
import NextImage from "next/image";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db, updateImage } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Heart, Loader2, ClipboardCopy } from "lucide-react"; // Added ClipboardCopy
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from '@/components/ui/label';

interface ImageDetailsModalProps {
  image: ImageMetadata;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; 
}

export default function ImageDetailsModal({ image, isOpen, onClose, onUpdate }: ImageDetailsModalProps) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);

  useEffect(() => {
    if (image && image.file) {
      const url = URL.createObjectURL(image.file);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [image]);

  const imageCollections = useLiveQuery(async () => {
    if (image && image.collectionIds && image.collectionIds.length > 0) {
      return db.collections.where('id').anyOf(image.collectionIds).toArray();
    }
    return [];
  }, [image?.id, image?.collectionIds], []);


  const handleFavoriteToggle = async () => {
    if (!image || image.id === undefined) return;
    setIsUpdatingFavorite(true);
    try {
      await updateImage(image.id, { isFavorite: !image.isFavorite });
      toast({ title: image.isFavorite ? "Quitado de Favoritos" : "Añadido a Favoritos", description: `"${image.name}" actualizado.` });
      onUpdate(); 
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Fallo al actualizar estado de favorito." });
    } finally {
      setIsUpdatingFavorite(false);
    }
  };

  const handleCopyDescription = async () => {
    if (!image.description) {
      toast({ variant: "destructive", title: "Error", description: "No hay descripción para copiar." });
      return;
    }
    try {
      await navigator.clipboard.writeText(image.description);
      toast({ title: "Copiado", description: "Descripción copiada al portapapeles." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al Copiar", description: "No se pudo copiar la descripción." });
      console.error('Failed to copy description: ', err);
    }
  };

  if (!image) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalles y Edición de Imagen: {image.name}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6"> 
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            {/* Columna de Imagen */}
            <div className="md:col-span-1 flex flex-col items-center gap-4">
              {imageUrl ? (
                <div className="relative w-full aspect-square rounded-md overflow-hidden border">
                  <NextImage src={imageUrl} alt={image.name} layout="fill" objectFit="contain" data-ai-hint="image detail view" />
                </div>
              ) : (
                <div className="w-full aspect-square bg-muted rounded-md flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
               <Button 
                onClick={handleFavoriteToggle} 
                variant={image.isFavorite ? "default" : "outline"}
                className="w-full"
                disabled={isUpdatingFavorite}
              >
                {isUpdatingFavorite ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Heart className={cn("mr-2 h-4 w-4", image.isFavorite && "fill-red-500 text-red-500")} />
                )}
                {image.isFavorite ? "Favorito" : "Marcar como Favorito"}
              </Button>
            </div>

            {/* Columna de Detalles */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-1">ID</Label>
                <p className="text-sm">{image.id ?? 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-1">Nombre Original</Label>
                <p className="text-sm break-all">{image.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-1">Fecha de Creación</Label>
                <p className="text-sm">{new Date(image.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-1">Dimensiones</Label>
                <p className="text-sm">{image.width} x {image.height} px</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-1">Tipo de Imagen</Label>
                <p className="text-sm">{image.mimeType}</p>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label htmlFor="image-description-area" className="text-sm font-medium text-muted-foreground">Descripción (Generada por IA)</Label>
                  {image.description && image.description.trim() !== "" && (
                    <Button variant="outline" size="sm" onClick={handleCopyDescription} className="h-7 px-2 py-1 text-xs">
                      <ClipboardCopy className="mr-1 h-3 w-3" />
                      Copiar
                    </Button>
                  )}
                </div>
                <Textarea 
                  id="image-description-area"
                  value={image.description && image.description.trim() !== "" ? image.description : "Sin descripción generada."} 
                  readOnly 
                  className="text-sm h-24 bg-muted/50 border-input" 
                  aria-label="Descripción de la imagen"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-1">Etiquetas</Label>
                {image.tags && image.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {image.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sin etiquetas.</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-1">Colecciones</Label>
                {imageCollections === undefined ? (
                   <p className="text-sm text-muted-foreground italic">Cargando colecciones...</p>
                ) : imageCollections && imageCollections.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {imageCollections.map(collection => <Badge key={collection.id} variant="outline" className="border-primary/40 text-foreground">{collection.name}</Badge>)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No pertenece a ninguna colección.</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
