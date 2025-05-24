import Dexie, { type Table } from 'dexie';
import type { ImageMetadata, Collection } from '@/types';

export class PicStackDexie extends Dexie {
  images!: Table<ImageMetadata, number>;
  collections!: Table<Collection, number>;

  constructor() {
    super('PicStackDB');
    this.version(2).stores({
      images: '++id, name, *tags, createdAt, isFavorite, *collectionIds, mimeType',
      collections: '++id, name, parentId, createdAt',
    });
    // Upgrade from version 1 (if it existed with a different schema)
    this.version(1).stores({
      images: '++id, name, *tags, createdAt, isFavorite, *collectionIds',
      collections: '++id, name, parentId, createdAt',
    }).upgrade(tx => {
      // Example upgrade path if schema changed. For new fields, Dexie handles it if they are optional or have defaults.
      // If a field was mandatory and added, an upgrade function would be needed.
      // For mimeType on images, if it's newly added and mandatory, we might need to update existing records.
      // However, since 'file' object would contain mimeType, it's likely derived on add.
      // If 'syncStatus' was added, it would need a default.
      // For this version bump from theoretical v1 to v2, if 'mimeType' was added to 'images' index:
      // tx.table('images').toCollection().modify(image => {
      //   if (!image.mimeType && image.file) {
      //     image.mimeType = image.file.type;
      //   }
      //   if (!image.syncStatus) {
      //      image.syncStatus = 'local';
      //   }
      // });
    });
  }
}

export const db = new PicStackDexie();

// Image CRUD
export const addImage = async (image: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus'>): Promise<number> => {
  const newImage: ImageMetadata = {
    ...image,
    createdAt: new Date(),
    syncStatus: 'local',
    collectionIds: image.collectionIds || [],
  };
  return db.images.add(newImage);
};

export const getImages = async (filter?: { collectionId?: number; searchTerm?: string }): Promise<ImageMetadata[]> => {
  let query = db.images.orderBy('createdAt').reverse();

  if (filter?.collectionId) {
    query = query.filter(img => img.collectionIds.includes(filter.collectionId!));
  }
  
  if (filter?.searchTerm) {
    const term = filter.searchTerm.toLowerCase();
    query = query.filter(img => 
      img.name.toLowerCase().includes(term) || 
      img.tags.some(tag => tag.toLowerCase().includes(term))
    );
  }
  
  return query.toArray();
};

export const getImageById = async (id: number): Promise<ImageMetadata | undefined> => {
  return db.images.get(id);
};

export const updateImage = async (id: number, changes: Partial<ImageMetadata>): Promise<number> => {
  return db.images.update(id, changes);
};

export const deleteImage = async (id: number): Promise<void> => {
  const image = await db.images.get(id);
  if (image && image.isProtected) {
    throw new Error("Image is protected and cannot be deleted.");
  }
  return db.images.delete(id);
};

// Collection CRUD
export const addCollection = async (collection: Omit<Collection, 'id' | 'createdAt'>): Promise<number> => {
  const newCollection: Collection = {
    ...collection,
    createdAt: new Date(),
  };
  return db.collections.add(newCollection);
};

export const getCollections = async (): Promise<Collection[]> => {
  return db.collections.orderBy('name').toArray();
};

// Helper to build collection hierarchy
export const getHierarchicalCollections = async (): Promise<Collection[]> => {
  const allCollections = await db.collections.orderBy('name').toArray();
  const collectionsMap = new Map<number, Collection>();
  const rootCollections: Collection[] = [];

  allCollections.forEach(collection => {
    collection.children = [];
    collectionsMap.set(collection.id!, collection);
  });

  allCollections.forEach(collection => {
    if (collection.parentId && collectionsMap.has(collection.parentId)) {
      collectionsMap.get(collection.parentId)!.children!.push(collection);
    } else {
      rootCollections.push(collection);
    }
  });
  return rootCollections;
};


export const getCollectionById = async (id: number): Promise<Collection | undefined> => {
  return db.collections.get(id);
};

export const updateCollection = async (id: number, changes: Partial<Collection>): Promise<number> => {
  return db.collections.update(id, changes);
};

