
"use client";

import type { ImageMetadata, Collection } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Heart, Shield, Trash2, RotateCcw, RotateCw, Tag, Loader2, ZoomIn, Edit3, CheckCircle2, AlertTriangle, Wand2, FileText, FilePenLine } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';
import { updateImage, deleteImage, db, blobToDataURL } from '@/lib/db'; 
import NextImage from 'next/image';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AddToCollectionDialog from '@/components/collections/AddToCollectionDialog';
import ImageZoomModal from './ImageZoomModal';
import RenameImageDialog from './RenameImageDialog';
import { Checkbox } from '@/components/ui/checkbox'; 
import { cn } from '@/lib/utils';
import { tagImage } from '@/ai/flows/tag-image'; 
import { describeImage } from '@/ai/flows/describe-image-flow';
import ImageDetailsModal from './ImageDetailsModal';

interface ImageCardProps {
  image: ImageMetadata;
  onUpdate: () => void;
  isSelected: boolean;
  onToggleSelection: () => void;
}

export default function ImageCard({ image, onUpdate, isSelected, onToggleSelection }: ImageCardProps) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // The 'image' prop is the lightweight version without the 'file' blob.
  // We use useLiveQuery to get the full object reactively, which will include the blob.
  const fullImage = useLiveQuery(() => image.id ? db.images.get(image.id) : Promise.resolve(undefined), [image.id]);

  const [isAddToCollectionDialogOpen, setIsAddToCollectionDialogOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isRetagging, setIsRetagging] = useState(false); 
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isImageDetailsModalOpen, setIsImageDetailsModalOpen] = useState(false);

  // Use the fullImage for display data if available, otherwise fall back to the initial lightweight prop.
  const displayImage = fullImage || image;
  const currentRotation = displayImage.transform?.rotate || 0;

  useEffect(() => {
    let objectUrl: string | null = null;
    if (fullImage?.file) {
      objectUrl = URL.createObjectURL(fullImage.file);
      setImageUrl(objectUrl);
    }
    // Cleanup function to revoke the object URL
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fullImage?.file]);


  const imageCollections = useLiveQuery(async () => {
    if (displayImage.collectionIds && displayImage.collectionIds.length > 0) {
      return db.collections.where('id').anyOf(displayImage.collectionIds).toArray();
    }
    return [];
  }, [displayImage.id, displayImage.collectionIds], []);


  const handleFavoriteToggle = async () => {
    if (!displayImage.id) return;
    try {
      await updateImage(displayImage.id, { isFavorite: !displayImage.isFavorite });
      toast({ title: displayImage.isFavorite ? "Unfavorited" : "Favorited", description: `${displayImage.name} status updated.` });
      onUpdate();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update favorite status." });
    }
  };

  const handleProtectToggle = async () => {
    if (!displayImage.id) return;
    try {
      await updateImage(displayImage.id, { isProtected: !displayImage.isProtected });
      toast({ title: displayImage.isProtected ? "Unprotected" : "Protected", description: `${displayImage.name} status updated.` });
      onUpdate();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update protection status." });
    }
  };

  const handleDelete = async () => {
    if (displayImage.isProtected && !displayImage.isPotentialDuplicate) {
      toast({ variant: "destructive", title: "Cannot Delete", description: "This image is protected." });
      return;
    }
    if (!displayImage.id) return;
    try {
      await deleteImage(displayImage.id);
      toast({ title: "Deleted", description: `${displayImage.name} has been deleted.` });
      onUpdate();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message || "Failed to delete image." });
    }
  };

  const handleRotate = async (direction: 'cw' | 'ccw') => {
    if (!displayImage.id) return;
    const newRotation = direction === 'cw' ? (currentRotation + 90) % 360 : (currentRotation - 90 + 360) % 360;
    try {
      await updateImage(displayImage.id, { transform: { ...displayImage.transform, rotate: newRotation } });
      onUpdate();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save rotation."});
    }
  };

  const handleCollectionsUpdated = () => {
    onUpdate();
    toast({ title: "Collections Updated", description: `Image "${displayImage.name}" has been updated.` });
  }

  const handleRenameSuccess = () => {
    toast({ title: "Image Renamed", description: "The image has been successfully renamed and kept." });
    onUpdate();
  }

  const handleRegenerateTags = async () => {
    if (!fullImage?.id || !fullImage?.file) {
      toast({ variant: "destructive", title: "Error", description: "El archivo de imagen completo no está cargado. Inténtelo de nuevo en un momento." });
      return;
    }
    setIsRetagging(true);
    try {
      const dataUri = await blobToDataURL(fullImage.file, { defaultMimeTypeIfGeneric: 'image/png' });
      const aiResult = await tagImage({ photoDataUri: dataUri });
      await updateImage(fullImage.id, { tags: aiResult.tags, hasTags: aiResult.tags.length > 0 });
      toast({ title: "Etiquetas Regeneradas", description: `Se generaron nuevas etiquetas para ${fullImage.name}.` });
      onUpdate(); 
    } catch (error) {
      console.error("Error regenerating tags:", error);
      const errorMessage = (error as Error).message;
      const isRateLimitError = errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit');
      toast({
        variant: "destructive",
        title: "Fallo al Regenerar Etiquetas",
        description: `No se pudieron generar etiquetas para ${fullImage.name}. ${ isRateLimitError ? 'Límite de API alcanzado. Intenta más tarde.' : errorMessage }`
      });
    } finally {
      setIsRetagging(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!fullImage?.id || !fullImage?.file) {
      toast({ variant: "destructive", title: "Error", description: "El archivo de imagen completo no está cargado. Inténtelo de nuevo en un momento." });
      return;
    }
    setIsGeneratingDescription(true);
    try {
      const dataUri = await blobToDataURL(fullImage.file, { defaultMimeTypeIfGeneric: 'image/png' });
      const aiResult = await describeImage({ photoDataUri: dataUri });
      
      const newDescription = aiResult.description;
      const descriptionToSave = typeof newDescription === 'string' ? newDescription : "";
      const newHasDescription = descriptionToSave.trim() !== "";

      await updateImage(fullImage.id, { description: descriptionToSave, hasDescription: newHasDescription });

      if (newHasDescription) {
        toast({ title: "Descripción Generada", description: `Se generó una descripción para ${fullImage.name}.` });
      } else {
        toast({ title: "Descripción No Detallada", description: `La IA generó una descripción vacía o no pudo detallar ${fullImage.name}. Intente de nuevo o con otra imagen.`, duration: 7000 });
      }
      onUpdate(); 
    } catch (error) {
      console.error("Error generating description:", error);
      const errorMessage = (error as Error).message;
      const isRateLimitError = errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit');
      toast({
        variant: "destructive",
        title: "Fallo al Generar Descripción",
        description: `No se pudo generar una descripción para ${fullImage.name}. ${ isRateLimitError ? 'Límite de API alcanzado. Intenta más tarde.' : errorMessage }`
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };


  if (!imageUrl) {
    return (
      <Card className="flex flex-col justify-between animate-pulse">
        <div className="aspect-[4/3] bg-muted rounded-t-lg"></div>
        <CardHeader>
          <div className="h-4 bg-muted rounded w-3/4"></div>
        </CardHeader>
        <CardFooter className="flex justify-end gap-2">
          <div className="h-8 w-8 bg-muted rounded"></div>
          <div className="h-8 w-8 bg-muted rounded"></div>
          <div className="h-8 w-8 bg-muted rounded"></div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn(
        "flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden",
        displayImage.isPotentialDuplicate && "border-2 border-destructive/70 ring-2 ring-destructive/30",
        isSelected && "ring-2 ring-primary border-primary shadow-primary/30"
      )}>
        <CardContent className="p-0">
          <div className="aspect-[4/3] w-full overflow-hidden relative bg-muted group">
            <NextImage
              src={imageUrl}
              alt={displayImage.name}
              fill
              style={{
                objectFit: 'contain', 
                transform: `rotate(${currentRotation}deg)`
              }}
              className="transition-transform duration-300 ease-in-out group-hover:scale-105"
              data-ai-hint="photo gallery"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('.image-actions-overlay') || (e.target as HTMLElement).closest('.image-selection-checkbox')) {
                  return;
                }
                onToggleSelection();
              }}
            />
            <div 
              className="image-selection-checkbox absolute top-2 left-2 z-20 p-1 bg-background/50 hover:bg-background/70 rounded-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation(); 
                onToggleSelection();
              }}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelection}
                className="h-5 w-5 border-white data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                aria-label="Select image"
              />
            </div>

            <div className="absolute top-2 right-2 flex gap-1 z-10">
              {displayImage.isFavorite && !displayImage.isPotentialDuplicate && <Heart className="h-5 w-5 fill-red-500 text-red-500" />}
              {displayImage.isProtected && !displayImage.isPotentialDuplicate && <Shield className="h-5 w-5 fill-blue-500 text-blue-500" />}
              {displayImage.isPotentialDuplicate && (
                <Tooltip>
                    <TooltipTrigger>
                        <AlertTriangle className="h-5 w-5 text-destructive fill-destructive/20" />
                    </TooltipTrigger>
                    <TooltipContent><p>Potential Duplicate - Needs Review</p></TooltipContent>
                </Tooltip>
              )}
            </div>

            {!displayImage.isPotentialDuplicate && (
              <div className="image-actions-overlay absolute bottom-0 left-0 right-0 px-1 py-1 bg-gradient-to-t from-black/70 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out flex justify-start items-center z-10">
                <div className="flex gap-0.5 flex-wrap">
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleFavoriteToggle} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><Heart className={cn('h-4 w-4', displayImage.isFavorite ? 'fill-red-500 text-red-500' : 'text-neutral-200 hover:text-white')} /></Button></TooltipTrigger><TooltipContent><p>Favorito</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleProtectToggle} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><Shield className={cn('h-4 w-4', displayImage.isProtected ? 'fill-blue-500 text-blue-500' : 'text-neutral-200 hover:text-white')} /></Button></TooltipTrigger><TooltipContent><p>Proteger</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsAddToCollectionDialogOpen(true)} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><Tag className="h-4 w-4 text-neutral-200 hover:text-white" /></Button></TooltipTrigger><TooltipContent><p>Añadir a Colección</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleRotate('ccw')} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><RotateCcw className="h-4 w-4 text-neutral-200 hover:text-white" /></Button></TooltipTrigger><TooltipContent><p>Girar Izquierda</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleRotate('cw')} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><RotateCw className="h-4 w-4 text-neutral-200 hover:text-white" /></Button></TooltipTrigger><TooltipContent><p>Girar Derecha</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsZoomModalOpen(true)} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><ZoomIn className="h-4 w-4 text-neutral-200 hover:text-white" /></Button></TooltipTrigger><TooltipContent><p>Zoom</p></TooltipContent></Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsImageDetailsModalOpen(true)} 
                        className="h-[28px] w-[28px] p-1 hover:bg-white/10"
                        disabled={!fullImage}
                      >
                        <FilePenLine className="h-4 w-4 text-neutral-200 hover:text-white" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Detalles y Edición</p></TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardHeader className="pt-4 pb-2 px-4 space-y-1">
          <CardTitle className="text-sm font-medium truncate" title={displayImage.name}>{displayImage.name}</CardTitle>
          
          {displayImage.isPotentialDuplicate ? (
            <Badge variant="destructive" className="w-fit">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Potencial Duplicado
            </Badge>
          ) : displayImage.hasTags ? (
            <div>
              <div className="flex flex-wrap gap-1">
                {displayImage.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              {displayImage.tags.length > 2 && (
                <div className="mt-0.5"> 
                  <Badge variant="outline" className="text-xs">
                    +{displayImage.tags.length - 2}
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center">
              <span className="text-xs text-muted-foreground italic mr-2">No hay etiquetas.</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRegenerateTags} 
                disabled={isRetagging || !fullImage}
                className="h-7 px-2 py-1 text-xs"
              >
                {isRetagging ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 h-3 w-3" />
                )}
                Regenerar
              </Button>
            </div>
          )}

          {displayImage.collectionIds && displayImage.collectionIds.length > 0 && !displayImage.isPotentialDuplicate && (
            <div>
              {imageCollections === undefined && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" /> Cargando colecciones...
                </div>
              )}
              {imageCollections && imageCollections.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {imageCollections.map(collection => (
                    <Badge
                      key={collection.id}
                      variant="outline"
                      className="text-xs font-semibold border-primary/40 text-foreground hover:bg-primary/10"
                    >
                      {collection.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {!displayImage.isPotentialDuplicate && (
            displayImage.hasDescription ? (
              <p className="text-xs text-muted-foreground pt-1 leading-snug max-h-10 overflow-hidden text-ellipsis" title={displayImage.description}>
                {displayImage.description}
              </p>
            ) : (
              <div className="pt-1 flex items-center">
                <span className="text-xs text-muted-foreground italic mr-2">Sin descripción.</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGenerateDescription} 
                  disabled={isGeneratingDescription || !fullImage}
                  className="h-7 px-2 py-1 text-xs"
                >
                  {isGeneratingDescription ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="mr-1 h-3 w-3" />
                  )}
                  Generar
                </Button>
              </div>
            )
          )}
        </CardHeader>

        <CardFooter className="flex justify-between items-center px-4 pb-3 pt-2">
          <div className="text-xs text-muted-foreground truncate">
            {new Date(displayImage.createdAt).toLocaleDateString()} - {displayImage.width}x{displayImage.height} (ID: {displayImage.id})
          </div>
          {displayImage.isPotentialDuplicate ? (
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7 border-primary text-primary hover:bg-primary/10" onClick={() => setIsRenameDialogOpen(true)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Renombrar y Conservar</p></TooltipContent>
              </Tooltip>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" className="h-7 w-7">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>¿Eliminar esta Imagen?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogDescription>¿Estás seguro que quieres eliminar esta copia de "{displayImage.name}"? Esta acción no se puede deshacer.</AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar esta Copia</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={displayImage.isProtected} aria-label="Delete image">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogDescription>Esta acción no se puede deshacer. Esto eliminará permanentemente "{displayImage.name}".</AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      </Card>
      {isAddToCollectionDialogOpen && (
        <AddToCollectionDialog
          image={displayImage}
          isOpen={isAddToCollectionDialogOpen}
          onClose={() => setIsAddToCollectionDialogOpen(false)}
          onUpdateCollections={handleCollectionsUpdated}
        />
      )}
      {isZoomModalOpen && imageUrl && (
        <ImageZoomModal
          isOpen={isZoomModalOpen}
          onClose={() => setIsZoomModalOpen(false)}
          imageUrl={imageUrl}
          imageName={displayImage.name}
          rotation={currentRotation}
          imageNaturalWidth={displayImage.width}
          imageNaturalHeight={displayImage.height}
        />
      )}
      {isRenameDialogOpen && (
        <RenameImageDialog
          image={displayImage}
          isOpen={isRenameDialogOpen}
          onClose={() => setIsRenameDialogOpen(false)}
          onRenameSuccess={handleRenameSuccess}
        />
      )}
      {isImageDetailsModalOpen && fullImage && (
        <ImageDetailsModal
          image={fullImage}
          isOpen={isImageDetailsModalOpen}
          onClose={() => setIsImageDetailsModalOpen(false)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
