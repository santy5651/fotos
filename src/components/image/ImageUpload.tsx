
"use client";

import { useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addImage, blobToDataURL, checkIfImageExistsByName } from '@/lib/db';
import type { ImageMetadata } from '@/types';
import { tagImage } from '@/ai/flows/tag-image';

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
    let flaggedCount = 0;
    let taggingFailedCount = 0;
    const totalFiles = files.length;

    for (const file of Array.from(files)) {
      let isPotentialDuplicate = false;
      let tags: string[] = [];
      try {
        // 0. Check for duplicates by name (non-flagged images)
        const isExisting = await checkIfImageExistsByName(file.name);
        if (isExisting) {
          isPotentialDuplicate = true;
          toast({
            variant: "default",
            title: "Potencial Duplicado",
            description: `La imagen "${file.name}" tiene el mismo nombre que una imagen existente. Ha sido marcada para revisión.`
          });
          console.warn(`Potential duplicate file flagged: ${file.name}`);
          flaggedCount++;
        }

        // 1. Get dimensions
        const dimensions = await getImageDimensions(file);

        // 2. Convert to data URI for AI
        const dataUri = await blobToDataURL(file);

        // 3. AI Tagging
        try {
          const aiResult = await tagImage({ photoDataUri: dataUri });
          tags = aiResult.tags;
          if (!isPotentialDuplicate) { // Don't toast AI tags for duplicates to reduce noise
            toast({ title: "Etiquetado IA", description: `Etiquetas generadas para ${file.name}: ${tags.join(', ')}` });
          }
        } catch (aiError) {
          taggingFailedCount++;
          console.error("AI tagging error:", aiError);
          toast({ variant: "destructive", title: "Fallo en Etiquetado IA", description: `No se pudieron generar etiquetas para ${file.name}. La imagen se guardará sin etiquetas.` });
          // tags will remain an empty array
        }

        // 4. Prepare metadata
        const imageMetadata: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus' | 'file' | 'hasTags'> & { file: File, hasTags: boolean } = {
          name: file.name,
          file: file,
          tags: tags,
          width: dimensions.width,
          height: dimensions.height,
          isFavorite: false,
          isProtected: false,
          mimeType: file.type,
          collectionIds: [],
          isPotentialDuplicate: isPotentialDuplicate, // Set the flag
          hasTags: tags.length > 0,
        };

        await addImage(imageMetadata as any);
        uploadedCount++;
        if (!isPotentialDuplicate && tags.length > 0) { // Only success toast if not duplicate and tagging was successful
            toast({ title: "Subida Exitosa", description: `${file.name} subida y procesada.` });
        } else if (!isPotentialDuplicate && tags.length === 0 && taggingFailedCount > 0) {
            // Handled by the AI tagging failed toast already
        }


      } catch (error) {
        console.error("Upload error:", error);
        toast({ variant: "destructive", title: "Fallo en Subida", description: `No se pudo subir ${file.name}. ${(error as Error).message}` });
      }
    }
    setIsUploading(false);
    if (uploadedCount > 0) {
      onUploadComplete();
    }

    let summaryDescription = `${uploadedCount}/${totalFiles} imágenes procesadas.`;
    if (flaggedCount > 0) {
        summaryDescription += ` ${flaggedCount} potencial(es) duplicado(s) marcado(s) para revisión.`;
    }
    if (taggingFailedCount > 0) {
        summaryDescription += ` ${taggingFailedCount} etiquetado(s) de IA fallido(s).`;
    }
    toast({ title: "Subida Finalizada", description: summaryDescription, duration: 7000 });

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
          Subir
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
