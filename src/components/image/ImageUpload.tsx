
"use client";

import { useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addImage, blobToDataURL, checkIfImageExistsByName } from '@/lib/db';
import type { ImageMetadata } from '@/types';
import { processImage } from '@/ai/flows/process-image-flow';

interface ImageUploadProps {
  onUploadComplete: () => void;
  isAiProcessingEnabled: boolean;
}

export default function ImageUpload({ onUploadComplete, isAiProcessingEnabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let uploadedCount = 0;
    let flaggedCount = 0;
    let processingFailedCount = 0;
    const totalFiles = files.length;
    let continueAiProcessing = isAiProcessingEnabled;

    for (const file of Array.from(files)) {
      let isPotentialDuplicate = false;
      let tags: string[] = [];
      let description: string = "";

      try {
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

        const dimensions = await getImageDimensions(file);

        if (continueAiProcessing && !isPotentialDuplicate) {
          const dataUri = await blobToDataURL(file, { defaultMimeTypeIfGeneric: 'image/png' });
          try {
            let aiResult;
            try {
              aiResult = await processImage({ photoDataUri: dataUri });
            } catch (error) {
              const errorMessage = (error as Error).message;
              if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('service unavailable')) {
                toast({
                  title: `Servicio no disponible para ${file.name}`,
                  description: "Reintentando en 30 segundos...",
                  duration: 30000,
                });
                await new Promise(resolve => setTimeout(resolve, 30000));
                aiResult = await processImage({ photoDataUri: dataUri });
              } else {
                throw error;
              }
            }
            tags = aiResult.tags;
            description = aiResult.description;
            toast({ title: "Procesamiento IA", description: `Etiquetas y descripción generadas para ${file.name}.` });
          } catch (aiError) {
            processingFailedCount++;
            console.error("AI processing error for " + file.name + ":", aiError);
            const errorMessage = (aiError as Error).message;
            const isRateLimitError = errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota');
            const isServiceUnavailableError = errorMessage.includes('503') || errorMessage.toLowerCase().includes('service unavailable');
            
            if (isRateLimitError) {
              continueAiProcessing = false;
              toast({
                variant: "destructive",
                title: "Límite de API Alcanzado",
                description: "El procesamiento con IA se detendrá para el resto de las imágenes en este lote.",
                duration: 8000,
              });
            } else if (isServiceUnavailableError) {
              continueAiProcessing = false;
              toast({
                variant: "destructive",
                title: "Servicio de IA No Disponible",
                description: "El servicio de IA no está disponible tras un reintento. El procesamiento con IA se detendrá para este lote.",
                duration: 8000,
              });
            } else {
                 toast({ 
                    variant: "destructive", 
                    title: "Fallo en Procesamiento IA", 
                    description: `No se pudo procesar ${file.name}. ${errorMessage}` 
                });
            }
          }
        }
        
        const imageMetadata: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus' | 'file' | 'hasTags' | 'hasDescription'> & { file: File, hasTags: boolean, hasDescription: boolean } = {
          name: file.name,
          file: file,
          tags: tags,
          description: description,
          width: dimensions.width,
          height: dimensions.height,
          isFavorite: false,
          isProtected: false,
          mimeType: file.type,
          collectionIds: [],
          isPotentialDuplicate: isPotentialDuplicate, 
          hasTags: tags.length > 0,
          hasDescription: description.trim() !== "",
        };

        await addImage(imageMetadata as any);
        uploadedCount++;
        if (!isPotentialDuplicate) {
          if (isAiProcessingEnabled && continueAiProcessing && (tags.length > 0 || description)) {
            toast({ title: "Subida Exitosa", description: `${file.name} subida, etiquetada y descrita.` });
          } else {
            toast({ title: "Subida Exitosa", description: `${file.name} subida sin procesamiento de IA.` });
          }
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
    if (processingFailedCount > 0) {
        summaryDescription += ` ${processingFailedCount} fallo(s) de procesamiento de IA.`;
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
