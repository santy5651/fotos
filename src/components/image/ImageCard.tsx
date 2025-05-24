
"use client";

import type { ImageMetadata, Collection } from '@/types'; // Added Collection type
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Heart, Shield, Trash2, RotateCcw, RotateCw, Tag, Loader2, ZoomIn } from 'lucide-react'; // Added Loader2 and ZoomIn
import { useToast } from '@/hooks/use-toast';
import { updateImage, deleteImage, db } from '@/lib/db'; // Added db
import NextImage from 'next/image';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks'; // Added useLiveQuery
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AddToCollectionDialog from '@/components/collections/AddToCollectionDialog';
import ImageZoomModal from './ImageZoomModal'; // Import the new modal

interface ImageCardProps {
  image: ImageMetadata;
  onUpdate: () => void;
}

export default function ImageCard({ image, onUpdate }: ImageCardProps) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentRotation, setCurrentRotation] = useState(image.transform?.rotate || 0);
  const [isAddToCollectionDialogOpen, setIsAddToCollectionDialogOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false); // State for zoom modal

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
  }, [image.id, image.collectionIds], []); // Dependencies: image.id and its collectionIds, initial value empty array


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
    if (image.isProtected) {
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
      onUpdate(); // To reflect changes if grid re-sorts or re-filters based on persisted data
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save rotation."});
      // Optionally revert currentRotation if persistence fails
      // setCurrentRotation(image.transform?.rotate || 0); 
    }
  };

  const handleCollectionsUpdated = () => {
    onUpdate();
    toast({ title: "Collections Updated", description: `Image "${image.name}" has been updated.` });
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
      <Card className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="aspect-[4/3] w-full overflow-hidden relative bg-muted">
            <NextImage
              src={imageUrl}
              alt={image.name}
              fill // Changed from layout="fill" objectFit="cover"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
              style={{ 
                objectFit: 'cover',
                transform: `rotate(${currentRotation}deg)` 
              }}
              className="transition-transform duration-300 ease-in-out hover:scale-105"
              data-ai-hint="photo gallery"
            />
            <div className="absolute top-2 right-2 flex gap-1">
              {image.isFavorite && <Heart className="h-5 w-5 fill-red-500 text-red-500" />}
              {image.isProtected && <Shield className="h-5 w-5 fill-blue-500 text-blue-500" />}
            </div>
          </div>
        </CardContent>
        
        <CardHeader className="pt-4 pb-2 px-4">
          <CardTitle className="text-sm font-medium truncate" title={image.name}>{image.name}</CardTitle>
          {image.tags && image.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {image.tags.slice(0,3).map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              {image.tags.length > 3 && <Badge variant="outline" className="text-xs">+{image.tags.length - 3}</Badge>}
            </div>
          )}
          {/* Display Collection Badges */}
          {image.collectionIds && image.collectionIds.length > 0 && (
            <>
              {imageCollections === undefined && ( // Still loading
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
                      className="text-xs font-normal border-primary/40 text-primary/90 hover:bg-primary/10"
                    >
                      {collection.name}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </CardHeader>

        <CardFooter className="flex flex-col items-start gap-2 p-4 pt-0">
          <div className="flex justify-between w-full items-center">
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleFavoriteToggle} className="h-8 w-8">
                    <Heart className={`h-4 w-4 ${image.isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Favorite</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleProtectToggle} className="h-8 w-8">
                    <Shield className={`h-4 w-4 ${image.isProtected ? 'fill-blue-500 text-blue-500' : 'text-muted-foreground'}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Protect</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setIsAddToCollectionDialogOpen(true)} className="h-8 w-8">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Add to Collection</p></TooltipContent>
              </Tooltip>
               <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => handleRotate('ccw')} className="h-8 w-8">
                      <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Rotate Left</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" onClick={() => handleRotate('cw')} className="h-8 w-8">
                      <RotateCw className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Rotate Right</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setIsZoomModalOpen(true)} className="h-8 w-8">
                      <ZoomIn className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Zoom</p></TooltipContent>
                </Tooltip>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={image.isProtected}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Delete</p></TooltipContent>
                </Tooltip>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete "{image.name}".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="text-xs text-muted-foreground w-full truncate">
            {new Date(image.createdAt).toLocaleDateString()} - {image.width}x{image.height}
          </div>
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
      {isZoomModalOpen && imageUrl && ( // Ensure imageUrl is available before rendering
        <ImageZoomModal
          isOpen={isZoomModalOpen}
          onClose={() => setIsZoomModalOpen(false)}
          imageUrl={imageUrl}
          imageName={image.name}
          rotation={currentRotation}
        />
      )}
    </>
  );
}
