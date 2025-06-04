
import Dexie, { type Table } from 'dexie';
import type { ImageMetadata, Collection } from '@/types';

export class PicStackDexie extends Dexie {
  images!: Table<ImageMetadata, number>;
  collections!: Table<Collection, number>;

  constructor() {
    super('PicStackDB');
    this.version(6).stores({
      images: '++id, name, *tags, createdAt, isFavorite, isProtected, *collectionIds, mimeType, isPotentialDuplicate, hasTags, hasDescription',
      collections: '++id, name, parentId, createdAt',
    });
    this.version(5).stores({
      images: '++id, name, *tags, createdAt, isFavorite, isProtected, *collectionIds, mimeType, isPotentialDuplicate, hasTags, hasDescription',
      collections: '++id, name, parentId, createdAt',
    }).upgrade(async tx => {
      console.log("Upgrading DB from version 4 to 5 (if applicable for hasDescription)");
      await tx.table("images").toCollection().modify(image => {
        if (image.hasDescription === undefined) {
            image.hasDescription = !!(image.description && image.description.trim() !== "");
        }
      });
    });
    this.version(4).stores({
      images: '++id, name, *tags, createdAt, isFavorite, isProtected, *collectionIds, mimeType, isPotentialDuplicate, hasTags',
      collections: '++id, name, parentId, createdAt',
    }).upgrade(async tx => {
      console.log("Upgrading DB from version 3 to 4 (if applicable for hasTags)");
      await tx.table("images").toCollection().modify(image => {
        if (image.hasTags === undefined) {
          image.hasTags = !!(image.tags && image.tags.length > 0);
        }
      });
    });
    this.version(3).stores({
      images: '++id, name, *tags, createdAt, isFavorite, isProtected, *collectionIds, mimeType, isPotentialDuplicate',
      collections: '++id, name, parentId, createdAt',
    }).upgrade(tx => {
      console.log("Upgrading DB from version 2 to 3 (if applicable for isPotentialDuplicate)");
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
       return tx.table("images").toCollection().modify(image => {
        if (image.isPotentialDuplicate === undefined) image.isPotentialDuplicate = false;
        if (image.isProtected === undefined) image.isProtected = false;
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
export const addImage = async (image: Omit<ImageMetadata, 'id' | 'createdAt' | 'syncStatus' | 'hasTags' | 'hasDescription'> & { createdAt?: Date, syncStatus?: ImageMetadata['syncStatus'] }): Promise<number> => {
  const newImage: ImageMetadata = {
    id: undefined,
    name: image.name,
    file: image.file,
    tags: image.tags || [],
    description: image.description || '',
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
    hasTags: !!(image.tags && image.tags.length > 0),
    hasDescription: !!(image.description && image.description.trim() !== ''),
  };
  return db.images.add(newImage);
};

// Helper function to sort and paginate an array of images (used for reviewDuplicates mode)
const sortAndPaginateArray = (
  imagesArray: ImageMetadata[],
  offset?: number,
  limit?: number
): ImageMetadata[] => {
  // Sort by name primarily, then by ID (as a tie-breaker for same names from different original files)
  imagesArray.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    // If names are the same, sort by original upload time (createdAt) or ID
    // Using ID as a more stable tie-breaker than createdAt if times are identical
    if ((a.id ?? 0) < (b.id ?? 0)) return -1;
    if ((a.id ?? 0) > (b.id ?? 0)) return 1;
    return 0; // Should be very rare to have same name and same ID if IDs are unique
  });

  const effectiveOffset = offset ?? 0;
  const end = limit !== undefined ? effectiveOffset + limit : undefined;
  return imagesArray.slice(effectiveOffset, end);
};


export const getImages = async (filter?: {
  collectionId?: number | null;
  searchTerm?: string;
  reviewDuplicates?: boolean;
  showUnassigned?: boolean;
  showUntagged?: boolean;
  showUndescribed?: boolean;
  offset?: number;
  limit?: number;
}): Promise<{ images: ImageMetadata[], totalCount: number }> => {
  
  let query: Dexie.Collection<ImageMetadata, number> | undefined;
  let preliminaryImagesArray: ImageMetadata[] | undefined;

  if (filter?.reviewDuplicates) {
    const potentialDuplicatesFlagged = await db.images.filter(img => img.isPotentialDuplicate === true).toArray();
    if (potentialDuplicatesFlagged.length === 0) {
      return { images: [], totalCount: 0 };
    }
    // Get all names of images flagged as potential duplicates
    const duplicateNames = new Set(potentialDuplicatesFlagged.map(img => img.name.toLowerCase()));
    
    // Fetch ALL images (flagged or not) that have these names
    preliminaryImagesArray = await db.images.filter(img => duplicateNames.has(img.name.toLowerCase())).toArray();

  } else {
    if (filter?.showUnassigned) {
      query = db.images.filter(img => !img.isPotentialDuplicate && (!img.collectionIds || img.collectionIds.length === 0));
    } else if (filter?.showUntagged) {
      query = db.images.filter(img => !img.isPotentialDuplicate && img.hasTags === false);
    } else if (filter?.showUndescribed) {
      query = db.images.filter(img => !img.isPotentialDuplicate && img.hasDescription === false);
    } else if (filter?.collectionId !== null && filter?.collectionId !== undefined) {
      const targetCollectionId = filter.collectionId;
      query = db.images.where('collectionIds').equals(targetCollectionId).filter(img => !img.isPotentialDuplicate);
    } else {
      // Default: all images that are not potential duplicates
      query = db.images.filter(img => !img.isPotentialDuplicate);
    }

    if (filter?.searchTerm && filter.searchTerm.trim() !== '') {
      const searchTerm = filter.searchTerm.trim().toLowerCase();
      const allCollections = await getCollections(); 

      query = query.filter(img => {
        if (img.name.toLowerCase().includes(searchTerm)) return true;
        if (img.tags && img.tags.some(tag => tag.toLowerCase().includes(searchTerm))) return true;
        if (img.description && img.description.toLowerCase().includes(searchTerm)) return true;
        
        if (searchTerm.startsWith('tag:')) {
            const tagNameOnly = searchTerm.substring(4);
            return img.tags && img.tags.some(tag => tag.toLowerCase() === tagNameOnly);
        }

        if (img.collectionIds && img.collectionIds.length > 0) {
          const imageCollectionNames = img.collectionIds
            .map(id => allCollections.find(c => c.id === id)?.name)
            .filter((name): name is string => !!name);
          if (imageCollectionNames.some(name => name.toLowerCase().includes(searchTerm))) {
            return true;
          }
        }
        return false;
      });
    }
  }

  let totalCount: number;
  let finalImages: ImageMetadata[];

  if (preliminaryImagesArray !== undefined) { // reviewDuplicates case
    totalCount = preliminaryImagesArray.length;
    // Sorting for reviewDuplicates should group by name, then by original upload date/ID
    // The sortAndPaginateArray helper handles this grouping by name then ID.
    finalImages = sortAndPaginateArray(preliminaryImagesArray, filter?.offset, filter?.limit);
  } else if (query) { // Other cases
    totalCount = await query.count();
    
    // Clone the query before applying orderBy, as a precaution if .count() modifies state
    let sortableQuery = query.clone();
    let sortedQuery = sortableQuery.orderBy('createdAt').reverse();

    if (filter?.offset !== undefined && filter?.limit !== undefined) {
      finalImages = await sortedQuery.offset(filter.offset).limit(filter.limit).toArray();
    } else if (filter?.limit !== undefined) {
      finalImages = await sortedQuery.limit(filter.limit).toArray();
    } else {
      finalImages = await sortedQuery.toArray();
    }
  } else {
    // Should not happen if logic is correct, but as a fallback:
    return { images: [], totalCount: 0 };
  }
  
  return { images: finalImages, totalCount };
};


export const getImageById = async (id: number): Promise<ImageMetadata | undefined> => {
  return db.images.get(id);
};

export const updateImage = async (id: number, changes: Partial<ImageMetadata>): Promise<number> => {
  if (changes.tags !== undefined) {
    changes.hasTags = !!(changes.tags && changes.tags.length > 0);
  }
  if (changes.description !== undefined) {
    changes.hasDescription = !!(changes.description && changes.description.trim() !== '');
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
  const imagesInCollection = await db.images.where('collectionIds').equals(id).toArray();
  for (const img of imagesInCollection) {
    if (img.id !== undefined && img.collectionIds) {
      const updatedCollectionIds = img.collectionIds.filter(cid => cid !== id);
      await db.images.update(img.id, { collectionIds: updatedCollectionIds });
    }
  }

  const subCollections = await db.collections.where('parentId').equals(id).toArray();
  for (const subColl of subCollections) {
    if (subColl.id !== undefined) {
      await db.collections.update(subColl.id, { parentId: null });
    }
  }
  await db.collections.delete(id);
};


// Data Management
export const exportData = async (): Promise<{ metadataJson: string, imageFiles: { name: string, blob: Blob }[] }> => {
  const images = await db.images.toArray();
  const collections = await db.collections.toArray();

  const metadata = {
    version: 6,
    collections: collections.map(c => {
      const { children, imageCount, ...serializableCollection } = c;
      return {
        ...serializableCollection,
        id: c.id,
        name: c.name || "Unnamed Collection",
        parentId: c.parentId === undefined ? null : c.parentId,
        createdAt: (c.createdAt ? new Date(c.createdAt) : new Date()).toISOString(),
      };
    }),
    images: images.map(img => {
      const sanitizedOriginalName = (img.name || `image_no_name_${img.id || 'unknown'}`).replace(/[^a-zA-Z0-9_.\-]/g, '_');
      let extension = '.bin';
      if (img.mimeType && img.mimeType.includes('/')) {
          const typePart = img.mimeType.split('/')[1].toLowerCase();
          const commonExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'];
          if (commonExtensions.includes(typePart)) {
            extension = `.${typePart === 'jpeg' ? 'jpg' : typePart}`;
          } else {
            extension = `.${typePart.substring(0,3)}`;
          }
      }
      const fileNameInZip = `img_${img.id}_${sanitizedOriginalName}${extension}`;

      const { file, dataUri, ...baseImage } = img;
      return {
        ...baseImage,
        name: img.name || "Unnamed Image",
        tags: img.tags || [],
        description: img.description || "",
        width: img.width || 0,
        height: img.height || 0,
        isFavorite: img.isFavorite || false,
        isProtected: img.isProtected || false,
        createdAt: (img.createdAt ? new Date(img.createdAt) : new Date()).toISOString(),
        mimeType: img.mimeType || "application/octet-stream",
        syncStatus: img.syncStatus || 'local',
        collectionIds: img.collectionIds || [],
        transform: img.transform && typeof img.transform.rotate === 'number' ? { rotate: img.transform.rotate } : { rotate: 0 },
        isPotentialDuplicate: img.isPotentialDuplicate || false,
        hasTags: typeof img.hasTags === 'boolean' ? img.hasTags : ((img.tags || []).length > 0),
        hasDescription: typeof img.hasDescription === 'boolean' ? img.hasDescription : ((img.description || "").trim() !== ''),
        fileNameInZip: fileNameInZip,
      };
    }),
  };

  const imageFiles = images
    .filter(img => img.file instanceof Blob)
    .map(img => {
        const sanitizedOriginalName = (img.name || `image_no_name_${img.id || 'unknown'}`).replace(/[^a-zA-Z0-9_.\-]/g, '_');
        let extension = '.bin';
        if (img.mimeType && img.mimeType.includes('/')) {
            const typePart = img.mimeType.split('/')[1].toLowerCase();
            const commonExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'];
            if (commonExtensions.includes(typePart)) {
                extension = `.${typePart === 'jpeg' ? 'jpg' : typePart}`;
            } else {
                extension = `.${typePart.substring(0,3)}`;
            }
        }
        const fileNameInZip = `img_${img.id}_${sanitizedOriginalName}${extension}`;
        return {
            name: fileNameInZip,
            blob: img.file as Blob
        };
  });

  return { metadataJson: JSON.stringify(metadata, null, 2), imageFiles };
};

export const exportDataAsSingleJson = async (): Promise<string> => {
  const imagesFromDb = await db.images.toArray();
  const collectionsFromDb = await db.collections.toArray();

  const serializableCollections = collectionsFromDb.map(c => {
    const { children, imageCount, ...serializableCollection } = c;
    return {
      ...serializableCollection,
      id: c.id,
      name: c.name || "Unnamed Collection",
      parentId: c.parentId === undefined ? null : c.parentId,
      createdAt: (c.createdAt ? new Date(c.createdAt) : new Date()).toISOString(),
    };
  });

  const serializableImages = await Promise.all(imagesFromDb.map(async (img) => {
    const { file, ...baseImage } = img; 
    let imageDataUri: string | undefined = undefined;
    if (file instanceof Blob) {
      try {
        imageDataUri = await blobToDataURL(file);
      } catch (error) {
        console.warn(`Could not convert blob to data URI for image ID ${img.id}:`, error);
      }
    }

    return {
      ...baseImage,
      name: img.name || "Unnamed Image",
      tags: img.tags || [],
      description: img.description || "",
      width: img.width || 0,
      height: img.height || 0,
      isFavorite: img.isFavorite || false,
      isProtected: img.isProtected || false,
      createdAt: (img.createdAt ? new Date(img.createdAt) : new Date()).toISOString(),
      mimeType: img.mimeType || "application/octet-stream",
      syncStatus: img.syncStatus || 'local',
      collectionIds: img.collectionIds || [],
      transform: img.transform && typeof img.transform.rotate === 'number' ? { rotate: img.transform.rotate } : { rotate: 0 },
      isPotentialDuplicate: img.isPotentialDuplicate || false,
      hasTags: typeof img.hasTags === 'boolean' ? img.hasTags : ((img.tags || []).length > 0),
      hasDescription: typeof img.hasDescription === 'boolean' ? img.hasDescription : ((img.description || "").trim() !== ''),
      imageDataUri: imageDataUri, 
    };
  }));

  const exportObject = {
    version: 6, 
    collections: serializableCollections,
    images: serializableImages,
  };

  return JSON.stringify(exportObject, null, 2);
};

export function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    if (arr.length < 2) {
        throw new Error('Invalid data URL');
    }
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || mimeMatch.length < 2) {
        throw new Error('Could not parse MIME type from data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}


export const importDataFromJson = async (jsonDataString: string): Promise<string[]> => {
  const warnings: string[] = [];
  let parsedData;

  try {
    parsedData = JSON.parse(jsonDataString);
    if (parsedData.version !== 6) {
      warnings.push(`Import failed: Metadata version mismatch. Expected v6, got v${parsedData.version}. Try exporting new data first.`);
      return warnings;
    }
  } catch (e) {
    warnings.push(`Failed to parse JSON: ${(e as Error).message}`);
    return warnings;
  }

  const importedCollectionsRaw: Array<any> = parsedData.collections || [];
  const importedImagesJsonData: Array<any> = parsedData.images || [];

  const oldToNewCollectionIdMap = new Map<number, number>();
  const collectionParentImportData: Array<{ newDbId: number; oldParentId: number | null }> = [];

  await db.transaction('rw', db.collections, db.images, async () => {
    for (const collToImport of importedCollectionsRaw) {
      const oldCollectionId = collToImport.id;
      const newCollectionEntry: Omit<Collection, 'id' | 'children' | 'imageCount'> = {
        name: collToImport.name || `Imported Collection ${Date.now()}`,
        parentId: null,
        createdAt: collToImport.createdAt ? new Date(collToImport.createdAt) : new Date(),
      };
      if (!(newCollectionEntry.createdAt instanceof Date) || isNaN(newCollectionEntry.createdAt.getTime())) {
        warnings.push(`Collection "${newCollectionEntry.name}" (Old ID: ${oldCollectionId}) has invalid createdAt value ("${collToImport.createdAt}"). Using current date.`);
        newCollectionEntry.createdAt = new Date();
      }
      try {
        const newGeneratedDbId = await db.collections.add(newCollectionEntry as Collection);
        if (oldCollectionId !== undefined && oldCollectionId !== null) {
          oldToNewCollectionIdMap.set(oldCollectionId, newGeneratedDbId);
        }
        collectionParentImportData.push({ newDbId: newGeneratedDbId, oldParentId: collToImport.parentId ?? null });
      } catch (e) {
        warnings.push(`Failed to import collection "${newCollectionEntry.name}" (Old ID: ${oldCollectionId}): ${(e as Error).message}`);
      }
    }

    for (const { newDbId, oldParentId } of collectionParentImportData) {
      if (oldParentId !== null && oldParentId !== undefined) {
        const newParentDbId = oldToNewCollectionIdMap.get(oldParentId);
        if (newParentDbId !== undefined) {
          try {
            await db.collections.update(newDbId, { parentId: newParentDbId });
          } catch (e) {
            warnings.push(`Failed to set parent for collection (New DB ID: ${newDbId}, Original Parent ID: ${oldParentId}): ${(e as Error).message}`);
          }
        } else {
          warnings.push(`Parent collection (Original ID: ${oldParentId}) for collection (New DB ID: ${newDbId}) not found in mapping. It will remain a root collection.`);
        }
      }
    }

    for (const imgJson of importedImagesJsonData) {
      let imageFile: File | undefined;
      try {
        if (typeof imgJson.imageDataUri === 'string' && imgJson.imageDataUri.startsWith('data:')) {
            const filename = imgJson.name || `imported_image_${Date.now()}`;
            imageFile = dataURLtoFile(imgJson.imageDataUri, filename);
        } else {
            warnings.push(`Image data URI missing or invalid for image "${imgJson.name}". Skipping this image.`);
            continue;
        }
      } catch (e) {
        warnings.push(`Error converting data URI to file for image "${imgJson.name}": ${(e as Error).message}. Skipping this image.`);
        continue;
      }


      const newImageCollectionIds = (imgJson.collectionIds || [])
        .map((oldCollId: number) => oldToNewCollectionIdMap.get(oldCollId))
        .filter((newCollId?: number): newCollId is number => newCollId !== undefined && newCollId !== null);

      const importedTags = Array.isArray(imgJson.tags) ? imgJson.tags : [];
      const importedDescription = typeof imgJson.description === 'string' ? imgJson.description : "";

      const imageToAdd: Omit<ImageMetadata, 'id'> = {
        name: imgJson.name || imageFile.name || `imported_image_${Date.now()}`,
        file: imageFile,
        tags: importedTags,
        description: importedDescription,
        width: typeof imgJson.width === 'number' ? imgJson.width : 0,
        height: typeof imgJson.height === 'number' ? imgJson.height : 0,
        isFavorite: typeof imgJson.isFavorite === 'boolean' ? imgJson.isFavorite : false,
        isProtected: typeof imgJson.isProtected === 'boolean' ? imgJson.isProtected : false,
        createdAt: imgJson.createdAt ? new Date(imgJson.createdAt) : new Date(),
        mimeType: imageFile.type || imgJson.mimeType || 'application/octet-stream',
        syncStatus: (['local', 'pending', 'synced'].includes(imgJson.syncStatus) ? imgJson.syncStatus : 'local') as ImageMetadata['syncStatus'],
        collectionIds: newImageCollectionIds,
        transform: (imgJson.transform && typeof imgJson.transform.rotate === 'number') ? { rotate: imgJson.transform.rotate } : { rotate: 0 },
        isPotentialDuplicate: typeof imgJson.isPotentialDuplicate === 'boolean' ? imgJson.isPotentialDuplicate : false,
        hasTags: typeof imgJson.hasTags === 'boolean' ? imgJson.hasTags : (importedTags.length > 0),
        hasDescription: typeof imgJson.hasDescription === 'boolean' ? imgJson.hasDescription : (importedDescription.trim() !== ''),
      };

      if (!(imageToAdd.createdAt instanceof Date) || isNaN(imageToAdd.createdAt.getTime())) {
        warnings.push(`Image "${imageToAdd.name}" has invalid createdAt value ("${imgJson.createdAt}"). Using current date.`);
        imageToAdd.createdAt = new Date();
      }
      try {
        await db.images.add(imageToAdd as ImageMetadata);
      } catch (e) {
        warnings.push(`Failed to import image "${imageToAdd.name}": ${(e as Error).message}`);
      }
    }
  });
  return warnings;
};


export const importData = async (metadataJson: string, files: File[]): Promise<string[]> => {
  const warnings: string[] = [];

  let parsedData;
  try {
    parsedData = JSON.parse(metadataJson);
    if (parsedData.version !== 6) {
        warnings.push(`Import failed: Metadata version mismatch. Expected v6, got v${parsedData.version}. Try exporting new data first.`);
        return warnings;
    }
  } catch (e) {
    warnings.push(`Failed to parse metadata JSON: ${(e as Error).message}`);
    return warnings;
  }

  const importedCollectionsRaw: Array<any> = parsedData.collections || [];
  const importedImagesJsonData: Array<any> = parsedData.images || [];

  const oldToNewCollectionIdMap = new Map<number, number>();
  const collectionParentImportData: Array<{ newDbId: number; oldParentId: number | null }> = [];
  const filesMap = new Map(files.map(f => [f.name, f]));

  await db.transaction('rw', db.collections, db.images, async () => {
    for (const collToImport of importedCollectionsRaw) {
      const oldCollectionId = collToImport.id;
      const newCollectionEntry: Omit<Collection, 'id' |'children'|'imageCount'> = {
        name: collToImport.name || `Imported Collection ${Date.now()}`,
        parentId: null,
        createdAt: collToImport.createdAt ? new Date(collToImport.createdAt) : new Date(),
      };
      if (!(newCollectionEntry.createdAt instanceof Date) || isNaN(newCollectionEntry.createdAt.getTime())) {
        warnings.push(`Collection "${newCollectionEntry.name}" (Old ID: ${oldCollectionId}) has invalid createdAt value ("${collToImport.createdAt}"). Using current date.`);
        newCollectionEntry.createdAt = new Date();
      }
      try {
        const newGeneratedDbId = await db.collections.add(newCollectionEntry as Collection);
        if (oldCollectionId !== undefined && oldCollectionId !== null) {
          oldToNewCollectionIdMap.set(oldCollectionId, newGeneratedDbId);
        }
        collectionParentImportData.push({ newDbId: newGeneratedDbId, oldParentId: collToImport.parentId ?? null });
      } catch (e) {
        warnings.push(`Failed to import collection "${newCollectionEntry.name}" (Old ID: ${oldCollectionId}): ${(e as Error).message}`);
      }
    }

    for (const { newDbId, oldParentId } of collectionParentImportData) {
      if (oldParentId !== null && oldParentId !== undefined) {
        const newParentDbId = oldToNewCollectionIdMap.get(oldParentId);
        if (newParentDbId !== undefined) {
          try {
            await db.collections.update(newDbId, { parentId: newParentDbId });
          } catch (e) {
             warnings.push(`Failed to set parent for collection (New DB ID: ${newDbId}, Original Parent ID: ${oldParentId}): ${(e as Error).message}`);
          }
        } else {
          warnings.push(`Parent collection (Original ID: ${oldParentId}) for collection (New DB ID: ${newDbId}) not found in mapping. It will remain a root collection.`);
        }
      }
    }

    for (const imgJson of importedImagesJsonData) {
      const imageFile = filesMap.get(imgJson.fileNameInZip);
      if (imageFile) {
        const newImageCollectionIds = (imgJson.collectionIds || [])
          .map((oldCollId: number) => oldToNewCollectionIdMap.get(oldCollId))
          .filter((newCollId?: number): newCollId is number => newCollId !== undefined && newCollId !== null);

        const importedTags = Array.isArray(imgJson.tags) ? imgJson.tags : [];
        const importedDescription = typeof imgJson.description === 'string' ? imgJson.description : "";

        const imageToAdd: Omit<ImageMetadata, 'id'> = {
          name: imgJson.name || imageFile.name || `imported_image_${Date.now()}`,
          file: imageFile,
          tags: importedTags,
          description: importedDescription,
          width: typeof imgJson.width === 'number' ? imgJson.width : 0,
          height: typeof imgJson.height === 'number' ? imgJson.height : 0,
          isFavorite: typeof imgJson.isFavorite === 'boolean' ? imgJson.isFavorite : false,
          isProtected: typeof imgJson.isProtected === 'boolean' ? imgJson.isProtected : false,
          createdAt: imgJson.createdAt ? new Date(imgJson.createdAt) : new Date(),
          mimeType: imageFile.type || imgJson.mimeType || 'application/octet-stream',
          syncStatus: (['local', 'pending', 'synced'].includes(imgJson.syncStatus) ? imgJson.syncStatus : 'local') as ImageMetadata['syncStatus'],
          collectionIds: newImageCollectionIds,
          transform: (imgJson.transform && typeof imgJson.transform.rotate === 'number') ? { rotate: imgJson.transform.rotate } : { rotate: 0 },
          isPotentialDuplicate: typeof imgJson.isPotentialDuplicate === 'boolean' ? imgJson.isPotentialDuplicate : false,
          hasTags: typeof imgJson.hasTags === 'boolean' ? imgJson.hasTags : (importedTags.length > 0),
          hasDescription: typeof imgJson.hasDescription === 'boolean' ? imgJson.hasDescription : (importedDescription.trim() !== ''),
        };

        if (!(imageToAdd.createdAt instanceof Date) || isNaN(imageToAdd.createdAt.getTime())) {
          warnings.push(`Image "${imageToAdd.name}" has invalid createdAt value ("${imgJson.createdAt}"). Using current date.`);
          imageToAdd.createdAt = new Date();
        }
        try {
          await db.images.add(imageToAdd as ImageMetadata);
        } catch (e) {
          warnings.push(`Failed to import image "${imageToAdd.name}": ${(e as Error).message}`);
        }
      } else {
        warnings.push(`Image file not found in ZIP for metadata entry: name="${imgJson.name}", fileNameInZip="${imgJson.fileNameInZip}". Skipping image.`);
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
  return db.images.filter(img => !img.isPotentialDuplicate).count();
};

export const getPotentialDuplicatesCount = async (): Promise<number> => {
  return db.images.filter(img => img.isPotentialDuplicate === true).count();
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

export const getUndescribedImageCount = async (): Promise<number> => {
  return db.images.filter(img =>
    !img.isPotentialDuplicate &&
    img.hasDescription === false
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


    