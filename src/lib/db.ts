
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
    // Example of an older version, adjust if your actual v1 was different
    this.version(1).stores({
      images: '++id, name, *tags, createdAt, isFavorite, *collectionIds', // Older schema might miss mimeType
      collections: '++id, name, parentId, createdAt',
    }).upgrade(tx => {
      // If upgrading from a version 1 that didn't have mimeType and it's mandatory
      // you might need to update existing records.
      // For this app, new fields are optional or defaulted, so complex upgrade logic isn't strictly necessary
      // unless a field becomes non-optional or changes type.
      console.log("Upgrading DB from version 1 to 2 (if applicable)");
      // Example: return tx.table("images").toCollection().modify(image => {
      //   if (image.file && !image.mimeType) image.mimeType = image.file.type;
      // });
    });
  }
}

export const db = new PicStackDexie();

// Image CRUD
export const addImage = async (image: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus'> & { createdAt?: Date, syncStatus?: ImageMetadata['syncStatus'] }): Promise<number> => {
  const newImage: ImageMetadata = {
    id: undefined, // Dexie auto-increments
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
    // transform is transient, not stored by default
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
    id: undefined, // Dexie auto-increments
    name: collection.name,
    parentId: collection.parentId || null,
    createdAt: collection.createdAt || new Date(),
    // children and imageCount are transient, not stored
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
      // Ensure children array exists (already done above, but good for safety)
      // parentCollection.children = parentCollection.children || []; 
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
  // Remove this collection's ID from all images that might reference it
  const imagesInCollection = await db.images.where('collectionIds').equals(id).toArray();
  for (const img of imagesInCollection) {
    if (img.id !== undefined) {
      const updatedCollectionIds = img.collectionIds.filter(cid => cid !== id);
      await db.images.update(img.id, { collectionIds: updatedCollectionIds });
    }
  }

  // Re-parent sub-collections to be root collections
  const subCollections = await db.collections.where('parentId').equals(id).toArray();
  for (const subColl of subCollections) {
    if (subColl.id !== undefined) {
      await db.collections.update(subColl.id, { parentId: null });
    }
  }
  // Finally, delete the collection itself
  return db.collections.delete(id);
};


// Data Management
export const exportData = async (): Promise<{ metadataJson: string, imageFiles: { name: string, blob: Blob }[] }> => {
  console.log("Exporting: Fetching all images and collections from DB...");
  const images = await db.images.toArray();
  const collections = await db.collections.toArray();
  console.log(`Exporting: Found ${images.length} images and ${collections.length} collections.`);

  const metadata = {
    version: 2, // Current data version
    collections: collections.map(c => {
      // Strip transient properties before export
      const { children, imageCount, ...rest } = c; 
      return rest;
    }),
    images: images.map(img => {
      // Strip transient properties and the actual File object for metadata
      const { file, dataUri, transform, ...rest } = img; 
      // Sanitize original name for use in filename to avoid issues with special characters
      const sanitizedName = (img.name || `image_${img.id}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
      const fileNameInZip = `img_${img.id}_${sanitizedName}`;
      return { ...rest, originalName: img.name, fileNameInZip: fileNameInZip };
    }),
  };
  
  const imageFiles = images
    .filter(img => img.file instanceof Blob) // Ensure file is a Blob/File
    .map(img => {
        const sanitizedName = (img.name || `image_${img.id}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        const fileNameInZip = `img_${img.id}_${sanitizedName}`;
        return {
            name: fileNameInZip, // Use the same sanitized name as in metadata
            blob: img.file as Blob 
        };
  });

  console.log(`Exporting: Prepared metadata and ${imageFiles.length} image files blobs.`);
  return { metadataJson: JSON.stringify(metadata, null, 2), imageFiles };
};


export const importData = async (metadataJson: string, files: File[]): Promise<string[]> => {
  console.log("Importing: Starting importData function.");
  const warnings: string[] = [];
  
  let parsedData;
  try {
    parsedData = JSON.parse(metadataJson);
    console.log("Importing: Metadata JSON parsed. Version:", parsedData.version);
  } catch (e) {
    console.error("Importing: Failed to parse metadata JSON.", e);
    warnings.push(`Failed to parse metadata JSON: ${(e as Error).message}`);
    return warnings;
  }
  
  // Collections from JSON, ensuring createdAt is a Date
  const importedCollectionsRaw: Array<Collection & {id: number}> = 
    (parsedData.collections || []).map((c: any) => ({
    ...c,
    createdAt: new Date(c.createdAt),
  }));
  console.log(`Importing: ${importedCollectionsRaw.length} collections found in metadata.`);

  // Images from JSON, ensuring createdAt is a Date
  const importedImagesJsonData = (parsedData.images || []).map((img: any) => ({
    ...img,
    createdAt: new Date(img.createdAt),
  }));
  console.log(`Importing: ${importedImagesJsonData.length} images found in metadata.`);


  const oldToNewCollectionIdMap = new Map<number, number>();
  // Stores { newDbId: number (ID after insert), oldParentId: number | null (from JSON) }
  const collectionParentImportData: Array<{ newDbId: number; oldParentId: number | null }> = [];
  
  // Map filenames from the zip to File objects for quick lookup
  const filesMap = new Map(files.map(f => [f.name, f]));
  console.log(`Importing: ${filesMap.size} image files provided from ZIP.`);

  await db.transaction('rw', db.collections, db.images, async () => {
    console.log("Importing: Dexie transaction started for collections and images.");

    // COLLECTIONS - Pass 1: Insert all collections, map old IDs to new IDs.
    console.log("Importing: Collections Pass 1 - Inserting collections and mapping IDs.");
    for (const collToImport of importedCollectionsRaw) {
      const oldCollectionId = collToImport.id; // Original ID from JSON file
      
      // Explicitly pick fields for the new collection object
      const newCollectionEntry: Omit<Collection, 'id' | 'children' | 'imageCount'> = {
        name: collToImport.name,
        createdAt: collToImport.createdAt, // Already a Date object from map above
        parentId: null, // Set to null initially, will be updated in Pass 2
      };

      if (!(newCollectionEntry.createdAt instanceof Date) || isNaN(newCollectionEntry.createdAt.getTime())) {
        const warningMsg = `Collection "${newCollectionEntry.name}" has invalid createdAt value ("${collToImport.createdAt}"). Skipping.`;
        warnings.push(warningMsg);
        console.warn(`Importing: ${warningMsg}`);
        continue;
      }

      try {
        const newGeneratedDbId = await db.collections.add(newCollectionEntry);
        oldToNewCollectionIdMap.set(oldCollectionId, newGeneratedDbId);
        collectionParentImportData.push({ newDbId: newGeneratedDbId, oldParentId: collToImport.parentId ?? null });
        // console.log(`Importing: Added collection "${newCollectionEntry.name}". Old ID: ${oldCollectionId}, New DB ID: ${newGeneratedDbId}`);
      } catch (e) {
        const errorMsg = `Failed to import collection "${newCollectionEntry.name}" (Old ID: ${oldCollectionId}): ${(e as Error).message}`;
        warnings.push(errorMsg);
        console.error(`Importing: ${errorMsg}`, e);
      }
    }
    console.log(`Importing: Collections Pass 1 completed. ${oldToNewCollectionIdMap.size} collections mapped.`);

    // COLLECTIONS - Pass 2: Update parentIds using the new ID map.
    console.log("Importing: Collections Pass 2 - Updating parent IDs.");
    for (const { newDbId, oldParentId } of collectionParentImportData) {
      if (oldParentId !== null) { 
        const newParentDbId = oldToNewCollectionIdMap.get(oldParentId);
        if (newParentDbId !== undefined) {
          try {
            await db.collections.update(newDbId, { parentId: newParentDbId });
            // console.log(`Importing: Set parent for collection (New DB ID: ${newDbId}) to New Parent DB ID: ${newParentDbId} (Original Parent ID: ${oldParentId})`);
          } catch (e) {
             const errorMsg = `Failed to set parent for collection (New DB ID: ${newDbId}, Original Parent ID: ${oldParentId}): ${(e as Error).message}`;
             warnings.push(errorMsg);
             console.error(`Importing: ${errorMsg}`, e);
          }
        } else {
          const warningMsg = `Parent collection (Original ID: ${oldParentId}) for collection (New DB ID: ${newDbId}) not found during mapping. It will remain a root collection.`;
          warnings.push(warningMsg);
          console.warn(`Importing: ${warningMsg}`);
        }
      }
    }
    console.log("Importing: Collections Pass 2 completed.");
    
    // IMAGES - Import images and link to newly mapped collection IDs
    console.log("Importing: Starting image import process.");
    let imagesAddedCount = 0;
    for (const imgJson of importedImagesJsonData) {
      const imageFile = filesMap.get(imgJson.fileNameInZip) || filesMap.get(imgJson.originalName);

      if (imageFile) {
        const newImageCollectionIds = (imgJson.collectionIds || [])
          .map((oldCollId: number) => oldToNewCollectionIdMap.get(oldCollId))
          .filter((newCollId?: number): newCollId is number => newCollId !== undefined);

        // Explicitly construct the image object to be added
        const imageToAdd: Omit<ImageMetadata, 'id' | 'dataUri' | 'transform'> = {
          name: imgJson.originalName || imgJson.name || imageFile.name,
          file: imageFile,
          tags: imgJson.tags || [],
          width: imgJson.width,
          height: imgJson.height,
          isFavorite: imgJson.isFavorite || false,
          isProtected: imgJson.isProtected || false,
          createdAt: imgJson.createdAt, // Already a Date object
          mimeType: imageFile.type, // Prefer actual file's mimeType from zip
          syncStatus: imgJson.syncStatus || 'local',
          collectionIds: newImageCollectionIds,
        };

        if (!(imageToAdd.createdAt instanceof Date) || isNaN(imageToAdd.createdAt.getTime())) {
          const warningMsg = `Image "${imageToAdd.name}" has invalid createdAt value ("${imgJson.createdAt}"). Skipping.`;
          warnings.push(warningMsg);
          console.warn(`Importing: ${warningMsg}`);
          continue;
        }
        
        try {
          await db.images.add(imageToAdd as ImageMetadata); // Dexie will auto-generate 'id'
          imagesAddedCount++;
          // console.log(`Importing: Added image "${imageToAdd.name}"`);
        } catch (e) {
          const errorMsg = `Failed to import image "${imageToAdd.name}": ${(e as Error).message}`;
          warnings.push(errorMsg);
          console.error(`Importing: ${errorMsg}`, e);
        }
      } else {
        const warningMsg = `Image file not found in ZIP for metadata entry: "${imgJson.originalName || imgJson.fileNameInZip}". Skipping image.`;
        warnings.push(warningMsg);
        console.warn(`Importing: ${warningMsg}`);
      }
    }
    console.log(`Importing: Image import process completed. ${imagesAddedCount} images added to DB.`);
  }); // End of Dexie transaction
  
  console.log("Importing: importData function finished. Warnings collected:", warnings.length);
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
  return db.images.count();
};

export const getImagesPerCollection = async (): Promise<{ name: string, count: number }[]> => {
  const collections = await db.collections.toArray();
  const counts = await Promise.all(
    collections.map(async (collection) => {
      // Ensure collection.id is not undefined before querying
      if (collection.id === undefined) return { name: collection.name, count: 0 };
      const count = await db.images.where('collectionIds').equals(collection.id).count();
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

