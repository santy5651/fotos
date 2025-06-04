
"use client";

import type { ImageMetadata } from '@/types';
import ImageCard from './ImageCard';
import { ScrollArea } from '../ui/scroll-area';
import { AlertTriangle, FilterX, Inbox, Tag, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageGridProps {
  images: ImageMetadata[];
  onUpdate: () => void;
  isReviewDuplicatesMode?: boolean;
  isShowUnassignedMode?: boolean;
  isShowUntaggedMode?: boolean;
  isShowUndescribedMode?: boolean;
  selectedImageIds: Set<number>;
  onImageToggleSelection: (imageId: number) => void;
  searchTerm?: string; 
  numberOfColumns?: number; // New prop
}

export default function ImageGrid({ 
  images, 
  onUpdate, 
  isReviewDuplicatesMode, 
  isShowUnassignedMode,
  isShowUntaggedMode,
  isShowUndescribedMode,
  selectedImageIds,
  onImageToggleSelection,
  searchTerm,
  numberOfColumns = 4 // Default to 4 columns
}: ImageGridProps) {
  
  const getColsClass = (cols: number): string => {
    switch (cols) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 sm:grid-cols-2';
      case 3: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
      case 4: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      case 5: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      case 6: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'; // Adjusted for more granular control
      default: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'; // Default
    }
  };

  if (images.length === 0) {
    if (isReviewDuplicatesMode) {
        return (
            <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                <AlertTriangle className="w-10 h-10 text-destructive" />
                <p>No se encontraron duplicados potenciales.</p>
                <p className="text-sm">Puedes volver a la vista normal haciendo clic nuevamente en la opción de revisión.</p>
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
    if (isShowUntaggedMode) { 
        return (
            <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                <Tag className="w-10 h-10 text-muted-foreground" />
                <p>No hay imágenes sin etiquetas.</p>
            </div>
        );
    }
    if (isShowUndescribedMode) { 
        return (
            <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                <FileX className="w-10 h-10 text-muted-foreground" /> 
                <p>No hay imágenes sin descripción.</p>
            </div>
        );
    }
    if (searchTerm?.startsWith('tag:')) {
      const tagName = searchTerm.substring(4);
      return (
        <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
          <Inbox className="w-10 h-10 text-muted-foreground" />
          <p>No se encontraron imágenes con la etiqueta: "{tagName}".</p>
        </div>
      );
    }
    if (searchTerm && searchTerm.trim() !== '') {
       return (
        <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
          <Inbox className="w-10 h-10 text-muted-foreground" />
          <p>No se encontraron imágenes para el término de búsqueda: "{searchTerm}".</p>
        </div>
      );
    }
    return (
      <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
        <Inbox className="w-10 h-10 text-muted-foreground" />
        <p>No se encontraron imágenes.</p>
        <p className="text-sm">¡Intenta subir algunas o ajusta tus filtros y opciones de vista!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-14rem)]"> {/* Adjusted height for new controls */}
      <div className={cn("grid gap-4 p-1", getColsClass(numberOfColumns))}>
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
