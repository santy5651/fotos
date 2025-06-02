
"use client";

import React, { useState, useRef } from 'react'; 
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Download, Upload, Trash2, Loader2, FileJson } from 'lucide-react'; // Added FileJson
import { useToast } from '@/hooks/use-toast';
import { exportData, importData, deleteAllData, exportDataAsSingleJson } from '@/lib/db'; // Added exportDataAsSingleJson
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '../ui/input';


export default function SettingsDropdown() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false); // Renamed for clarity
  const [isExportingJson, setIsExportingJson] = useState(false); // New state for JSON export
  const fileInputRef = useRef<HTMLInputElement>(null); 

  const handleExportZip = async () => {
    setIsExportingZip(true);
    console.log("[EXPORT_ZIP DEBUG] Starting data export (ZIP)...");
    try {
      const { metadataJson, imageFiles } = await exportData();
      console.log("[EXPORT_ZIP DEBUG] Data prepared for export. Metadata JSON length:", metadataJson.length, "Number of image files:", imageFiles.length);
      const zip = new JSZip();
      zip.file("metadata.json", metadataJson);
      const imagesFolder = zip.folder("images");
      if (imagesFolder) {
        imageFiles.forEach(imgFile => {
          imagesFolder.file(imgFile.name, imgFile.blob);
        });
      }
      
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, "picstack_local_export.zip");
      toast({ title: "Export ZIP Successful", description: "Data exported as a ZIP file." });
      console.log("[EXPORT_ZIP DEBUG] Export completed and ZIP saved.");
    } catch (error) {
      console.error("[EXPORT_ZIP DEBUG] Export error:", error);
      toast({ variant: "destructive", title: "Export ZIP Failed", description: (error as Error).message });
    }
    setIsExportingZip(false);
  };

  const handleExportSingleJsonFile = async () => {
    setIsExportingJson(true);
    console.log("[EXPORT_JSON DEBUG] Starting data export (Single JSON)...");
    try {
      const singleJsonString = await exportDataAsSingleJson();
      const blob = new Blob([singleJsonString], { type: "application/json;charset=utf-8" });
      saveAs(blob, "picstack_data.json");
      toast({ title: "Export JSON Successful", description: "Data exported as a single JSON file." });
      console.log("[EXPORT_JSON DEBUG] Export completed and JSON file saved.");
    } catch (error) {
      console.error("[EXPORT_JSON DEBUG] Export error:", error);
      toast({ variant: "destructive", title: "Export JSON Failed", description: (error as Error).message });
    }
    setIsExportingJson(false);
  };


  const handleTriggerImport = () => {
    console.log("[IMPORT DEBUG] 'Import Data' menu item selected. Attempting to click file input programmatically.");
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; 
    }
    fileInputRef.current?.click();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[IMPORT DEBUG] handleImport function HAS BEEN TRIGGERED.");
    setIsImporting(true); 

    const file = event.target.files?.[0];

    if (!file) {
      console.log("[IMPORT DEBUG] No file selected for import. Aborting.");
      toast({ variant: "destructive", title: "Import Canceled", description: "No file was selected." });
      setIsImporting(false); 
      return;
    }
    
    console.log("[IMPORT DEBUG] File selected for import:", { name: file.name, size: file.size, type: file.type });
    
    // Assuming import is still for ZIP format. If JSON import is needed, this logic needs to change.
    if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
        toast({ variant: "destructive", title: "Import Error", description: "Invalid file type. Please select a .zip file for import." });
        setIsImporting(false);
        if (event.target) event.target.value = '';
        return;
    }
    
    try {
      console.log("[IMPORT DEBUG] Attempting to load ZIP with JSZip...");
      const zip = await JSZip.loadAsync(file);
      console.log("[IMPORT DEBUG] ZIP file loaded with JSZip. Files in zip:", Object.keys(zip.files).length);

      const metadataFile = zip.file("metadata.json");
      console.log("[IMPORT DEBUG] Metadata file object from zip:", metadataFile ? "Found" : "Not Found");

      if (!metadataFile) {
        console.error("[IMPORT DEBUG] metadata.json not found in zip.");
        toast({ variant: "destructive", title: "Import Error", description: "metadata.json not found in the selected ZIP file." });
        setIsImporting(false);
        return;
      }
      
      const metadataJson = await metadataFile.async("string");
      console.log("[IMPORT DEBUG] metadata.json content retrieved. Length:", metadataJson.length);


      const imageFilesPromises: Promise<File>[] = [];
      const imagesFolder = zip.folder("images");
      console.log("[IMPORT DEBUG] Images folder object from zip:", imagesFolder ? "Found" : "Not Found/Empty");

      if (imagesFolder) {
        imagesFolder.forEach((relativePath, zipEntry) => {
          if(!zipEntry.dir) {
              const fileName = zipEntry.name.split('/').pop() || relativePath;
              console.log("[IMPORT DEBUG] Preparing to extract image file from zip:", zipEntry.name, "as", fileName);
              const promise = zipEntry.async("blob").then(blob => new File([blob], fileName, {type: blob.type}));
              imageFilesPromises.push(promise);
          }
        });
      }
      
      const imageFiles = await Promise.all(imageFilesPromises);
      console.log(`[IMPORT DEBUG] Successfully prepared ${imageFiles.length} image files from zip.`);

      console.log("[IMPORT DEBUG] Calling db.importData with prepared metadata and files...");
      const warnings = await importData(metadataJson, imageFiles);
      console.log("[IMPORT DEBUG] db.importData finished. Warnings:", warnings);
      
      if (warnings.length > 0) {
        toast({ title: "Import Complete with Warnings", description: `Imported with warnings: ${warnings.join('; ')}. Check console for details. You may need to refresh the page.`, duration: 10000 });
      } else {
        toast({ title: "Import Successful", description: "Data imported successfully. You may need to refresh the page." });
      }
      
    } catch (error) {
      console.error("[IMPORT DEBUG] Critical error during import process in SettingsDropdown:", error);
      toast({ variant: "destructive", title: "Import Failed Critically", description: `An unexpected error occurred: ${(error as Error).message}. Check console for details.` });
    } finally {
      setIsImporting(false);
      if (event.target) {
        event.target.value = '';
      }
      console.log("[IMPORT DEBUG] handleImport function finished.");
    }
  };

  const handleDeleteAll = async () => {
    console.log("Attempting to delete all data...");
    try {
      await deleteAllData();
      toast({ title: "All Data Deleted", description: "All local data has been cleared." });
      console.log("All data deleted. Reloading page...");
      window.location.reload(); 
    } catch (error) {
      console.error("Deletion Failed:", error);
      toast({ variant: "destructive", title: "Deletion Failed", description: (error as Error).message });
    }
  };

  const anyOperationInProgress = isImporting || isExportingZip || isExportingJson;

  return (
    <>
      <Input 
        ref={fileInputRef}
        type="file"
        accept=".zip" // Keep accepting .zip for the current import logic
        className="hidden"
        onChange={handleImport}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={anyOperationInProgress}>
            {anyOperationInProgress ? <Loader2 className="h-5 w-5 animate-spin" /> : <Settings className="h-5 w-5" />}
            <span className="sr-only">Settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>App Settings</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportZip} disabled={anyOperationInProgress}>
            {isExportingZip ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Data (ZIP)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportSingleJsonFile} disabled={anyOperationInProgress}>
            {isExportingJson ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
            Export Data (JSON)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleTriggerImport} disabled={anyOperationInProgress}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import Data (ZIP)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem 
                  onSelect={(e) => e.preventDefault()} 
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive w-full"
                  disabled={anyOperationInProgress}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Data
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your images and collections from local storage.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

