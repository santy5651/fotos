
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
    // Instead of throwing error, disassociate images from this collection
     const imagesToUpdate = await db.images.where('collectionIds').equals(id).toArray();
     for (const img of imagesToUpdate) {
        await db.images.update(img.id!, { collectionIds: img.collectionIds.filter(cid => cid !== id) });
     }
    // throw new Error("Collection is not empty. Remove images before deleting.");
  }
  // Check for sub-collections
  const subCollections = await db.collections.where('parentId').equals(id).toArray();
  if (subCollections.length > 0) {
    // Optionally, re-parent sub-collections to null or delete them recursively.
    // For now, we'll just disassociate them (set parentId to null)
    for (const subColl of subCollections) {
        await db.collections.update(subColl.id!, { parentId: null });
    }
    // throw new Error("Collection has sub-collections. Delete them first or implement cascade delete.");
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
      // Dexie's toArray() might not include the File object if it's large and not explicitly requested.
      // Ensure 'file' is actually the Blob/File content. For export, we need the actual file.
      // If img.file is just a reference, this won't work. Assume db.images stores the File object.
      const { file, ...rest } = img; 
      return { ...rest, originalName: img.name, fileNameInZip: `img_${img.id}_${img.name}` };
    }),
  };
  
  const imageFiles = images.map(img => ({
    name: `img_${img.id}_${img.name}`, // This name will be used inside the zip and for matching during import
    blob: img.file // This must be the actual File/Blob object
  }));

  return { metadataJson: JSON.stringify(metadata, null, 2), imageFiles };
};


export const importData = async (metadataJson: string, files: File[]): Promise<string[]> => {
  const warnings: string[] = [];
  const parsedData = JSON.parse(metadataJson);
  
  // Ensure createdAt fields are Date objects
  const importedCollections: Collection[] = (parsedData.collections || []).map((c: any) => ({
    ...c,
    createdAt: new Date(c.createdAt),
  }));
  const importedImagesMetadata: (Omit<ImageMetadata, 'file'> & {originalName?: string, fileNameInZip?: string})[] = 
    (parsedData.images || []).map((img: any) => ({
    ...img,
    createdAt: new Date(img.createdAt),
  }));

  const oldToNewCollectionIdMap = new Map<number, number>();
  const filesMap = new Map(files.map(f => [f.name, f]));

  await db.transaction('rw', db.collections, db.images, async () => {
    // Import Collections first and map old IDs to new IDs
    for (const coll of importedCollections) {
      const oldId = coll.id;
      const { id, children, imageCount, ...collectionDataToImport } = coll;
      try {
        // parentId might also need mapping if it refers to an ID within the imported set.
        // For simplicity, if parentId exists, we assume it's an old ID and try to map it.
        if (collectionDataToImport.parentId !== null && collectionDataToImport.parentId !== undefined) {
            const newParentId = oldToNewCollectionIdMap.get(collectionDataToImport.parentId);
            // If newParentId is undefined, it means parent was not imported or not yet processed.
            // This simple mapping assumes parent collections are listed before children or handled by iterating.
            // A more robust solution would process all collections first, then update parentIds.
            // For now, we'll map if available, otherwise, it might become a root collection or fail if parentId is mandatory.
            collectionDataToImport.parentId = newParentId !== undefined ? newParentId : null;
        }

        const newCollectionId = await db.collections.add(collectionDataToImport as Collection);
        if (oldId !== undefined) {
          oldToNewCollectionIdMap.set(oldId, newCollectionId);
        }
      } catch (e) {
        warnings.push(`Failed to import collection "${coll.name}": ${(e as Error).message}`);
      }
    }
    
    // Second pass for parentIds to ensure all collections are in the map
    for (const coll of importedCollections) {
        if (coll.parentId !== null && coll.parentId !== undefined) {
            const newGeneratedId = oldToNewCollectionIdMap.get(coll.id!); // ID of current collection after import
            const newParentId = oldToNewCollectionIdMap.get(coll.parentId);
            if (newGeneratedId && newParentId && (await db.collections.get(newGeneratedId))?.parentId !== newParentId) {
                 try {
                    await db.collections.update(newGeneratedId, { parentId: newParentId });
                 } catch (e) {
                    warnings.push(`Failed to update parent for collection "${coll.name}": ${(e as Error).message}`);
                 }
            }
        }
    }


    // Import Images
    for (const imgMeta of importedImagesMetadata) {
      const { id: oldImgId, file, fileNameInZip, originalName, collectionIds: oldCollectionIds, ...restMeta } = imgMeta;
      
      const imageFile = filesMap.get(fileNameInZip!) || filesMap.get(originalName!);

      if (imageFile) {
        const newCollectionIds = (oldCollectionIds || [])
          .map(oldCollId => oldToNewCollectionIdMap.get(oldCollId))
          .filter(newCollId => newCollId !== undefined) as number[];

        const imageToAdd: ImageMetadata = {
          ...(restMeta as Omit<ImageMetadata, 'id' | 'file' | 'collectionIds' | 'createdAt' | 'syncStatus'>),
          name: originalName || imageFile.name,
          file: imageFile,
          mimeType: imageFile.type,
          collectionIds: newCollectionIds,
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

