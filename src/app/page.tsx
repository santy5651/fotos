
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
  const [showUnassignedMode, setShowUnassignedMode] = useState<boolean>(false); // New state
  const [refreshKey, setRefreshKey] = useState(0);

  const images = useLiveQuery(
    async () => {
      const filter: any = { 
        reviewDuplicates: reviewDuplicatesMode,
        showUnassigned: showUnassignedMode 
      };
      // Only apply collectionId if not in reviewDuplicates or showUnassigned mode
      if (!reviewDuplicatesMode && !showUnassignedMode && currentCollectionId !== null) {
        filter.collectionId = currentCollectionId;
      }
      // searchTerm is applied universally by getImages after initial filtering
      if (searchTerm) {
        filter.searchTerm = searchTerm;
      }
      return getImages(filter);
    },
    [currentCollectionId, searchTerm, refreshKey, reviewDuplicatesMode, showUnassignedMode],
    []
  );

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    // Searching should ideally not automatically exit special modes, 
    // as the user might want to search within "Review Duplicates" or "Unassigned"
  }, []);

  const handleCollectionSelect = useCallback((collectionId: number | null) => {
    setCurrentCollectionId(collectionId);
    if (reviewDuplicatesMode) setReviewDuplicatesMode(false);
    if (showUnassignedMode) setShowUnassignedMode(false);
  }, [reviewDuplicatesMode, showUnassignedMode]);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey(prev => prev + 1); 
  }, []);
  
  const handleImageUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const toggleReviewDuplicatesMode = useCallback(() => {
    const newMode = !reviewDuplicatesMode;
    setReviewDuplicatesMode(newMode);
    if (newMode) {
      setCurrentCollectionId(null);
      // setSearchTerm(''); // Keep search term if user wants to search within duplicates
      setShowUnassignedMode(false); 
    }
  }, [reviewDuplicatesMode]);

  const toggleShowUnassignedMode = useCallback(() => { // New handler
    const newMode = !showUnassignedMode;
    setShowUnassignedMode(newMode);
    if (newMode) {
      setCurrentCollectionId(null);
      // setSearchTerm(''); // Keep search term if user wants to search within unassigned
      setReviewDuplicatesMode(false);
    }
  }, [showUnassignedMode]);


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
      onToggleShowUnassigned={toggleShowUnassignedMode} // Pass new handler
      isShowUnassignedMode={showUnassignedMode} // Pass new state
    >
      <ImageGrid 
        images={images} 
        onUpdate={handleImageUpdate} 
        isReviewDuplicatesMode={reviewDuplicatesMode} 
        isShowUnassignedMode={showUnassignedMode}
      />
    </AppLayout>
  );
}
