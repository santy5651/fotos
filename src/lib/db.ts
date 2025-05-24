
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
      // Example upgrade path, not strictly needed if new fields are optional
    });
  }
}

export const db = new PicStackDexie();

// Image CRUD
export const addImage = async (image: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus'> & { createdAt?: Date, syncStatus?: ImageMetadata['syncStatus'] }): Promise<number> => {
  const newImage: ImageMetadata = {
    ...image,
    id: undefined, 
    createdAt: image.createdAt || new Date(),
    syncStatus: image.syncStatus || 'local',
    collectionIds: image.collectionIds || [],
    file: image.file, 
  };
  return db.images.add(newImage as ImageMetadata);
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
      (img.tags && img.tags.some(tag => tag.toLowerCase().includes(term)))
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
export const addCollection = async (collection: Omit<Collection, 'id' | 'createdAt'> & { createdAt?: Date }): Promise<number> => {
  const newCollection: Collection = {
    ...collection,
    id: undefined, 
    createdAt: collection.createdAt || new Date(),
  };
  return db.collections.add(newCollection);
};

export const getCollections = async (): Promise<Collection[]> => {
  return db.collections.orderBy('name').toArray();
};

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
      const parentCollection = collectionsMap.get(collection.parentId)!;
      if (!parentCollection.children) {
        parentCollection.children = [];
      }
      parentCollection.children.push(collection);
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
  const imagesToUpdate = await db.images.where('collectionIds').equals(id).toArray();
  for (const img of imagesToUpdate) {
    if (img.id !== undefined) {
      await db.images.update(img.id, { collectionIds: img.collectionIds.filter(cid => cid !== id) });
    }
  }

  const subCollections = await db.collections.where('parentId').equals(id).toArray();
  if (subCollections.length > 0) {
    for (const subColl of subCollections) {
      if (subColl.id !== undefined) {
        await db.collections.update(subColl.id, { parentId: null });
      }
    }
  }
  return db.collections.delete(id);
};

// Add/Remove image from collection (already present, good)

// Data Management
export const exportData = async (): Promise<{ metadataJson: string, imageFiles: { name: string, blob: Blob }[] }> => {
  const images = await db.images.toArray();
  const collections = await db.collections.toArray();

  const metadata = {
    version: 1, 
    collections: collections.map(c => {
      const { children, imageCount, ...rest } = c; // Strip transient properties
      return rest;
    }),
    images: images.map(img => {
      // Strip transient properties like file, dataUri, and transform for metadata
      const { file, dataUri, transform, ...rest } = img; 
      return { ...rest, originalName: img.name, fileNameInZip: `img_${img.id}_${img.name}` };
    }),
  };
  
  const imageFiles = images
    .filter(img => img.file instanceof Blob)
    .map(img => ({
      name: `img_${img.id}_${img.name}`, // Consistent naming with metadata
      blob: img.file as Blob 
  }));

  return { metadataJson: JSON.stringify(metadata, null, 2), imageFiles };
};


export const importData = async (metadataJson: string, files: File[]): Promise<string[]> => {
  const warnings: string[] = [];
  const parsedData = JSON.parse(metadataJson);
  
  const importedCollectionsRaw: Array<Collection & {id: number}> = 
    (parsedData.collections || []).map((c: any) => ({
    ...c,
    createdAt: new Date(c.createdAt), // Convert string date to Date object
  }));

  // Metadata for images from the JSON file
  const importedImagesJsonData = (parsedData.images || []).map((img: any) => ({
    ...img,
    createdAt: new Date(img.createdAt), // Convert string date to Date object
  }));

  const oldToNewCollectionIdMap = new Map<number, number>();
  const collectionParentImportData: Array<{ newDbId: number; oldParentId: number | null }> = [];
  const filesMap = new Map(files.map(f => [f.name, f]));

  await db.transaction('rw', db.collections, db.images, async () => {
    // COLLECTIONS - Pass 1: Insert all collections, map old IDs to new IDs.
    for (const collToImport of importedCollectionsRaw) {
      const oldCollectionId = collToImport.id; // Original ID from JSON
      const { name, createdAt: collCreatedAt, parentId: originalParentId } = collToImport; // Explicitly pick fields

      if (!(collCreatedAt instanceof Date)) {
        warnings.push(`Collection "${name}" has invalid createdAt format. Skipping.`);
        continue;
      }

      try {
        const newCollectionEntry: Omit<Collection, 'id' | 'children' | 'imageCount'> = {
          name: name,
          createdAt: collCreatedAt,
          parentId: null, // Set to null initially for Pass 1
        };
        const newGeneratedDbId = await db.collections.add(newCollectionEntry);
        
        oldToNewCollectionIdMap.set(oldCollectionId, newGeneratedDbId);
        collectionParentImportData.push({ newDbId: newGeneratedDbId, oldParentId: originalParentId ?? null });
      } catch (e) {
        warnings.push(`Failed to import collection "${name}" (Pass 1): ${(e as Error).message}`);
      }
    }

    // COLLECTIONS - Pass 2: Update parentIds using the new ID map.
    for (const { newDbId, oldParentId } of collectionParentImportData) {
      if (oldParentId !== null) { 
        const newParentDbId = oldToNewCollectionIdMap.get(oldParentId);
        if (newParentDbId !== undefined) {
          try {
            await db.collections.update(newDbId, { parentId: newParentDbId });
          } catch (e) {
            warnings.push(`Failed to set parent for collection (New DB ID: ${newDbId}, Original Parent ID: ${oldParentId}): ${(e as Error).message}`);
          }
        } else {
          warnings.push(`Parent collection (Original ID: ${oldParentId}) for collection (New DB ID: ${newDbId}) not found during mapping. It will remain a root collection.`);
        }
      }
    }
    
    // IMAGES - Import images and link to newly mapped collection IDs
    for (const imgJson of importedImagesJsonData) {
      const { 
        id: oldImgId, // This is the original ID from the JSON file
        fileNameInZip, 
        originalName, 
        collectionIds: oldCollectionIdsFromImg,
        // Actual metadata fields:
        name, 
        tags,
        width,
        height,
        isFavorite,
        isProtected,
        createdAt, // This is already a Date object
        mimeType, // MimeType from JSON, prefer file.type
        syncStatus,
        // Note: 'file', 'dataUri', 'transform' are not in imgJson if exportData stripped them
      } = imgJson;
      
      const imageFile = filesMap.get(fileNameInZip!) || filesMap.get(originalName!);

      if (imageFile) {
        const newImageCollectionIds = (oldCollectionIdsFromImg || [])
          .map(oldCollId => oldToNewCollectionIdMap.get(oldCollId))
          .filter((newCollId): newCollId is number => newCollId !== undefined);

        const imageToAdd: Omit<ImageMetadata, 'id' | 'dataUri' | 'transform'> = {
          name: originalName || name || imageFile.name, // Prioritize originalName, then name from JSON, then file name
          file: imageFile,
          tags: tags || [],
          width: width,
          height: height,
          isFavorite: isFavorite || false,
          isProtected: isProtected || false,
          createdAt: createdAt, // Already a Date object
          mimeType: imageFile.type, // Prefer actual file's mimeType
          syncStatus: syncStatus || 'local',
          collectionIds: newImageCollectionIds,
        };
        
        try {
          await db.images.add(imageToAdd as ImageMetadata); // Cast is fine, 'id' is auto-generated
        } catch (e) {
          warnings.push(`Failed to import image "${imageToAdd.name}": ${(e as Error).message}`);
        }
      } else {
        warnings.push(`Image file not found for "${originalName || fileNameInZip}"`);
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

