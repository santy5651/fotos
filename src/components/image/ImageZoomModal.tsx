
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
  imageNaturalWidth: number;
  imageNaturalHeight: number;
}

export default function ImageZoomModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  imageName, 
  rotation = 0,
  imageNaturalWidth,
  imageNaturalHeight
}: ImageZoomModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] h-[90vh] p-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-none shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{imageName}</DialogTitle>
        </DialogHeader>
        
        <DialogClose asChild className="absolute top-2 right-2 z-50">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white hover:text-white">
              <X className="h-5 w-5" />
            </Button>
        </DialogClose>
        
        {/* Removed p-4 from this div to allow scrolling to the very edges */}
        <div className="relative w-full h-full flex items-center justify-center overflow-auto"> 
          <NextImage
            src={imageUrl}
            alt={imageName}
            width={imageNaturalWidth}
            height={imageNaturalHeight}
            style={{ 
              transform: `rotate(${rotation}deg)`,
              maxWidth: 'none', 
              maxHeight: 'none', 
            }}
            sizes="200vw" 
            priority 
            data-ai-hint="detailed zoomed image"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
