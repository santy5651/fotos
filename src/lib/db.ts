
import Dexie, { type Table } from 'dexie';
import type { ImageMetadata, Collection } from '@/types';

export class PicStackDexie extends Dexie {
  images!: Table<ImageMetadata, number>;
  collections!: Table<Collection, number>;

  constructor() {
    super('PicStackDB');
    this.version(4).stores({ // Incremented version for new index
      images: '++id, name, *tags, createdAt, isFavorite, isProtected, *collectionIds, mimeType, isPotentialDuplicate, hasTags', // Added hasTags
      collections: '++id, name, parentId, createdAt',
    }).upgrade(async tx => {
      console.log("Upgrading DB from version 3 to 4 (if applicable)");
      // Add hasTags field to existing images
      await tx.table("images").toCollection().modify(image => {
        image.hasTags = !!(image.tags && image.tags.length > 0);
      });
    });
    this.version(3).stores({ 
      images: '++id, name, *tags, createdAt, isFavorite, isProtected, *collectionIds, mimeType, isPotentialDuplicate',
      collections: '++id, name, parentId, createdAt',
    }).upgrade(tx => {
      console.log("Upgrading DB from version 2 or 3 to 3 (if applicable)");
      return tx.table("images").toCollection().modify(image => {
        if (image.isPotentialDuplicate === undefined) {
          image.isPotentialDuplicate = false;
        }
      });
    });
    this.version(2).stores({
      images: '++id, name, *tags, createdAt, isFavorite, *collectionIds, mimeType',
      collections: '++id, name, parentId, createdAt',
    }).upgrade(tx => {
      console.log("Upgrading DB from version 1 to 2 (if applicable)");
       return tx.table("images").toCollection().modify(image => {
        if (image.isPotentialDuplicate === undefined) {
          image.isPotentialDuplicate = false;
        }
      });
    });
    this.version(1).stores({
      images: '++id, name, *tags, createdAt, isFavorite, *collectionIds',
      collections: '++id, name, parentId, createdAt',
    });
  }
}

export const db = new PicStackDexie();

// Image CRUD
export const addImage = async (image: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus' | 'hasTags'> & { createdAt?: Date, syncStatus?: ImageMetadata['syncStatus'] }): Promise<number> => {
  const newImage: ImageMetadata = {
    id: undefined, 
    name: image.name,
    file: image.file,
    tags: image.tags || [],
    width: image.width,
    height: image.height,
    isFavorite: image.isFavorite || false,
    isProtected: image.isProtected || false,
    createdAt: image.createdAt || new Date(),
    mimeType: image.mimeType || image.file.type,
    syncStatus: image.syncStatus || 'local',
    collectionIds: image.collectionIds || [],
    transform: image.transform || { rotate: 0 },
    isPotentialDuplicate: image.isPotentialDuplicate || false,
    hasTags: !!(image.tags && image.tags.length > 0), // Set hasTags
  };
  return db.images.add(newImage);
};

export const getImages = async (filter?: {
  collectionId?: number | null;
  searchTerm?: string;
  reviewDuplicates?: boolean;
  showUnassigned?: boolean;
  showUntagged?: boolean; // New filter
}): Promise<ImageMetadata[]> => {
  let imagesQuery: Dexie.Collection<ImageMetadata, number>;

  if (filter?.reviewDuplicates) {
    imagesQuery = db.images.filter(img => img.isPotentialDuplicate === true);
  } else if (filter?.showUnassigned) {
    imagesQuery = db.images.filter(img =>
      !img.isPotentialDuplicate &&
      (!img.collectionIds || img.collectionIds.length === 0)
    );
  } else if (filter?.showUntagged) { // New filter condition
    imagesQuery = db.images.filter(img => 
      !img.isPotentialDuplicate &&
      img.hasTags === false // Using the new indexed field
    );
  } else if (filter?.collectionId !== null && filter?.collectionId !== undefined) {
    const selectedCollectionId = filter.collectionId;
    imagesQuery = db.images.filter(img =>
      !img.isPotentialDuplicate &&
      ((img.collectionIds && img.collectionIds.includes(selectedCollectionId)) ||
       (!img.collectionIds || img.collectionIds.length === 0)) 
    );
  } else { 
    imagesQuery = db.images.filter(img => !img.isPotentialDuplicate);
  }

  let sortedImages = await imagesQuery.sortBy('createdAt');
  sortedImages.reverse(); 

  if (filter?.searchTerm && filter.searchTerm.trim() !== '') {
    const searchTerm = filter.searchTerm.trim();
    
    if (searchTerm.startsWith('tag:')) {
      const tagName = searchTerm.substring(4).toLowerCase();
      return sortedImages.filter(img => 
        img.tags && img.tags.some(tag => tag.toLowerCase() === tagName)
      );
    } else {
      const term = searchTerm.toLowerCase();
      const allCollections = await db.collections.toArray();

      return sortedImages.filter(img => {
        if (img.name.toLowerCase().includes(term)) return true;
        if (img.tags && img.tags.some(tag => tag.toLowerCase().includes(term))) return true;
        
        if (img.collectionIds && img.collectionIds.length > 0) {
          const imageCollectionNames = img.collectionIds
            .map(id => allCollections.find(c => c.id === id)?.name)
            .filter(name => !!name) as string[];
          if (imageCollectionNames.some(name => name.toLowerCase().includes(term))) {
            return true;
          }
        }
        return false;
      });
    }
  }

  return sortedImages;
};


