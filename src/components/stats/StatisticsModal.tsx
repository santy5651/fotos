"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getTotalImageCount, getImagesPerCollection } from '@/lib/db';
import CollectionImagesChart from './CollectionImagesChart'; // Will create this
import { Loader2 } from 'lucide-react';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChartData {
  name: string;
  count: number;
}

export default function StatisticsModal({ isOpen, onClose }: StatisticsModalProps) {
  const [totalImages, setTotalImages] = useState<number | null>(null);
  const [imagesPerCollection, setImagesPerCollection] = useState<ChartData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const fetchData = async () => {
        try {
          const total = await getTotalImageCount();
          const perCollection = await getImagesPerCollection();
          setTotalImages(total);
          setImagesPerCollection(perCollection.map(item => ({ name: item.name, count: item.count })));
        } catch (error) {
          console.error("Failed to fetch stats:", error);
          // Handle error display if needed
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Application Statistics</DialogTitle>
          <DialogDescription>Overview of your image library.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="text-lg">
              <strong>Total Images:</strong> {totalImages ?? 'N/A'}
            </div>
            {imagesPerCollection && imagesPerCollection.length > 0 ? (
              <div>
                <h3 className="text-md font-semibold mb-2">Images per Collection:</h3>
                <div className="h-[300px] w-full">
                  <CollectionImagesChart data={imagesPerCollection} />
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No images found in any collections for chart.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
