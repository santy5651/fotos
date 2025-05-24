
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Download, Upload, Trash2, BarChartBig, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportData, importData, deleteAllData } from '@/lib/db';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import StatisticsModal from '@/components/stats/StatisticsModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '../ui/input';


export default function SettingsDropdown() {
  const { toast } = useToast();
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    console.log("Starting data export...");
    try {
      const { metadataJson, imageFiles } = await exportData();
      console.log("Data prepared for export. Metadata JSON length:", metadataJson.length, "Number of image files:", imageFiles.length);
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
      toast({ title: "Export Successful", description: "Data exported as a zip file." });
      console.log("Export completed and zip saved.");
    } catch (error) {
      console.error("Export error:", error);
      toast({ variant: "destructive", title: "Export Failed", description: (error as Error).message });
    }
    setIsExporting(false);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[IMPORT DEBUG] handleImport triggered.");
    const file = event.target.files?.[0];

    if (!file) {
      console.log("[IMPORT DEBUG] No file selected for import.");
      toast({ variant: "destructive", title: "Import Canceled", description: "No file was selected." });
      // Ensure isImporting is reset if no file is chosen, though it shouldn't be set yet.
      setIsImporting(false); 
      event.target.value = ''; // Reset file input in case it was somehow triggered without a file
      return;
    }
    console.log("[IMPORT DEBUG] File selected for import:", { name: file.name, size: file.size, type: file.type });

    setIsImporting(true);
    
    try {
      console.log("[IMPORT DEBUG] Attempting to load ZIP with JSZip...");
      const zip = await JSZip.loadAsync(file);
      console.log("[IMPORT DEBUG] ZIP file loaded with JSZip. Files in zip:", Object.keys(zip.files));

      const metadataFile = zip.file("metadata.json");
      console.log("[IMPORT DEBUG] Metadata file object from zip:", metadataFile ? "Found" : "Not Found");

      if (!metadataFile) {
        console.error("[IMPORT DEBUG] metadata.json not found in zip.");
        toast({ variant: "destructive", title: "Import Error", description: "metadata.json not found in the selected ZIP file." });
        setIsImporting(false);
        event.target.value = '';
        return;
      }
      
      const metadataJson = await metadataFile.async("string");
      console.log("[IMPORT DEBUG] metadata.json content retrieved. Length:", metadataJson.length);
      console.debug("[IMPORT DEBUG] Metadata JSON content (first 500 chars):", metadataJson.substring(0, 500));


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
      imageFiles.forEach(f => console.debug("[IMPORT DEBUG] Prepared file details:", {name: f.name, size: f.size, type: f.type}));

      console.log("[IMPORT DEBUG] Calling db.importData with prepared metadata and files...");
      const warnings = await importData(metadataJson, imageFiles);
      console.log("[IMPORT DEBUG] db.importData finished. Warnings:", warnings);
      
      if (warnings.length > 0) {
        toast({ title: "Import Complete with Warnings", description: `Imported with warnings: ${warnings.join('; ')}. A manual page refresh might be needed.`, duration: 10000 });
      } else {
        toast({ title: "Import Successful", description: "Data imported successfully. A manual page refresh might be needed." });
      }
      
      // console.log("[IMPORT DEBUG] Page reload has been temporarily REMOVED for debugging.");
      // window.location.reload(); 
      
    } catch (error) {
      console.error("[IMPORT DEBUG] Critical error during import process in SettingsDropdown:", error);
      toast({ variant: "destructive", title: "Import Failed Critically", description: `An unexpected error occurred: ${(error as Error).message}. Check console for details.` });
    } finally {
      setIsImporting(false);
      event.target.value = ''; // Reset file input
      console.log("[IMPORT DEBUG] handleImport finished.");
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>App Settings</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Data
          </DropdownMenuItem>
          <DropdownMenuItem asChild disabled={isImporting}>
             <label htmlFor="import-zip" className="flex items-center cursor-pointer w-full">
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import Data
              <Input id="import-zip" type="file" accept=".zip" className="hidden" onChange={handleImport} />
            </label>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsStatsModalOpen(true)}>
            <BarChartBig className="mr-2 h-4 w-4" />
            View Stats
          </DropdownMenuItem>
          <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive w-full">
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
      {isStatsModalOpen && <StatisticsModal isOpen={isStatsModalOpen} onClose={() => setIsStatsModalOpen(false)} />}
    </>
  );
}

