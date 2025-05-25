
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
  const [reviewDuplicatesMode, setReviewDuplicatesMode] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0); // To manually trigger re-fetch/re-render

  const images = useLiveQuery(
    async () => {
      const filter: any = { reviewDuplicates: reviewDuplicatesMode };
      if (!reviewDuplicatesMode) { // Only apply collection/search if not in review mode
        if (currentCollectionId !== null) {
          filter.collectionId = currentCollectionId;
        }
        if (searchTerm) {
          filter.searchTerm = searchTerm;
        }
      }
      return getImages(filter);
    },
    [currentCollectionId, searchTerm, refreshKey, reviewDuplicatesMode], // Dependencies
    [] // Initial value
  );

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    if (reviewDuplicatesMode && term) setReviewDuplicatesMode(false); // Exit review mode if searching
  }, [reviewDuplicatesMode]);

  const handleCollectionSelect = useCallback((collectionId: number | null) => {
    setCurrentCollectionId(collectionId);
    if (reviewDuplicatesMode && collectionId !== null) setReviewDuplicatesMode(false); // Exit review mode if selecting collection
  }, [reviewDuplicatesMode]);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey(prev => prev + 1); 
  }, []);
  
  const handleImageUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const toggleReviewDuplicatesMode = useCallback(() => {
    setReviewDuplicatesMode(prev => {
      const newMode = !prev;
      if (newMode) {
        // When entering review mode, clear other filters
        setCurrentCollectionId(null);
        setSearchTerm('');
      }
      return newMode;
    });
  }, []);

  if (images === undefined) { 
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
      onToggleReviewDuplicates={toggleReviewDuplicatesMode}
      isReviewDuplicatesMode={reviewDuplicatesMode}
    >
      <ImageGrid 
        images={images} 
        onUpdate={handleImageUpdate} 
        isReviewDuplicatesMode={reviewDuplicatesMode} 
      />
    </AppLayout>
  );
}

