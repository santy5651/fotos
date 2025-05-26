
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import AppLayout from '@/components/layout/AppLayout';
import ImageGrid from '@/components/image/ImageGrid';
import { db, getImages } from '@/lib/db';
import type { ImageMetadata } from '@/types';
import { Loader2, CheckSquare, Square, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BulkAddToCollectionDialog from '@/components/collections/BulkAddToCollectionDialog';

export default function HomePage() {
  const [currentCollectionId, setCurrentCollectionId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [reviewDuplicatesMode, setReviewDuplicatesMode] = useState<boolean>(false);
  const [showUnassignedMode, setShowUnassignedMode] = useState<boolean>(false);
  const [showUntaggedMode, setShowUntaggedMode] = useState<boolean>(false); // New state
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set());
  const [isBulkAddToCollectionDialogOpen, setIsBulkAddToCollectionDialogOpen] = useState(false);

  const images = useLiveQuery(
    async () => {
      const filter: any = {
        reviewDuplicates: reviewDuplicatesMode,
        showUnassigned: showUnassignedMode,
        showUntagged: showUntaggedMode, // Pass new filter
      };
      if (!reviewDuplicatesMode && !showUnassignedMode && !showUntaggedMode && currentCollectionId !== null) {
        filter.collectionId = currentCollectionId;
      }
      if (searchTerm) {
        filter.searchTerm = searchTerm;
      }
      return getImages(filter);
    },
    [currentCollectionId, searchTerm, refreshKey, reviewDuplicatesMode, showUnassignedMode, showUntaggedMode], // Add showUntaggedMode to dependencies
    []
  );

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setSelectedImageIds(new Set()); 
  }, []);

  const handleCollectionSelect = useCallback((collectionId: number | null) => {
    setCurrentCollectionId(collectionId);
    if (reviewDuplicatesMode) setReviewDuplicatesMode(false);
    if (showUnassignedMode) setShowUnassignedMode(false);
    if (showUntaggedMode) setShowUntaggedMode(false); // Deactivate untagged mode
    setSearchTerm(''); 
    setSelectedImageIds(new Set()); 
  }, [reviewDuplicatesMode, showUnassignedMode, showUntaggedMode]);

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
      setShowUnassignedMode(false);
      setShowUntaggedMode(false); // Deactivate untagged mode
      setSearchTerm(''); 
    }
    setSelectedImageIds(new Set()); 
  }, [reviewDuplicatesMode]);

  const toggleShowUnassignedMode = useCallback(() => {
    const newMode = !showUnassignedMode;
    setShowUnassignedMode(newMode);
    if (newMode) {
      setCurrentCollectionId(null);
      setReviewDuplicatesMode(false);
      setShowUntaggedMode(false); // Deactivate untagged mode
      setSearchTerm(''); 
    }
    setSelectedImageIds(new Set()); 
  }, [showUnassignedMode]);

  const toggleShowUntaggedMode = useCallback(() => { // New handler
    const newMode = !showUntaggedMode;
    setShowUntaggedMode(newMode);
    if (newMode) {
      setCurrentCollectionId(null);
      setReviewDuplicatesMode(false);
      setShowUnassignedMode(false);
      setSearchTerm('');
    }
    setSelectedImageIds(new Set());
  }, [showUntaggedMode]);


  const handleToggleImageSelection = useCallback((imageId: number) => {
    setSelectedImageIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(imageId)) {
        newSelectedIds.delete(imageId);
      } else {
        newSelectedIds.add(imageId);
      }
      return newSelectedIds;
    });
  }, []);

  const handleSelectAllImages = useCallback(() => {
    if (images) {
      setSelectedImageIds(new Set(images.map(img => img.id!)));
    }
  }, [images]);

  const handleDeselectAllImages = useCallback(() => {
    setSelectedImageIds(new Set());
  }, []);
  
  const handleOpenBulkAddToCollectionDialog = () => {
    if (selectedImageIds.size > 0) {
      setIsBulkAddToCollectionDialogOpen(true);
    }
  };


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
      onToggleShowUnassigned={toggleShowUnassignedMode}
      isShowUnassignedMode={showUnassignedMode}
      onToggleShowUntagged={toggleShowUntaggedMode} // Pass new prop
      isShowUntaggedMode={showUntaggedMode} // Pass new prop
    >
      {selectedImageIds.size > 0 && (
        <div className="sticky top-0 z-[5] bg-background/80 backdrop-blur-sm p-2 mb-2 border-b rounded-md shadow-sm flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {selectedImageIds.size} imagen{selectedImageIds.size === 1 ? '' : 'es'} seleccionada{selectedImageIds.size === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            {images && selectedImageIds.size !== images.length && (
              <Button variant="outline" size="sm" onClick={handleSelectAllImages}>
                <CheckSquare className="mr-2 h-4 w-4" /> Seleccionar Todo
              </Button>
            )}
            {selectedImageIds.size > 0 && (
              <Button variant="outline" size="sm" onClick={handleDeselectAllImages}>
                <Square className="mr-2 h-4 w-4" /> Deseleccionar Todo
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleOpenBulkAddToCollectionDialog}>
              <FolderPlus className="mr-2 h-4 w-4" /> Añadir a Colección
            </Button>
          </div>
        </div>
      )}

      {images && images.length > 0 && (
        <div className="text-sm text-muted-foreground py-1 px-1 text-center mb-2">
          {images.length} imagen{images.length === 1 ? '' : 'es'} en la vista actual.
        </div>
      )}
      
      <ImageGrid
        images={images}
        onUpdate={handleImageUpdate}
        isReviewDuplicatesMode={reviewDuplicatesMode}
        isShowUnassignedMode={showUnassignedMode}
        isShowUntaggedMode={showUntaggedMode} // Pass new prop
        selectedImageIds={selectedImageIds}
        onImageToggleSelection={handleToggleImageSelection}
        searchTerm={searchTerm} 
      />
      {isBulkAddToCollectionDialogOpen && (
        <BulkAddToCollectionDialog
          imageIds={Array.from(selectedImageIds)}
          isOpen={isBulkAddToCollectionDialogOpen}
          onClose={() => setIsBulkAddToCollectionDialogOpen(false)}
          onBulkUpdateCollections={() => {
            handleImageUpdate(); 
            handleDeselectAllImages(); 
          }}
        />
      )}
    </AppLayout>
  );
}
