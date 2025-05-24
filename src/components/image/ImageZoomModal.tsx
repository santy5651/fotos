
"use client";

import NextImage from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
  rotation?: number; // Optional rotation prop
}

export default function ImageZoomModal({ isOpen, onClose, imageUrl, imageName, rotation = 0 }: ImageZoomModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] p-0 aspect-video flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-none shadow-2xl">
        {/* Custom Close Button for better positioning over image potentially */}
        <DialogClose asChild className="absolute top-2 right-2 z-50">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white hover:text-white">
              <X className="h-5 w-5" />
            </Button>
        </DialogClose>
        
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <NextImage
            src={imageUrl}
            alt={imageName}
            fill
            style={{ 
              objectFit: 'contain', 
              transform: `rotate(${rotation}deg)` 
            }}
            className="max-w-full max-h-full"
            sizes="100vw" // The image will take up to 100% of the viewport width
            priority // Preload if it's critical content
            data-ai-hint="zoomed image"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
