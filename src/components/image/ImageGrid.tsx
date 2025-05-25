
"use client";

import type { ImageMetadata } from '@/types';
import ImageCard from './ImageCard';
import { ScrollArea } from '../ui/scroll-area';
import { AlertTriangle } from 'lucide-react';

interface ImageGridProps {
  images: ImageMetadata[];
  onUpdate: () => void; 
  isReviewDuplicatesMode?: boolean;
}

export default function ImageGrid({ images, onUpdate, isReviewDuplicatesMode }: ImageGridProps) {
  if (images.length === 0) {
    if (isReviewDuplicatesMode) {
        return (
            <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                <AlertTriangle className="w-10 h-10 text-destructive" />
                <p>No potential duplicates found.</p>
                <p className="text-sm">You can return to the normal view by clicking the review button again.</p>
            </div>
        );
    }
    return <div className="text-center text-muted-foreground py-10">No images found. Try uploading some!</div>;
  }

  return (
    <ScrollArea className="h-[calc(100vh-10rem)]"> 
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1">
        {images.map((image) => (
          <ImageCard key={image.id} image={image} onUpdate={onUpdate} />
        ))}
      </div>
    </ScrollArea>
  );
}
