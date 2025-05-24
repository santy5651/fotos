
"use client";

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ImageMetadata, Collection } from '@/types';
import { db, getCollections, updateImage } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddToCollectionDialogProps {
  image: ImageMetadata;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCollections: (updatedCollectionIds: number[]) => void;
}

export default function AddToCollectionDialog({ image, isOpen, onClose, onUpdateCollections }: AddToCollectionDialogProps) {
  const { toast } = useToast();
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set(image.collectionIds || []));
  const [isSaving, setIsSaving] = useState(false);

  const collections = useLiveQuery(
    () => getCollections(),
    [], // dependencies
    []  // initial value
  );
  
  // Effect to reset selected collections when dialog is reopened for a different image or props change
  useEffect(() => {
    if (isOpen) {
      setSelectedCollectionIds(new Set(image.collectionIds || []));
    }
  }, [isOpen, image.collectionIds]);


  const handleCheckedChange = (collectionId: number, checked: boolean | 'indeterminate') => {
    setSelectedCollectionIds(prev => {
      const newSet = new Set(prev);
      if (checked === true) {
        newSet.add(collectionId);
      } else {
        newSet.delete(collectionId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!image.id) {
      toast({ variant: "destructive", title: "Error", description: "Image ID is missing." });
      return;
    }
    setIsSaving(true);
    try {
      const newCollectionIds = Array.from(selectedCollectionIds);
      await updateImage(image.id, { collectionIds: newCollectionIds });
      onUpdateCollections(newCollectionIds); // Notify parent
      onClose(); // Close dialog
    } catch (error) {
      console.error("Failed to update image collections:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update image collections." });
    } finally {
      setIsSaving(false);
    }
  };

  if (!collections) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add "{image.name}" to Collections</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add "{image.name}" to Collections</DialogTitle>
          <DialogDescription>Select the collections you want to add this image to.</DialogDescription>
        </DialogHeader>
        
        {collections.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No collections available. Create some first!</p>
        ) : (
          <ScrollArea className="max-h-[300px] my-4 pr-6">
            <div className="space-y-2">
              {collections.map(collection => (
                <div key={collection.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`collection-${collection.id}`}
                    checked={selectedCollectionIds.has(collection.id!)}
                    onCheckedChange={(checked) => handleCheckedChange(collection.id!, checked)}
                    disabled={isSaving}
                  />
                  <Label htmlFor={`collection-${collection.id}`} className="font-normal">
                    {collection.name}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isSaving || collections.length === 0}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
