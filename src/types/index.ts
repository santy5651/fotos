
export interface ImageMetadata {
  id?: number; // Auto-incremented by IndexedDB
  name: string; // Original file name
  file: File; // The actual image file/blob. May not be present in lightweight queries.
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
  transform?: { 
    rotate: number; // degrees
  };
  isPotentialDuplicate?: boolean; // Flag for potential duplicates based on filename
  hasTags?: boolean; // True if tags array is not empty, for easier querying
  description?: string; // Detailed textual description of the image
  hasDescription?: boolean; // True if description field is not empty
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
