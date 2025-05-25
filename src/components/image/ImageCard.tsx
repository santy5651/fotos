
"use client";

import type { ImageMetadata, Collection } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Heart, Shield, Trash2, RotateCcw, RotateCw, Tag, Loader2, ZoomIn, Edit3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateImage, deleteImage, db } from '@/lib/db';
import NextImage from 'next/image';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AddToCollectionDialog from '@/components/collections/AddToCollectionDialog';
import ImageZoomModal from './ImageZoomModal';
import RenameImageDialog from './RenameImageDialog'; // New Dialog
import { cn } from '@/lib/utils';

interface ImageCardProps {
  image: ImageMetadata;
  onUpdate: () => void;
}

export default function ImageCard({ image, onUpdate }: ImageCardProps) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentRotation, setCurrentRotation] = useState(image.transform?.rotate || 0);
  const [isAddToCollectionDialogOpen, setIsAddToCollectionDialogOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);


  useEffect(() => {
    if (image.file) {
      const url = URL.createObjectURL(image.file);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [image.file]);

  const imageCollections = useLiveQuery(async () => {
    if (image.collectionIds && image.collectionIds.length > 0) {
      return db.collections.where('id').anyOf(image.collectionIds).toArray();
    }
    return [];
  }, [image.id, image.collectionIds], []);


  const handleFavoriteToggle = async () => {
    try {
      await updateImage(image.id!, { isFavorite: !image.isFavorite });
      toast({ title: image.isFavorite ? "Unfavorited" : "Favorited", description: `${image.name} status updated.` });
      onUpdate();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update favorite status." });
    }
  };

  const handleProtectToggle = async () => {
    try {
      await updateImage(image.id!, { isProtected: !image.isProtected });
      toast({ title: image.isProtected ? "Unprotected" : "Protected", description: `${image.name} status updated.` });
      onUpdate();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update protection status." });
    }
  };

  const handleDelete = async () => {
    // For potential duplicates, we allow deletion even if protected, as user is resolving
    if (image.isProtected && !image.isPotentialDuplicate) {
      toast({ variant: "destructive", title: "Cannot Delete", description: "This image is protected." });
      return;
    }
    try {
      await deleteImage(image.id!);
      toast({ title: "Deleted", description: `${image.name} has been deleted.` });
      onUpdate();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message || "Failed to delete image." });
    }
  };
  
  const handleRotate = async (direction: 'cw' | 'ccw') => {
    const newRotation = direction === 'cw' ? (currentRotation + 90) % 360 : (currentRotation - 90 + 360) % 360;
    setCurrentRotation(newRotation);
    try {
      await updateImage(image.id!, { transform: { ...image.transform, rotate: newRotation } });
      onUpdate(); 
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save rotation."});
    }
  };

  const handleCollectionsUpdated = () => {
    onUpdate();
    toast({ title: "Collections Updated", description: `Image "${image.name}" has been updated.` });
  }

  const handleRenameSuccess = () => {
    toast({ title: "Image Renamed", description: "The image has been successfully renamed and kept." });
    onUpdate();
  }


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
      <Card className={cn("flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden", image.isPotentialDuplicate && "border-2 border-destructive/70 ring-2 ring-destructive/30")}>
        <CardContent className="p-0">
          <div className="aspect-[4/3] w-full overflow-hidden relative bg-muted group">
            <NextImage
              src={imageUrl}
              alt={image.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
              style={{ 
                objectFit: 'contain',
                transform: `rotate(${currentRotation}deg)` 
              }}
              className="transition-transform duration-300 ease-in-out group-hover:scale-105"
              data-ai-hint="photo gallery"
            />
            <div className="absolute top-2 right-2 flex gap-1">
              {image.isFavorite && !image.isPotentialDuplicate && <Heart className="h-5 w-5 fill-red-500 text-red-500" />}
              {image.isProtected && !image.isPotentialDuplicate && <Shield className="h-5 w-5 fill-blue-500 text-blue-500" />}
              {image.isPotentialDuplicate && (
                <Tooltip>
                    <TooltipTrigger>
                        <AlertTriangle className="h-5 w-5 text-destructive fill-destructive/20" />
                    </TooltipTrigger>
                    <TooltipContent><p>Potential Duplicate - Needs Review</p></TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {!image.isPotentialDuplicate && (
              <div className="absolute bottom-0 left-0 right-0 px-1 py-1 bg-gradient-to-t from-black/70 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out flex justify-start items-center">
                <div className="flex gap-0.5 flex-wrap">
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleFavoriteToggle} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><Heart className={cn('h-4 w-4', image.isFavorite ? 'fill-red-500 text-red-500' : 'text-neutral-200 hover:text-white')} /></Button></TooltipTrigger><TooltipContent><p>Favorite</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleProtectToggle} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><Shield className={cn('h-4 w-4', image.isProtected ? 'fill-blue-500 text-blue-500' : 'text-neutral-200 hover:text-white')} /></Button></TooltipTrigger><TooltipContent><p>Protect</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsAddToCollectionDialogOpen(true)} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><Tag className="h-4 w-4 text-neutral-200 hover:text-white" /></Button></TooltipTrigger><TooltipContent><p>Add to Collection</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleRotate('ccw')} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><RotateCcw className="h-4 w-4 text-neutral-200 hover:text-white" /></Button></TooltipTrigger><TooltipContent><p>Rotate Left</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleRotate('cw')} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><RotateCw className="h-4 w-4 text-neutral-200 hover:text-white" /></Button></TooltipTrigger><TooltipContent><p>Rotate Right</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsZoomModalOpen(true)} className="h-[28px] w-[28px] p-1 hover:bg-white/10"><ZoomIn className="h-4 w-4 text-neutral-200 hover:text-white" /></Button></TooltipTrigger><TooltipContent><p>Zoom</p></TooltipContent></Tooltip>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        
        <CardHeader className="pt-4 pb-2 px-4">
          <CardTitle className="text-sm font-medium truncate" title={image.name}>{image.name}</CardTitle>
          {image.isPotentialDuplicate && (
            <Badge variant="destructive" className="mt-1 w-fit">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Potential Duplicate
            </Badge>
          )}
          {image.tags && image.tags.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1 mt-1">
                {image.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              {image.tags.length > 2 && (
                <div className="mt-1">
                  <Badge variant="outline" className="text-xs">
                    +{image.tags.length - 2}
                  </Badge>
                </div>
              )}
            </>
          )}
          {image.collectionIds && image.collectionIds.length > 0 && !image.isPotentialDuplicate && (
            <>
              {imageCollections === undefined && (
                <div className="mt-1 flex items-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading collections...
                </div>
              )}
              {imageCollections && imageCollections.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
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
            </>
          )}
        </CardHeader>

        <CardFooter className="flex justify-between items-center px-4 pb-3 pt-2">
          <div className="text-xs text-muted-foreground truncate">
            {new Date(image.createdAt).toLocaleDateString()} - {image.width}x{image.height}
          </div>
          {image.isPotentialDuplicate ? (
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7 border-primary text-primary hover:bg-primary/10" onClick={() => setIsRenameDialogOpen(true)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Rename & Keep</p></TooltipContent>
              </Tooltip>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" className="h-7 w-7">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete This Image?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogDescription>Are you sure you want to delete this copy of "{image.name}"? This action cannot be undone.</AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete This Copy</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={image.isProtected} aria-label="Delete image">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogDescription>This action cannot be undone. This will permanently delete "{image.name}".</AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      </Card>
      {isAddToCollectionDialogOpen && (
        <AddToCollectionDialog
          image={image}
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
          imageName={image.name}
          rotation={currentRotation}
          imageNaturalWidth={image.width}
          imageNaturalHeight={image.height}
        />
      )}
      {isRenameDialogOpen && imageUrl && (
        <RenameImageDialog
          image={image}
          isOpen={isRenameDialogOpen}
          onClose={() => setIsRenameDialogOpen(false)}
          onRenameSuccess={handleRenameSuccess}
        />
      )}
    </>
  );
}
