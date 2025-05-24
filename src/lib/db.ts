
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
export const addImage = async (image: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus'> & { createdAt?: Date, syncStatus?: ImageMetadata['syncStatus'] }): Promise<number> => {
  const newImage: ImageMetadata = {
    ...image,
    id: undefined, // Ensure id is not set for add
    createdAt: image.createdAt || new Date(),
    syncStatus: image.syncStatus || 'local',
    collectionIds: image.collectionIds || [],
    file: image.file, // Ensure file is passed
  };
  // Dexie's add operation will handle the 'file' field correctly.
  // The 'file' property is part of the ImageMetadata interface and should be handled by Dexie.
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
    id: undefined, // Ensure id is not set for add
    createdAt: collection.createdAt || new Date(),
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
    collection.children = []; // Initialize children array
    collectionsMap.set(collection.id!, collection);
  });

  allCollections.forEach(collection => {
    if (collection.parentId && collectionsMap.has(collection.parentId)) {
      const parentCollection = collectionsMap.get(collection.parentId)!;
      // Ensure children array is initialized on parent
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
  // Disassociate images from this collection
  const imagesToUpdate = await db.images.where('collectionIds').equals(id).toArray();
  for (const img of imagesToUpdate) {
    if (img.id !== undefined) {
      await db.images.update(img.id, { collectionIds: img.collectionIds.filter(cid => cid !== id) });
    }
  }

  // Re-parent sub-collections to null (make them root)
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
    version: 1, // Schema version for the export format
    collections: collections.map(c => ({...c, children: undefined, imageCount: undefined})), // Strip transient properties
    images: images.map(img => {
      const { file, ...rest } = img; 
      return { ...rest, originalName: img.name, fileNameInZip: `img_${img.id}_${img.name}` };
    }),
  };
  
  const imageFiles = images
    .filter(img => img.file instanceof Blob) // Ensure img.file is a Blob/File
    .map(img => ({
      name: `img_${img.id}_${img.name}`,
      blob: img.file as Blob // Cast as Blob after filtering
  }));

  return { metadataJson: JSON.stringify(metadata, null, 2), imageFiles };
};


export const importData = async (metadataJson: string, files: File[]): Promise<string[]> => {
  const warnings: string[] = [];
  const parsedData = JSON.parse(metadataJson);
  
  const importedCollectionsRaw: Array<Collection & {id: number}> = // Assume id is present from export
    (parsedData.collections || []).map((c: any) => ({
    ...c,
    createdAt: new Date(c.createdAt),
  }));

  const importedImagesMetadata: (Omit<ImageMetadata, 'file' | 'id'> & { id?: number, originalName?: string, fileNameInZip?: string, collectionIds: number[] })[] = 
    (parsedData.images || []).map((img: any) => ({
    ...img, // Includes original ID as 'id'
    createdAt: new Date(img.createdAt),
  }));

  const oldToNewCollectionIdMap = new Map<number, number>();
  const collectionParentImportData: Array<{ newId: number; oldParentId: number | null }> = [];
  const filesMap = new Map(files.map(f => [f.name, f]));

  await db.transaction('rw', db.collections, db.images, async () => {
    // COLLECTIONS - Pass 1: Insert all collections, map old IDs to new IDs.
    for (const collToImport of importedCollectionsRaw) {
      const oldCollectionId = collToImport.id; // Original ID from JSON
      const { id, children, imageCount, parentId: originalParentId, ...collectionData } = collToImport;

      try {
        // Add collection with parentId temporarily as null. It will be updated in Pass 2.
        const newGeneratedId = await db.collections.add({
          ...collectionData, // name, createdAt
          parentId: null, // Set to null initially
        } as Collection);
        
        oldToNewCollectionIdMap.set(oldCollectionId, newGeneratedId);
        collectionParentImportData.push({ newId: newGeneratedId, oldParentId: originalParentId ?? null });
      } catch (e) {
        warnings.push(`Failed to import collection "${collectionData.name}" (Pass 1): ${(e as Error).message}`);
      }
    }

    // COLLECTIONS - Pass 2: Update parentIds using the new ID map.
    for (const { newId: newCollectionId, oldParentId } of collectionParentImportData) {
      if (oldParentId !== null) { // If it had a parent
        const newParentCollectionId = oldToNewCollectionIdMap.get(oldParentId);
        if (newParentCollectionId !== undefined) {
          try {
            await db.collections.update(newCollectionId, { parentId: newParentCollectionId });
          } catch (e) {
            warnings.push(`Failed to set parent for collection (New ID: ${newCollectionId}, Original Parent ID: ${oldParentId}): ${(e as Error).message}`);
          }
        } else {
          warnings.push(`Parent collection (Original ID: ${oldParentId}) for collection (New ID: ${newCollectionId}) not found during mapping. It will remain a root collection.`);
        }
      }
    }
    
    // IMAGES - Import images and link to newly mapped collection IDs
    for (const imgMeta of importedImagesMetadata) {
      const { id: oldImgId, file, fileNameInZip, originalName, collectionIds: oldCollectionIdsFromImg, ...restMeta } = imgMeta;
      
      const imageFile = filesMap.get(fileNameInZip!) || filesMap.get(originalName!);

      if (imageFile) {
        const newImageCollectionIds = (oldCollectionIdsFromImg || [])
          .map(oldCollId => oldToNewCollectionIdMap.get(oldCollId))
          .filter(newCollId => newCollId !== undefined) as number[];

        const imageToAdd: ImageMetadata = {
          ...(restMeta as Omit<ImageMetadata, 'id' | 'file' | 'collectionIds' | 'createdAt' | 'syncStatus'>),
          name: originalName || imageFile.name,
          file: imageFile,
          mimeType: imageFile.type,
          collectionIds: newImageCollectionIds,
          createdAt: new Date(restMeta.createdAt), // Already a Date object from above
          syncStatus: 'local',
          // id will be auto-generated
        };
        
        try {
          await db.images.add(imageToAdd);
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