export const deleteCollection = async (id: number): Promise<void> => {
  // Check if collection contains images
  const imagesInCollection = await db.images.where('collectionIds').equals(id).count();
  if (imagesInCollection > 0) {
    throw new Error("Collection is not empty. Remove images before deleting.");
  }
  // Check for sub-collections
  const subCollections = await db.collections.where('parentId').equals(id).count();
  if (subCollections > 0) {
    throw new Error("Collection has sub-collections. Delete them first or implement cascade delete.");
  }
  return db.collections.delete(id);
};

// Add/Remove image from collection
export const addImageToCollection = async (imageId: number, collectionId: number): Promise<void> => {
  const image = await db.images.get(imageId);
  if (image) {
    if (!image.collectionIds.includes(collectionId)) {
      await db.images.update(imageId, { collectionIds: [...image.collectionIds, collectionId] });
    }
  }
};

export const removeImageFromCollection = async (imageId: number, collectionId: number): Promise<void> => {
  const image = await db.images.get(imageId);
  if (image) {
    await db.images.update(imageId, { collectionIds: image.collectionIds.filter(id => id !== collectionId) });
  }
};

// Data Management
export const exportData = async (): Promise<{ metadataJson: string, imageFiles: { name: string, blob: Blob }[] }> => {
  const images = await db.images.toArray();
  const collections = await db.collections.toArray();

  const metadata = {
    version: 1,
    collections,
    images: images.map(img => {
      const { file, ...rest } = img; // Exclude file blob from metadata JSON
      return { ...rest, originalName: img.name, fileNameInZip: `img_${img.id}_${img.name}` };
    }),
  };
  
  const imageFiles = images.map(img => ({
    name: `img_${img.id}_${img.name}`,
    blob: img.file
  }));

  return { metadataJson: JSON.stringify(metadata, null, 2), imageFiles };
};

// Import data (simplified: expects user to provide JSON and then files separately matching names)
export const importData = async (metadataJson: string, files: File[]): Promise<string[]> => {
  const warnings: string[] = [];
  const { collections: importedCollections, images: importedImagesMetadata } = JSON.parse(metadataJson);

  await db.transaction('rw', db.collections, db.images, async () => {
    // Clear existing data (or implement merge strategy)
    // await db.collections.clear();
    // await db.images.clear();
    // For now, we assume IDs might clash if not careful. This is a simplified import.
    // A real import would need ID mapping or conflict resolution.

    for (const coll of importedCollections) {
      const {id, ...rest} = coll; // Don't try to force imported ID if it's auto-incrementing
      try {
        await db.collections.add(rest as Collection);
      } catch (e) {
        warnings.push(`Failed to import collection ${coll.name}: ${(e as Error).message}`);
      }
    }

    const filesMap = new Map(files.map(f => [f.name, f]));

    for (const imgMeta of importedImagesMetadata) {
      const { id, file, fileNameInZip, originalName, ...restMeta } = imgMeta;
      const imageFile = filesMap.get(fileNameInZip) || filesMap.get(originalName);

      if (imageFile) {
        const imageToAdd: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus'> = {
          ...restMeta,
          name: originalName || imageFile.name,
          file: imageFile,
          mimeType: imageFile.type,
          // collectionIds might need mapping if collection IDs changed on import
        };
        try {
          await addImage(imageToAdd);
        } catch (e) {
          warnings.push(`Failed to import image ${originalName}: ${(e as Error).message}`);
        }
      } else {
        warnings.push(`Image file not found for ${originalName} (expected ${fileNameInZip || originalName})`);
      }
    }
  });
  return warnings;
};


export const deleteAllData = async (): Promise<void> => {
  await db.transaction('rw', db.images, db.collections, async () => {
    await db.images.clear();
    await db.collections.clear();
  });
};

// Stats
export const getTotalImageCount = async (): Promise<number> => {
  return db.images.count();
};

export const getImagesPerCollection = async (): Promise<{ name: string, count: number }[]> => {
  const collections = await db.collections.toArray();
  const counts = await Promise.all(
    collections.map(async (collection) => {
      const count = await db.images.where('collectionIds').equals(collection.id!).count();
      return { name: collection.name, count };
    })
  );
  return counts.filter(c => c.count > 0);
};

// Utility to convert blob to data URI for AI processing
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
