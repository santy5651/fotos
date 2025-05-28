
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import AppLayout from '@/components/layout/AppLayout';
import ImageGrid from '@/components/image/ImageGrid';
import { db, getImages, getImageById, updateImage, blobToDataURL } from '@/lib/db';
import type { ImageMetadata } from '@/types';
import { Loader2, CheckSquare, Square, FolderPlus, FileText } from 'lucide-react'; // Added FileText
import { Button } from '@/components/ui/button';
import BulkAddToCollectionDialog from '@/components/collections/BulkAddToCollectionDialog';
import { useToast } from "@/hooks/use-toast";
import { describeImage } from '@/ai/flows/describe-image-flow';

export default function HomePage() {
  const { toast } = useToast();
  const [currentCollectionId, setCurrentCollectionId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [reviewDuplicatesMode, setReviewDuplicatesMode] = useState<boolean>(false);
  const [showUnassignedMode, setShowUnassignedMode] = useState<boolean>(false);
  const [showUntaggedMode, setShowUntaggedMode] = useState<boolean>(false);
  const [showUndescribedMode, setShowUndescribedMode] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set());
  const [isBulkAddToCollectionDialogOpen, setIsBulkAddToCollectionDialogOpen] = useState(false);
  const [isBulkDescribing, setIsBulkDescribing] = useState(false); // New state for bulk description generation

  const images = useLiveQuery(
    async () => {
      const filter: any = {
        reviewDuplicates: reviewDuplicatesMode,
        showUnassigned: showUnassignedMode,
        showUntagged: showUntaggedMode,
        showUndescribed: showUndescribedMode,
      };
      if (!reviewDuplicatesMode && !showUnassignedMode && !showUntaggedMode && !showUndescribedMode && currentCollectionId !== null) {
        filter.collectionId = currentCollectionId;
      }
      if (searchTerm) {
        filter.searchTerm = searchTerm;
      }
      return getImages(filter);
    },
    [currentCollectionId, searchTerm, refreshKey, reviewDuplicatesMode, showUnassignedMode, showUntaggedMode, showUndescribedMode],
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
    if (showUntaggedMode) setShowUntaggedMode(false);
    if (showUndescribedMode) setShowUndescribedMode(false);
    setSearchTerm(''); 
    setSelectedImageIds(new Set()); 
  }, [reviewDuplicatesMode, showUnassignedMode, showUntaggedMode, showUndescribedMode]);

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
      setShowUntaggedMode(false);
      setShowUndescribedMode(false);
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
      setShowUntaggedMode(false);
      setShowUndescribedMode(false);
      setSearchTerm(''); 
    }
    setSelectedImageIds(new Set()); 
  }, [showUnassignedMode]);

  const toggleShowUntaggedMode = useCallback(() => {
    const newMode = !showUntaggedMode;
    setShowUntaggedMode(newMode);
    if (newMode) {
      setCurrentCollectionId(null);
      setReviewDuplicatesMode(false);
      setShowUnassignedMode(false);
      setShowUndescribedMode(false);
      setSearchTerm('');
    }
    setSelectedImageIds(new Set());
  }, [showUntaggedMode]);

  const toggleShowUndescribedMode = useCallback(() => {
    const newMode = !showUndescribedMode;
    setShowUndescribedMode(newMode);
    if (newMode) {
      setCurrentCollectionId(null);
      setReviewDuplicatesMode(false);
      setShowUnassignedMode(false);
      setShowUntaggedMode(false);
      setSearchTerm('');
    }
    setSelectedImageIds(new Set());
  }, [showUndescribedMode]);


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

  const handleBulkGenerateDescriptions = async () => {
    if (selectedImageIds.size === 0) {
      toast({ variant: "destructive", title: "Sin Selección", description: "No hay imágenes seleccionadas para generar descripciones." });
      return;
    }

    setIsBulkDescribing(true);
    const imageIdArray = Array.from(selectedImageIds);
    let successCount = 0;
    let errorCount = 0;
    const totalToProcess = imageIdArray.length;
    let processedCount = 0;
    
    const progressToastId = 'bulk-describe-progress';
    toast({
      id: progressToastId,
      title: "Procesando Descripciones...",
      description: `0 de ${totalToProcess} imágenes procesadas.`,
      duration: Infinity, // Keep toast until dismissed or updated
    });

    for (const imageId of imageIdArray) {
      processedCount++;
      try {
        const image = await getImageById(imageId);
        if (!image || !image.file) {
          toast({ variant: "destructive", title: "Error", description: `No se encontró la imagen con ID ${imageId} o falta el archivo.` });
          errorCount++;
          continue;
        }

        const dataUri = await blobToDataURL(image.file);
        const aiResult = await describeImage({ photoDataUri: dataUri });
        await updateImage(imageId, { description: aiResult.description, hasDescription: aiResult.description.trim() !== "" });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Error generando descripción para imagen ID ${imageId}:`, error);
        toast({
          variant: "destructive",
          title: "Fallo al Generar Descripción",
          description: `No se pudo generar descripción para la imagen ID ${imageId}. ${ (error as Error).message.includes('429') ? 'Límite de API alcanzado.' : (error as Error).message }`
        });
      }
      toast({ // Update progress toast
        id: progressToastId,
        title: "Procesando Descripciones...",
        description: `${processedCount} de ${totalToProcess} imágenes procesadas.`,
      });
    }

    toast.dismiss(progressToastId); // Dismiss progress toast
    toast({
      title: "Generación en Lote Finalizada",
      description: `${successCount} descripciones generadas. ${errorCount > 0 ? `${errorCount} fallaron.` : ''}`,
      duration: 5000,
    });

    setIsBulkDescribing(false);
    handleImageUpdate();
    handleDeselectAllImages();
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
      onToggleShowUntagged={toggleShowUntaggedMode}
      isShowUntaggedMode={showUntaggedMode}
      onToggleShowUndescribed={toggleShowUndescribedMode}
      isShowUndescribedMode={showUndescribedMode}
    >
      {selectedImageIds.size > 0 && (
        <div className="sticky top-0 z-[5] bg-background/80 backdrop-blur-sm p-2 mb-2 border-b rounded-md shadow-sm flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {selectedImageIds.size} imagen{selectedImageIds.size === 1 ? '' : 'es'} seleccionada{selectedImageIds.size === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {images && selectedImageIds.size !== images.length && (
              <Button variant="outline" size="sm" onClick={handleSelectAllImages} disabled={isBulkDescribing}>
                <CheckSquare className="mr-2 h-4 w-4" /> Seleccionar Todo
              </Button>
            )}
            {selectedImageIds.size > 0 && (
              <Button variant="outline" size="sm" onClick={handleDeselectAllImages} disabled={isBulkDescribing}>
                <Square className="mr-2 h-4 w-4" /> Deseleccionar Todo
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleOpenBulkAddToCollectionDialog} disabled={isBulkDescribing}>
              <FolderPlus className="mr-2 h-4 w-4" /> Añadir a Colección
            </Button>
            <Button variant="default" size="sm" onClick={handleBulkGenerateDescriptions} disabled={isBulkDescribing}>
              {isBulkDescribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generar Descripciones
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
        isShowUntaggedMode={showUntaggedMode}
        isShowUndescribedMode={showUndescribedMode}
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
    
