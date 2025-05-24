"use client";

import { useState, useEffect } from 'react';

interface ImageDimensions {
  width: number;
  height: number;
}

export function useImageDimensions(file: File | null): ImageDimensions | null {
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);

  useEffect(() => {
    if (!file) {
      setDimensions(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setDimensions({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        console.error("Error loading image for dimension check.");
        setDimensions(null);
      };
      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };
    reader.onerror = () => {
      console.error("Error reading file for dimension check.");
      setDimensions(null);
    };
    reader.readAsDataURL(file);
    
    // Cleanup function
    return () => {
      // No specific cleanup needed for FileReader or Image object here once loaded/errored
    };
  }, [file]);

  return dimensions;
}
