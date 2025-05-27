
"use client";

import type { ImageMetadata } from '@/types';
import ImageCard from './ImageCard';
import { ScrollArea } from '../ui/scroll-area';
import { AlertTriangle, FilterX, Inbox, Tag, FileX } from 'lucide-react'; // Added FileX icon

interface ImageGridProps {
  images: ImageMetadata[];
  onUpdate: () => void;
  isReviewDuplicatesMode?: boolean;
  isShowUnassignedMode?: boolean;
  isShowUntaggedMode?: boolean;
  isShowUndescribedMode?: boolean; // New prop
  selectedImageIds: Set<number>;
  onImageToggleSelection: (imageId: number) => void;
  searchTerm?: string; 
}

export default function ImageGrid({ 
  images, 
  onUpdate, 
  isReviewDuplicatesMode, 
  isShowUnassignedMode,
  isShowUntaggedMode,
  isShowUndescribedMode, // New prop
  selectedImageIds,
  onImageToggleSelection,
  searchTerm
}: ImageGridProps) {
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
    if (isShowUndescribedMode) { // New message for undescribed
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
        <p className="text-sm">¡Intenta subir algunas o ajusta tus filtros!</p>
      </div>
    );
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

    