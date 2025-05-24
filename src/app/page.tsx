"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import AppLayout from '@/components/layout/AppLayout';
import ImageGrid from '@/components/image/ImageGrid';
import { db, getImages } from '@/lib/db';
import type { ImageMetadata } from '@/types';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const [currentCollectionId, setCurrentCollectionId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0); // To manually trigger re-fetch/re-render

  const images = useLiveQuery(
    async () => {
      const filter: any = {};
      if (currentCollectionId !== null) {
        filter.collectionId = currentCollectionId;
      }
      if (searchTerm) {
        filter.searchTerm = searchTerm;
      }
      return getImages(filter);
    },
    [currentCollectionId, searchTerm, refreshKey], // Dependencies for useLiveQuery
    [] // Initial value
  );

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleCollectionSelect = useCallback((collectionId: number | null) => {
    setCurrentCollectionId(collectionId);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey(prev => prev + 1); // Trigger a re-fetch of images
  }, []);
  
  const handleImageUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  if (images === undefined) { // useLiveQuery returns undefined initially
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout 
      onSearch={handleSearch} 
      onCollectionSelect={handleCollectionSelect}
      onUploadComplete={handleUploadComplete}
    >
      <ImageGrid images={images} onUpdate={handleImageUpdate} />
    </AppLayout>
  );
}
