
"use client";

import { useState } from 'react';
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
  rotation?: number;
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
  const [zoomMode, setZoomMode] = useState<'fit' | 'actual'>('fit');

  if (!isOpen) return null;

  const toggleZoomMode = () => {
    setZoomMode(prevMode => prevMode === 'fit' ? 'actual' : 'fit');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] h-[90vh] p-0 flex flex-col bg-background/80 backdrop-blur-sm border-none shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{imageName}</DialogTitle>
        </DialogHeader>

        <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleZoomMode}
            className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white hover:text-white"
            title={zoomMode === 'fit' ? 'View Actual Size' : 'Fit to Screen'}
          >
            {zoomMode === 'fit' ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
            <span className="sr-only">{zoomMode === 'fit' ? 'View Actual Size' : 'Fit to Screen'}</span>
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>
        </div>

        <div
          className={cn(
            "flex-grow relative", // flex-grow to take remaining space, relative for NextImage layout="fill"
            zoomMode === 'actual' ? "overflow-auto" : "overflow-hidden flex items-center justify-center p-1" // Add padding for 'fit' mode to ensure no edge clipping
          )}
        >
          {zoomMode === 'fit' ? (
            <NextImage
              src={imageUrl}
              alt={imageName}
              layout="fill"
              objectFit="contain"
              style={{ transform: `rotate(${rotation}deg)` }}
              priority
              data-ai-hint="zoomed fitted image"
            />
          ) : (
            // Wrapper for NextImage to allow transform-origin and ensure scroll container sizes correctly
            <div className="inline-block" 
                 style={{ 
                    // This div will be scrolled. Its size should be the natural image size.
                    // NextImage below will fill this.
                 }}
            > 
              <NextImage
                src={imageUrl}
                alt={imageName}
                width={imageNaturalWidth}
                height={imageNaturalHeight}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  // display: 'block' is default for NextImage with width/height
                }}
                priority
                data-ai-hint="detailed zoomed image actual size"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
