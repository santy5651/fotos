"use client";

import type { ImageMetadata } from '@/types';
import ImageCard from './ImageCard';
import { ScrollArea } from '../ui/scroll-area';

interface ImageGridProps {
  images: ImageMetadata[];
  onUpdate: () => void; // Callback to re-fetch images after an update
}

export default function ImageGrid({ images, onUpdate }: ImageGridProps) {
  if (images.length === 0) {
    return <div className="text-center text-muted-foreground py-10">No images found. Try uploading some!</div>;
  }

  return (
    <ScrollArea className="h-[calc(100vh-10rem)]"> {/* Adjust height as needed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1">
        {images.map((image) => (
          <ImageCard key={image.id} image={image} onUpdate={onUpdate} />
        ))}
      </div>
    </ScrollArea>
  );
}
