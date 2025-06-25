
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import AppLayout from '@/components/layout/AppLayout';
import ImageGrid from '@/components/image/ImageGrid';
import { db, getImages, getImageById, updateImage, blobToDataURL } from '@/lib/db';
import type { ImageMetadata } from '@/types';
import { Loader2, CheckSquare, Square, FolderPlus, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BulkAddToCollectionDialog from '@/components/collections/BulkAddToCollectionDialog';
import { useToast } from "@/hooks/use-toast";
import { processImage } from '@/ai/flows/process-image-flow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';

const ITEMS_PER_PAGE_OPTIONS = [2, 4, 6, 8, 10, 12, 20, 24, 50];
const NUM_COLUMNS_OPTIONS = [2, 3, 4, 5, 6];

export default function HomePage() {
  const { toast, dismiss } = useToast();
  const [currentCollectionId, setCurrentCollectionId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [reviewDuplicatesMode, setReviewDuplicatesMode] = useState<boolean>(false);
  const [showUnassignedMode, setShowUnassignedMode] = useState<boolean>(false);
  const [showUntaggedMode, setShowUntaggedMode] = useState<boolean>(false);
  const [showUndescribedMode, setShowUndescribedMode] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set());
  const [isBulkAddToCollectionDialogOpen, setIsBulkAddToCollectionDialogOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Pagination and Layout States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4); // Default to 4
  const [numberOfColumns, setNumberOfColumns] = useState(NUM_COLUMNS_OPTIONS[2]); // Default to 4
  const [totalImagesForPagination, setTotalImagesForPagination] = useState(0);

  const queryResult = useLiveQuery(
    async () => {
      const filter: any = {
        reviewDuplicates: reviewDuplicatesMode,
        showUnassigned: showUnassignedMode,
        showUntagged: showUntaggedMode,
        showUndescribed: showUndescribedMode,
        offset: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
      };
      if (!reviewDuplicatesMode && !showUnassignedMode && !showUntaggedMode && !showUndescribedMode && currentCollectionId !== null) {
        filter.collectionId = currentCollectionId;
      }
      if (searchTerm) {
        filter.searchTerm = searchTerm;
      }
      const result = await getImages(filter);
      setTotalImagesForPagination(result.totalCount);
      return result.images;
    },
    [currentCollectionId, searchTerm, refreshKey, reviewDuplicatesMode, showUnassignedMode, showUntaggedMode, showUndescribedMode, currentPage, itemsPerPage],
    []
  );
  const images = queryResult; 

  const resetPaginationAndSelection = () => {
    setCurrentPage(1);
    setSelectedImageIds(new Set());
  }

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    resetPaginationAndSelection();
  }, []);

  const handleCollectionSelect = useCallback((collectionId: number | null) => {
    setCurrentCollectionId(collectionId);
    if (reviewDuplicatesMode) setReviewDuplicatesMode(false);
    if (showUnassignedMode) setShowUnassignedMode(false);
    if (showUntaggedMode) setShowUntaggedMode(false);
    if (showUndescribedMode) setShowUndescribedMode(false);
    setSearchTerm('');
    resetPaginationAndSelection();
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
    resetPaginationAndSelection();
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
    resetPaginationAndSelection();
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
    resetPaginationAndSelection();
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
    resetPaginationAndSelection();
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

  const handleSelectAllImagesOnPage = useCallback(() => {
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

  const handleBulkProcess = async () => {
    if (selectedImageIds.size === 0) {
      toast({ variant: "destructive", title: "Sin Selección", description: "No hay imágenes seleccionadas para procesar." });
      return;
    }

    setIsBulkProcessing(true);
    const imageIdArray = Array.from(selectedImageIds);
    let successCount = 0;
    let errorCount = 0;
    const totalToProcess = imageIdArray.length;
    let processedCount = 0;
    
    const progressToastId = 'bulk-process-progress';
    toast({
      id: progressToastId,
      title: "Procesando con IA...",
      description: `0 de ${totalToProcess} imágenes procesadas.`,
      duration: Infinity, 
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

        const dataUri = await blobToDataURL(image.file, { defaultMimeTypeIfGeneric: 'image/png' });
        
        let aiResult;
        try {
          aiResult = await processImage({ photoDataUri: dataUri });
        } catch (error) {
          const errorMessage = (error as Error).message;
          const isServiceUnavailableError = errorMessage.includes('503') || errorMessage.toLowerCase().includes('service unavailable');
          if (isServiceUnavailableError) {
            toast({
              id: progressToastId,
              title: "Servicio no disponible",
              description: `Reintentando en 30 segundos para la imagen ID ${imageId}...`,
              duration: 30000,
            });
            await new Promise(resolve => setTimeout(resolve, 30000));
            aiResult = await processImage({ photoDataUri: dataUri });
          } else {
            throw error;
          }
        }
        
        await updateImage(imageId, { 
            tags: aiResult.tags, 
            hasTags: aiResult.tags.length > 0,
            description: aiResult.description,
            hasDescription: aiResult.description.trim() !== ""
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Error procesando imagen ID ${imageId}:`, error);
        const errorMessage = (error as Error).message;
        const isRateLimitError = errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota');
        const isServiceUnavailableError = errorMessage.includes('503') || errorMessage.toLowerCase().includes('service unavailable');

        if (isRateLimitError) {
          toast({
            variant: "destructive",
            title: "Límite de API Alcanzado",
            description: `El proceso se ha detenido por límite de cuota. ${successCount} imágenes procesadas. Intenta de nuevo más tarde.`,
            duration: 8000,
          });
          errorCount--; 
          break; // Stop the loop
        }
        
        if (isServiceUnavailableError) {
          toast({
            variant: "destructive",
            title: "Servicio de IA No Disponible",
            description: `El servicio de IA sigue sin estar disponible tras un reintento. El proceso se detuvo. ${successCount} imágenes procesadas.`,
            duration: 8000,
          });
          errorCount--; 
          break; // Stop the loop
        }

        toast({
          variant: "destructive",
          title: "Fallo al Procesar con IA",
          description: `No se pudo procesar la imagen ID ${imageId}. ${errorMessage}`
        });
      }
      toast({ 
        id: progressToastId,
        title: "Procesando con IA...",
        description: `${processedCount} de ${totalToProcess} imágenes procesadas.`,
        duration: Infinity,
      });
    }

    dismiss(progressToastId); 
    toast({
      title: "Procesamiento en Lote Finalizado",
      description: `${successCount} imágenes procesadas. ${errorCount > 0 ? `${errorCount} fallaron.` : ''}`,
      duration: 5000,
    });

    setIsBulkProcessing(false);
    handleImageUpdate();
    handleDeselectAllImages();
  };

  // Pagination handlers
  const totalPages = Math.ceil(totalImagesForPagination / itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      setSelectedImageIds(new Set());
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setSelectedImageIds(new Set());
    }
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value, 10));
    setCurrentPage(1); 
    setSelectedImageIds(new Set());
  };

  const handleNumberOfColumnsChange = (value: string) => {
    setNumberOfColumns(parseInt(value, 10));
  };
  
  const firstItemOnPage = totalImagesForPagination > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const lastItemOnPage = Math.min(currentPage * itemsPerPage, totalImagesForPagination);


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
              <Button variant="outline" size="sm" onClick={handleSelectAllImagesOnPage} disabled={isBulkProcessing}>
                <CheckSquare className="mr-2 h-4 w-4" /> Seleccionar Página
              </Button>
            )}
            {selectedImageIds.size > 0 && (
              <Button variant="outline" size="sm" onClick={handleDeselectAllImages} disabled={isBulkProcessing}>
                <Square className="mr-2 h-4 w-4" /> Deseleccionar Todo
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleOpenBulkAddToCollectionDialog} disabled={isBulkProcessing}>
              <FolderPlus className="mr-2 h-4 w-4" /> Añadir a Colección
            </Button>
            <Button variant="default" size="sm" onClick={handleBulkProcess} disabled={isBulkProcessing}>
              {isBulkProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generar Etiquetas y Descripción
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 px-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="items-per-page-select" className="text-sm whitespace-nowrap">Imágenes por página:</Label>
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger id="items-per-page-select" className="h-9 w-[80px]">
                <SelectValue placeholder="Número" />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt.toString()}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="num-columns-select" className="text-sm whitespace-nowrap">Columnas:</Label>
            <Select value={numberOfColumns.toString()} onValueChange={handleNumberOfColumnsChange}>
              <SelectTrigger id="num-columns-select" className="h-9 w-[70px]">
                <SelectValue placeholder="Número" />
              </SelectTrigger>
              <SelectContent>
                {NUM_COLUMNS_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt.toString()}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {totalImagesForPagination > 0 && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Página {currentPage} de {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      {totalImagesForPagination > 0 && (
        <div className="text-sm text-muted-foreground py-1 px-1 text-center mb-2">
          Mostrando {firstItemOnPage} - {lastItemOnPage} de {totalImagesForPagination} imagen{totalImagesForPagination === 1 ? '' : 'es'}.
        </div>
      )}
      
      <ImageGrid
        images={images || []}
        onUpdate={handleImageUpdate}
        isReviewDuplicatesMode={reviewDuplicatesMode}
        isShowUnassignedMode={showUnassignedMode}
        isShowUntaggedMode={showUntaggedMode}
        isShowUndescribedMode={showUndescribedMode}
        selectedImageIds={selectedImageIds}
        onImageToggleSelection={handleToggleImageSelection}
        searchTerm={searchTerm}
        numberOfColumns={numberOfColumns} 
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
