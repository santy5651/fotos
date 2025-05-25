
"use client";

import type { ImageMetadata } from '@/types';
import ImageCard from './ImageCard';
import { ScrollArea } from '../ui/scroll-area';
import { AlertTriangle, FilterX } from 'lucide-react';

interface ImageGridProps {
  images: ImageMetadata[];
  onUpdate: () => void;
  isReviewDuplicatesMode?: boolean;
  isShowUnassignedMode?: boolean;
  selectedImageIds: Set<number>;
  onImageToggleSelection: (imageId: number) => void;
}

export default function ImageGrid({ 
  images, 
  onUpdate, 
  isReviewDuplicatesMode, 
  isShowUnassignedMode,
  selectedImageIds,
  onImageToggleSelection
}: ImageGridProps) {
  if (images.length === 0) {
    if (isReviewDuplicatesMode) {
        return (
            <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                <AlertTriangle className="w-10 h-10 text-destructive" />
                <p>No se encontraron duplicados potenciales.</p>
                <p className="text-sm">Puedes volver a la vista normal haciendo clic nuevamente en el botón de revisión.</p>
            </div>
        );
    }
    if (isShowUnassignedMode) {
        return (
            <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                <FilterX className="w-10 h-10 text-muted-foreground" />
                <p>No hay imágenes sin asignar a colecciones.</p>
            </div>
        );
    }
    return <div className="text-center text-muted-foreground py-10">No se encontraron imágenes. ¡Intenta subir algunas!</div>;
  }

  return (
    <ScrollArea className="h-[calc(100vh-10rem)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1">
        {images.map((image) => (
          <ImageCard 
            key={image.id} 
            image={image} 
            onUpdate={onUpdate}
            isSelected={selectedImageIds.has(image.id!)}
            onToggleSelection={() => onImageToggleSelection(image.id!)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
