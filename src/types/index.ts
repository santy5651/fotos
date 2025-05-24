
export interface ImageMetadata {
  id?: number; // Auto-incremented by IndexedDB
  name: string; // Original file name
  file: File; // The actual image file/blob
  tags: string[];
  width: number;
  height: number;
  isFavorite: boolean;
  isProtected: boolean;
  createdAt: Date;
  mimeType: string;
  syncStatus: 'local' | 'pending' | 'synced'; // For future use
  collectionIds: number[]; // IDs of collections this image belongs to
  dataUri?: string; // Temporary data URI for AI processing or display
  transform?: { // For visual transformations on image card - transient for now
    rotate: number; // degrees
  };
}

export interface Collection {
  id?: number; // Auto-incremented by IndexedDB
  name: string;
  parentId: number | null; // For hierarchical collections
  createdAt: Date;
  // For quick UI updates, not stored in DB directly or derived
  imageCount?: number; 
  children?: Collection[]; 
}
