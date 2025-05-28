
"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ImageMetadata, Collection } from "@/types";
import NextImage from "next/image";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db, updateImage } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Heart, Loader2, ClipboardCopy, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { resizeToDimensions } from '@/lib/imageUtils';
import { Separator } from '../ui/separator';

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
  
  // State for resizing
  const [targetWidthStr, setTargetWidthStr] = useState<string>("");
  const [targetHeightStr, setTargetHeightStr] = useState<string>("");
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number>(1);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (image && image.file) {
      const url = URL.createObjectURL(image.file);
      setImageUrl(url);
      
      if (image.width && image.height) {
        setTargetWidthStr(image.width.toString());
        setTargetHeightStr(image.height.toString());
        setOriginalAspectRatio(image.width / image.height);
      }
      
      return () => URL.revokeObjectURL(url);
    }
  }, [image, isOpen]);

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

  const handleWidthChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newWidthValue = e.target.value;
    setTargetWidthStr(newWidthValue);
    if (newWidthValue && !isNaN(parseFloat(newWidthValue)) && originalAspectRatio !== 0) {
      const numWidth = parseFloat(newWidthValue);
      if (numWidth > 0) {
        setTargetHeightStr(Math.round(numWidth / originalAspectRatio).toString());
      } else {
        setTargetHeightStr("");
      }
    } else if (!newWidthValue) {
        setTargetHeightStr("");
    }
  };

  const handleHeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newHeightValue = e.target.value;
    setTargetHeightStr(newHeightValue);
    if (newHeightValue && !isNaN(parseFloat(newHeightValue)) && originalAspectRatio !== 0) {
      const numHeight = parseFloat(newHeightValue);
      if (numHeight > 0) {
        setTargetWidthStr(Math.round(numHeight * originalAspectRatio).toString());
      } else {
        setTargetWidthStr("");
      }
    } else if (!newHeightValue) {
       setTargetWidthStr("");
    }
  };

  const handleApplyResize = async () => {
    if (!image || !image.file || image.id === undefined) {
      toast({ variant: "destructive", title: "Error", description: "Información de imagen no disponible." });
      return;
    }

    const newWidth = parseInt(targetWidthStr, 10);
    const newHeight = parseInt(targetHeightStr, 10);

    if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
      toast({ variant: "destructive", title: "Dimensiones Inválidas", description: "Por favor, ingrese un ancho y alto válidos y positivos." });
      return;
    }
    
    if (newWidth === image.width && newHeight === image.height) {
        toast({ title: "Sin Cambios", description: "Las dimensiones son las mismas que las actuales." });
        return;
    }

    setIsResizing(true);
    try {
      const resizedFile = await resizeToDimensions(image.file, newWidth, newHeight);
      await updateImage(image.id, {
        file: resizedFile,
        width: newWidth,
        height: newHeight,
        mimeType: resizedFile.type 
      });
      toast({ title: "Imagen Redimensionada", description: `"${image.name}" ha sido redimensionada a ${newWidth}x${newHeight}px.` });
      onUpdate();
      onClose(); 
    } catch (error) {
      console.error("Error resizing image:", error);
      toast({ variant: "destructive", title: "Fallo al Redimensionar", description: (error as Error).message });
    } finally {
      setIsResizing(false);
    }
  };
  
  const resetDimensionsToOriginal = () => {
    if (image && image.width && image.height) {
      setTargetWidthStr(image.width.toString());
      setTargetHeightStr(image.height.toString());
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
                <Label className="text-sm font-medium text-muted-foreground mb-1">Dimensiones Actuales</Label>
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
          
          <Separator className="my-6" />

          <div className="space-y-4 py-4">
            <h3 className="text-md font-semibold">Redimensionar Imagen</h3>
            <p className="text-sm text-muted-foreground">
              Ingrese nuevas dimensiones. La relación de aspecto se mantendrá automáticamente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1 md:col-span-1">
                <Label htmlFor="new-width">Nuevo Ancho (px)</Label>
                <Input
                  id="new-width"
                  type="number"
                  value={targetWidthStr}
                  onChange={handleWidthChange}
                  placeholder="Ancho"
                  min="1"
                  disabled={isResizing}
                  className="w-full"
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <Label htmlFor="new-height">Nuevo Alto (px)</Label>
                <Input
                  id="new-height"
                  type="number"
                  value={targetHeightStr}
                  onChange={handleHeightChange}
                  placeholder="Alto"
                  min="1"
                  disabled={isResizing}
                  className="w-full"
                />
              </div>
              <Button onClick={resetDimensionsToOriginal} variant="outline" disabled={isResizing} className="w-full md:col-span-1">
                <RefreshCcw className="mr-2 h-4 w-4" /> Restablecer
              </Button>
              <Button 
                onClick={handleApplyResize} 
                disabled={isResizing || !targetWidthStr || !targetHeightStr || (parseInt(targetWidthStr) === image.width && parseInt(targetHeightStr) === image.height) }
                className="w-full md:col-span-1"
              >
                {isResizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Aplicar Redimensión
              </Button>
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
