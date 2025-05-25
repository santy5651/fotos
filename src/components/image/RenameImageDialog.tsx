
"use client";

import { useState, useEffect } from 'react';
import type { ImageMetadata } from '@/types';
import { db, updateImage, checkIfImageExistsByName } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RenameImageDialogProps {
  image: ImageMetadata;
  isOpen: boolean;
  onClose: () => void;
  onRenameSuccess: () => void;
}

export default function RenameImageDialog({ image, isOpen, onClose, onRenameSuccess }: RenameImageDialogProps) {
  const { toast } = useToast();
  const [newName, setNewName] = useState(image.name);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(image.name); // Reset name when dialog opens
      setError(null); // Clear previous errors
    }
  }, [isOpen, image.name]);

  const handleSave = async () => {
    if (!image.id) {
      toast({ variant: "destructive", title: "Error", description: "Image ID is missing." });
      return;
    }
    if (newName.trim() === "") {
      setError("Image name cannot be empty.");
      return;
    }
    if (newName.trim() === image.name) {
      // If name hasn't changed, just mark as not duplicate and close
      setIsSaving(true);
      try {
        await updateImage(image.id, { isPotentialDuplicate: false });
        onRenameSuccess(); 
        onClose();
      } catch (dbError) {
        console.error("Failed to update image status:", dbError);
        toast({ variant: "destructive", title: "Error", description: "Failed to update image status." });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const alreadyExists = await checkIfImageExistsByName(newName.trim());
      if (alreadyExists) {
        setError(`An image named "${newName.trim()}" already exists. Please choose a different name.`);
        setIsSaving(false);
        return;
      }

      await updateImage(image.id, { name: newName.trim(), isPotentialDuplicate: false });
      onRenameSuccess(); 
      onClose(); 
    } catch (dbError) {
      console.error("Failed to rename image:", dbError);
      toast({ variant: "destructive", title: "Error", description: "Failed to rename image." });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Image</DialogTitle>
          <DialogDescription>
            This image was flagged as a potential duplicate due to its name. Enter a new name to keep it, or cancel.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image-new-name" className="text-right col-span-1">
              New Name
            </Label>
            <Input
              id="image-new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="col-span-3"
              disabled={isSaving}
            />
          </div>
          {error && <p className="col-span-4 text-sm text-destructive text-center">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save New Name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
