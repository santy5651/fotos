
"use client";

// Placeholder for BulkAddToCollectionDialog
// This will be implemented more fully in a subsequent step.

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Collection } from '@/types';
import { db, getCollections, bulkAddImagesToCollections } from '@/lib/db'; // Assuming bulkAddImagesToCollections exists
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BulkAddToCollectionDialogProps {
  imageIds: number[];
  isOpen: boolean;
  onClose: () => void;
  onBulkUpdateCollections: () => void;
}

export default function BulkAddToCollectionDialog({ imageIds, isOpen, onClose, onBulkUpdateCollections }: BulkAddToCollectionDialogProps) {
  const { toast } = useToast();
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const collections = useLiveQuery(() => getCollections(), [], []);

  useEffect(() => {
    if (isOpen) {
      setSelectedCollectionIds(new Set()); // Reset selections when dialog opens
    }
  }, [isOpen]);

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
    if (imageIds.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "No images selected." });
      return;
    }
    if (selectedCollectionIds.size === 0) {
      toast({ variant: "destructive", title: "Error", description: "No collections selected to add images to." });
      return;
    }
    setIsSaving(true);
    try {
      const targetCollectionIds = Array.from(selectedCollectionIds);
      await bulkAddImagesToCollections(imageIds, targetCollectionIds);
      toast({ title: "Success", description: `${imageIds.length} image(s) updated.`});
      onBulkUpdateCollections();
      onClose();
    } catch (error) {
      console.error("Failed to bulk update image collections:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add images to collections." });
    } finally {
      setIsSaving(false);
    }
  };

  if (!collections) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {imageIds.length} Images to Collections</DialogTitle>
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
          <DialogTitle>Add {imageIds.length} Image(s) to Collections</DialogTitle>
          <DialogDescription>Select collections to add the selected images to. This will add them to existing collections they might be in.</DialogDescription>
        </DialogHeader>
        
        {collections.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No collections available. Create some first!</p>
        ) : (
          <ScrollArea className="max-h-[300px] my-4 pr-6">
            <div className="space-y-2">
              {collections.map(collection => (
                <div key={collection.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`bulk-collection-${collection.id}`}
                    checked={selectedCollectionIds.has(collection.id!)}
                    onCheckedChange={(checked) => handleCheckedChange(collection.id!, checked)}
                    disabled={isSaving}
                  />
                  <Label htmlFor={`bulk-collection-${collection.id}`} className="font-normal">
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
          <Button onClick={handleSave} disabled={isSaving || collections.length === 0 || selectedCollectionIds.size === 0}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add to Collections
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