export const getImageById = async (id: number): Promise<ImageMetadata | undefined> => {
  return db.images.get(id);
};

export const updateImage = async (id: number, changes: Partial<ImageMetadata>): Promise<number> => {
  // If tags are being updated, also update hasTags
  if (changes.tags !== undefined) {
    changes.hasTags = !!(changes.tags && changes.tags.length > 0);
  }
  return db.images.update(id, changes);
};

export const deleteImage = async (id: number): Promise<void> => {
  const image = await db.images.get(id);
  if (image && image.isProtected && !image.isPotentialDuplicate) {
    throw new Error("Image is protected and cannot be deleted.");
  }
  return db.images.delete(id);
};

export const checkIfImageExistsByName = async (fileName: string): Promise<boolean> => {
  const lowerCaseFileName = fileName.toLowerCase();
  const count = await db.images.filter(img => img.name.toLowerCase() === lowerCaseFileName && !img.isPotentialDuplicate).count();
  return count > 0;
};


// Collection CRUD
export const addCollection = async (collection: Omit<Collection, 'id' | 'createdAt'> & { createdAt?: Date }): Promise<number> => {
  const newCollection: Collection = {
    id: undefined,
    name: collection.name,
    parentId: collection.parentId || null,
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
      parentCollection.children!.push(collection);
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
  console.log(`[DB DEBUG] Attempting to delete collection ID: ${id}`);
  const imagesInCollection = await db.images.where('collectionIds').equals(id).toArray();
  console.log(`[DB DEBUG] Found ${imagesInCollection.length} images in collection ${id}`);
  for (const img of imagesInCollection) {
    if (img.id !== undefined && img.collectionIds) {
      const updatedCollectionIds = img.collectionIds.filter(cid => cid !== id);
      await db.images.update(img.id, { collectionIds: updatedCollectionIds });
      console.log(`[DB DEBUG] Updated image ${img.id}, removed collectionId ${id}. New collectionIds: ${updatedCollectionIds}`);
    }
  }

  const subCollections = await db.collections.where('parentId').equals(id).toArray();
  console.log(`[DB DEBUG] Found ${subCollections.length} sub-collections for collection ${id}`);
  for (const subColl of subCollections) {
    if (subColl.id !== undefined) {
      await db.collections.update(subColl.id, { parentId: null });
      console.log(`[DB DEBUG] Re-parented sub-collection ${subColl.id} to root.`);
    }
  }
  await db.collections.delete(id);
  console.log(`[DB DEBUG] Deleted collection ${id} itself.`);
};


// Data Management
export const exportData = async (): Promise<{ metadataJson: string, imageFiles: { name: string, blob: Blob }[] }> => {
  console.log("[EXPORT DEBUG] Exporting: Fetching all images and collections from DB...");
  const images = await db.images.toArray();
  const collections = await db.collections.toArray();
  console.log(`[EXPORT DEBUG] Exporting: Found ${images.length} images and ${collections.length} collections.`);

  const metadata = {
    version: 4, // Current DB schema version for import logic
    collections: collections.map(c => {
      const { children, imageCount, ...serializableCollection } = c;
      return {
        ...serializableCollection,
        createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
      };
    }),
    images: images.map(img => {
      const sanitizedOriginalName = (img.name || `image_no_name_${img.id || 'unknown'}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
      let extension = '.bin';
      if (img.mimeType && img.mimeType.includes('/')) {
          const typePart = img.mimeType.split('/')[1].toLowerCase();
          extension = `.${typePart === 'jpeg' ? 'jpg' : typePart}`;
      }
      const fileNameInZip = `img_${img.id}_${sanitizedOriginalName}${extension}`;

      const { file, dataUri, ...serializableImageBase } = img; 
      return {
        ...serializableImageBase,
        fileNameInZip: fileNameInZip,
        createdAt: img.createdAt ? img.createdAt.toISOString() : new Date().toISOString(),
        tags: img.tags || [], // ensure tags is an array
        collectionIds: img.collectionIds || [], // ensure collectionIds is an array
        transform: img.transform || { rotate: 0 },
        isPotentialDuplicate: img.isPotentialDuplicate || false,
        hasTags: img.hasTags, // Export hasTags
      };
    }),
  };

  const imageFiles = images
    .filter(img => img.file instanceof Blob)
    .map(img => {
        const sanitizedOriginalName = (img.name || `image_no_name_${img.id || 'unknown'}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        let extension = '.bin';
        if (img.mimeType && img.mimeType.includes('/')) {
            const typePart = img.mimeType.split('/')[1].toLowerCase();
            extension = `.${typePart === 'jpeg' ? 'jpg' : typePart}`;
        }
        const fileNameInZip = `img_${img.id}_${sanitizedOriginalName}${extension}`;
        return {
            name: fileNameInZip, 
            blob: img.file as Blob
        };
  });

  console.log(`[EXPORT DEBUG] Exporting: Prepared metadata and ${imageFiles.length} image files blobs.`);
  return { metadataJson: JSON.stringify(metadata, null, 2), imageFiles };
};


export const importData = async (metadataJson: string, files: File[]): Promise<string[]> => {
  console.log("[IMPORT DEBUG DB] Starting importData function.");
  const warnings: string[] = [];

  let parsedData;
  try {
    parsedData = JSON.parse(metadataJson);
    console.log("[IMPORT DEBUG DB] Metadata JSON parsed. Version:", parsedData.version);
  } catch (e) {
    console.error("[IMPORT DEBUG DB] Failed to parse metadata JSON.", e);
    warnings.push(`Failed to parse metadata JSON: ${(e as Error).message}`);
    return warnings;
  }

  const importedCollectionsRaw: Array<any> = parsedData.collections || [];
  console.log(`[IMPORT DEBUG DB] ${importedCollectionsRaw.length} collections raw objects from metadata.`);

  const importedImagesJsonData: Array<any> = parsedData.images || [];
  console.log(`[IMPORT DEBUG DB] ${importedImagesJsonData.length} images raw objects from metadata.`);


  const oldToNewCollectionIdMap = new Map<number, number>();
  const collectionParentImportData: Array<{ newDbId: number; oldParentId: number | null }> = [];

  const filesMap = new Map(files.map(f => [f.name, f]));
  console.log(`[IMPORT DEBUG DB] ${filesMap.size} image files provided from ZIP. Names: ${Array.from(filesMap.keys()).join(', ')}`);

  await db.transaction('rw', db.collections, db.images, async () => {
    console.log("[IMPORT DEBUG DB] Dexie transaction started for collections and images.");

    console.log("[IMPORT DEBUG DB] Collections Pass 1 - Inserting collections and mapping IDs.");
    for (const collToImport of importedCollectionsRaw) {
      const oldCollectionId = collToImport.id;

      const newCollectionEntry: Omit<Collection, 'id' | 'children' | 'imageCount'> = {
        name: collToImport.name || "Unnamed Collection",
        createdAt: collToImport.createdAt ? new Date(collToImport.createdAt) : new Date(),
        parentId: null, 
      };

      if (!(newCollectionEntry.createdAt instanceof Date) || isNaN(newCollectionEntry.createdAt.getTime())) {
        const warningMsg = `Collection "${newCollectionEntry.name}" (Old ID: ${oldCollectionId}) has invalid createdAt value ("${collToImport.createdAt}"). Using current date.`;
        warnings.push(warningMsg);
        console.warn(`[IMPORT DEBUG DB] ${warningMsg}`);
        newCollectionEntry.createdAt = new Date();
      }

      try {
        const newGeneratedDbId = await db.collections.add(newCollectionEntry as Collection);
        if (oldCollectionId !== undefined && oldCollectionId !== null) { 
          oldToNewCollectionIdMap.set(oldCollectionId, newGeneratedDbId);
        }
        collectionParentImportData.push({ newDbId: newGeneratedDbId, oldParentId: collToImport.parentId ?? null });
        console.log(`[IMPORT DEBUG DB] Added collection "${newCollectionEntry.name}". Old ID: ${oldCollectionId}, New DB ID: ${newGeneratedDbId}. Original parentId: ${collToImport.parentId}`);
      } catch (e) {
        const errorMsg = `Failed to import collection "${newCollectionEntry.name}" (Old ID: ${oldCollectionId}): ${(e as Error).message}`;
        warnings.push(errorMsg);
        console.error(`[IMPORT DEBUG DB] ${errorMsg}`, e);
      }
    }
    console.log(`[IMPORT DEBUG DB] Collections Pass 1 completed. ${oldToNewCollectionIdMap.size} collections mapped.`);
    console.log("[IMPORT DEBUG DB] Old to New Collection ID Map:", oldToNewCollectionIdMap);
    console.log("[IMPORT DEBUG DB] Collection Parent Import Data for Pass 2:", collectionParentImportData);


    console.log("[IMPORT DEBUG DB] Collections Pass 2 - Updating parent IDs.");
    for (const { newDbId, oldParentId } of collectionParentImportData) {
      if (oldParentId !== null && oldParentId !== undefined) {
        const newParentDbId = oldToNewCollectionIdMap.get(oldParentId);
        if (newParentDbId !== undefined) {
          try {
            await db.collections.update(newDbId, { parentId: newParentDbId });
            console.log(`[IMPORT DEBUG DB] Set parent for collection (New DB ID: ${newDbId}) to New Parent DB ID: ${newParentDbId} (Original Parent ID: ${oldParentId})`);
          } catch (e) {
             const errorMsg = `Failed to set parent for collection (New DB ID: ${newDbId}, Original Parent ID: ${oldParentId}): ${(e as Error).message}`;
             warnings.push(errorMsg);
             console.error(`[IMPORT DEBUG DB] ${errorMsg}`, e);
          }
        } else {
          const warningMsg = `Parent collection (Original ID: ${oldParentId}) for collection (New DB ID: ${newDbId}) not found in mapping. It will remain a root collection.`;
          warnings.push(warningMsg);
          console.warn(`[IMPORT DEBUG DB] ${warningMsg}`);
        }
      }
    }
    console.log("[IMPORT DEBUG DB] Collections Pass 2 completed.");


    console.log("[IMPORT DEBUG DB] Starting image import process.");
    let imagesAddedCount = 0;
    for (const imgJson of importedImagesJsonData) {
      console.log(`[IMPORT DEBUG DB] Processing image JSON: name="${imgJson.name}", fileNameInZip="${imgJson.fileNameInZip}"`);
      const imageFile = filesMap.get(imgJson.fileNameInZip);

      if (imageFile) {
        console.log(`[IMPORT DEBUG DB] Found file in ZIP for "${imgJson.fileNameInZip}": ${imageFile.name}, type: ${imageFile.type}`);

        const newImageCollectionIds = (imgJson.collectionIds || [])
          .map((oldCollId: number) => oldToNewCollectionIdMap.get(oldCollId))
          .filter((newCollId?: number): newCollId is number => newCollId !== undefined && newCollId !== null);
        console.log(`[IMPORT DEBUG DB] Mapped collection IDs for "${imgJson.name}": Old ${JSON.stringify(imgJson.collectionIds)}, New ${JSON.stringify(newImageCollectionIds)}`);
        
        const importedTags = Array.isArray(imgJson.tags) ? imgJson.tags : [];

        const imageToAdd: Omit<ImageMetadata, 'id'> = {
          name: imgJson.name || imageFile.name,
          file: imageFile,
          tags: importedTags,
          width: typeof imgJson.width === 'number' ? imgJson.width : 0,
          height: typeof imgJson.height === 'number' ? imgJson.height : 0,
          isFavorite: typeof imgJson.isFavorite === 'boolean' ? imgJson.isFavorite : false,
          isProtected: typeof imgJson.isProtected === 'boolean' ? imgJson.isProtected : false,
          createdAt: imgJson.createdAt ? new Date(imgJson.createdAt) : new Date(),
          mimeType: imageFile.type || imgJson.mimeType || 'application/octet-stream', 
          syncStatus: imgJson.syncStatus || 'local',
          collectionIds: newImageCollectionIds,
          transform: imgJson.transform && typeof imgJson.transform.rotate === 'number' ? imgJson.transform : { rotate: 0 },
          isPotentialDuplicate: typeof imgJson.isPotentialDuplicate === 'boolean' ? imgJson.isPotentialDuplicate : false,
          hasTags: typeof imgJson.hasTags === 'boolean' ? imgJson.hasTags : (importedTags.length > 0), // Import or derive hasTags
        };

        if (!(imageToAdd.createdAt instanceof Date) || isNaN(imageToAdd.createdAt.getTime())) {
          const warningMsg = `Image "${imageToAdd.name}" has invalid createdAt value ("${imgJson.createdAt}"). Using current date.`;
          warnings.push(warningMsg);
          console.warn(`[IMPORT DEBUG DB] ${warningMsg}`);
          imageToAdd.createdAt = new Date();
        }

        try {
          await db.images.add(imageToAdd as ImageMetadata);
          imagesAddedCount++;
          console.log(`[IMPORT DEBUG DB] Added image "${imageToAdd.name}" to DB.`);
        } catch (e) {
          const errorMsg = `Failed to import image "${imageToAdd.name}": ${(e as Error).message}`;
          warnings.push(errorMsg);
          console.error(`[IMPORT DEBUG DB] ${errorMsg}`, e);
        }
      } else {
        const warningMsg = `Image file not found in ZIP for metadata entry: name="${imgJson.name}", fileNameInZip="${imgJson.fileNameInZip}". Searched for "${imgJson.fileNameInZip}". File map keys: ${Array.from(filesMap.keys())}. Skipping image.`;
        warnings.push(warningMsg);
        console.warn(`[IMPORT DEBUG DB] ${warningMsg}`);
      }
    }
    console.log(`[IMPORT DEBUG DB] Image import process completed. ${imagesAddedCount} images added to DB.`);
  });

  console.log("[IMPORT DEBUG DB] importData function finished. Warnings collected:", warnings.length);
  return warnings;
};


export const deleteAllData = async (): Promise<void> => {
  await db.transaction('rw', db.images, db.collections, async () => {
    await db.images.clear();
    await db.collections.clear();
  });
  console.log("All data deleted from DB.");
};

// Stats
export const getTotalImageCount = async (): Promise<number> => {
  return db.images.filter(img => !img.isPotentialDuplicate).count();
};

export const getUnassignedImageCount = async (): Promise<number> => {
  return db.images.filter(img => 
    !img.isPotentialDuplicate && 
    (!img.collectionIds || img.collectionIds.length === 0)
  ).count();
};

export const getUntaggedImageCount = async (): Promise<number> => {
  return db.images.filter(img => 
    !img.isPotentialDuplicate &&
    img.hasTags === false
  ).count();
};

export const getImagesPerCollection = async (): Promise<{ name: string, count: number }[]> => {
  const collections = await db.collections.toArray();
  const counts = await Promise.all(
    collections.map(async (collection) => {
      if (collection.id === undefined) return { name: collection.name, count: 0 };
      const count = await db.images.filter(img => !img.isPotentialDuplicate && img.collectionIds.includes(collection.id!)).count();
      return { name: collection.name, count };
    })
  );
  return counts.filter(c => c.count > 0);
};

export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const getAllUniqueTags = async (): Promise<string[]> => {
  const allImages = await db.images.filter(img => !img.isPotentialDuplicate).toArray();
  const tagSet = new Set<string>();
  allImages.forEach(image => {
    if (image.tags && image.tags.length > 0) {
      image.tags.forEach(tag => tagSet.add(tag));
    }
  });
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
};

// Bulk operations
export const bulkAddImagesToCollections = async (imageIds: number[], targetCollectionIds: number[]): Promise<void> => {
  if (imageIds.length === 0 || targetCollectionIds.length === 0) {
    return;
  }
  await db.transaction('rw', db.images, async () => {
    for (const imageId of imageIds) {
      const image = await db.images.get(imageId);
      if (image) {
        const currentCollectionIds = new Set(image.collectionIds || []);
        targetCollectionIds.forEach(id => currentCollectionIds.add(id));
        await db.images.update(imageId, { collectionIds: Array.from(currentCollectionIds) });
      }
    }
  });
};

