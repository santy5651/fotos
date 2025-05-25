
"use client";

import { useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addImage, blobToDataURL, checkIfImageExistsByName } from '@/lib/db'; // Ensure checkIfImageExistsByName is imported
import type { ImageMetadata } from '@/types';
import { tagImage } from '@/ai/flows/tag-image'; // Ensure this path is correct

interface ImageUploadProps {
  onUploadComplete: () => void;
}

export default function ImageUpload({ onUploadComplete }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let uploadedCount = 0;
    const totalFiles = files.length;

    for (const file of Array.from(files)) {
      try {
        // 0. Check for duplicates by name
        const isDuplicate = await checkIfImageExistsByName(file.name);
        if (isDuplicate) {
          toast({ 
            variant: "destructive", // Or "default" if you prefer less alarming
            title: "Duplicate Skipped", 
            description: `An image named "${file.name}" already exists and was not uploaded.` 
          });
          console.warn(`Duplicate file skipped: ${file.name}`);
          continue; // Skip to the next file
        }

        // 1. Get dimensions
        const dimensions = await getImageDimensions(file);

        // 2. Convert to data URI for AI
        const dataUri = await blobToDataURL(file);
        
        // 3. AI Tagging
        let tags: string[] = [];
        try {
          const aiResult = await tagImage({ photoDataUri: dataUri });
          tags = aiResult.tags;
          toast({ title: "AI Tagging", description: `Tags generated for ${file.name}: ${tags.join(', ')}` });
        } catch (aiError) {
          console.error("AI tagging error:", aiError);
          toast({ variant: "destructive", title: "AI Tagging Failed", description: `Could not generate tags for ${file.name}.` });
        }

        // 4. Prepare metadata
        const imageMetadata: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus' | 'file'> & { file: File } = {
          name: file.name,
          file: file,
          tags: tags,
          width: dimensions.width,
          height: dimensions.height,
          isFavorite: false,
          isProtected: false,
          mimeType: file.type,
          collectionIds: [], // Default to no collection
        };
        
        await addImage(imageMetadata as any); // Dexie handles the 'file' field correctly
        uploadedCount++;
        toast({ title: "Upload Success", description: `${file.name} uploaded and processed.` });

      } catch (error) {
        console.error("Upload error:", error);
        toast({ variant: "destructive", title: "Upload Failed", description: `Could not upload ${file.name}. ${(error as Error).message}` });
      }
    }
    setIsUploading(false);
    if (uploadedCount > 0) {
      onUploadComplete();
    }
    toast({ title: "Upload Finished", description: `${uploadedCount}/${totalFiles} images processed. ${totalFiles - uploadedCount} duplicates skipped.` });
    
    // Reset file input
    event.target.value = '';
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          reject(new Error("FileReader result was null."));
        }
      };
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div>
      <Button asChild variant="outline" disabled={isUploading}>
        <label htmlFor="image-upload" className="cursor-pointer">
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          Upload
          <Input
            id="image-upload"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </Button>
    </div>
  );
}

