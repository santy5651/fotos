
"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Tag } from 'lucide-react';
import { getAllUniqueTags } from '@/lib/db';

interface TagExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagSelectAndClose: (tag: string) => void; // New prop
}

export default function TagExplorerModal({ isOpen, onClose, onTagSelectAndClose }: TagExplorerModalProps) {
  const [tags, setTags] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const fetchTags = async () => {
        try {
          const uniqueTags = await getAllUniqueTags();
          setTags(uniqueTags);
        } catch (error) {
          console.error("Failed to fetch unique tags:", error);
          setTags([]); // Set to empty array on error
        } finally {
          setIsLoading(false);
        }
      };
      fetchTags();
    }
  }, [isOpen]);

  const handleTagClick = (tag: string) => {
    onTagSelectAndClose(tag);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Tag className="mr-2 h-5 w-5" />
            All Tags
          </DialogTitle>
          <DialogDescription>Select a tag to filter images.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] my-4 border rounded-md p-4">
            {tags && tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-sm px-3 py-1 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleTagClick(tag)}
                    title={`Filter by tag: ${tag}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No tags found.</p>
            )}
          </ScrollArea>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
