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
import { saveAs } from 'file-saver'; // Implicitly available or needs `npm install file-saver @types/file-saver`
import StatisticsModal from '@/components/stats/StatisticsModal'; // Placeholder for now
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '../ui/input';


export default function SettingsDropdown() {
  const { toast } = useToast();
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { metadataJson, imageFiles } = await exportData();
      const zip = new JSZip();
      zip.file("metadata.json", metadataJson);
      const imagesFolder = zip.folder("images");
      if (imagesFolder) {
        imageFiles.forEach(imgFile => {
          imagesFolder.file(imgFile.name, imgFile.blob);
        });
      }
      
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, "picstack_local_export.zip"); // saveAs needs to be available
      toast({ title: "Export Successful", description: "Data exported as a zip file." });
    } catch (error) {
      console.error("Export error:", error);
      toast({ variant: "destructive", title: "Export Failed", description: (error as Error).message });
    }
    setIsExporting(false);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const metadataFile = zip.file("metadata.json");
      if (!metadataFile) throw new Error("metadata.json not found in zip.");
      
      const metadataJson = await metadataFile.async("string");
      
      const imageFilesPromises: Promise<File>[] = [];
      zip.folder("images")?.forEach((relativePath, zipEntry) => {
        if(!zipEntry.dir) {
            const promise = zipEntry.async("blob").then(blob => new File([blob], zipEntry.name.split('/').pop() || relativePath, {type: blob.type}));
            imageFilesPromises.push(promise);
        }
      });
      const imageFiles = await Promise.all(imageFilesPromises);

      const warnings = await importData(metadataJson, imageFiles);
      if (warnings.length > 0) {
        toast({ title: "Import Partially Successful", description: `Imported with warnings: ${warnings.join(', ')}`, duration: 10000 });
      } else {
        toast({ title: "Import Successful", description: "Data imported successfully." });
      }
      // Trigger a refresh of the app data
      window.location.reload(); // Simple way to refresh
    } catch (error) {
      console.error("Import error:", error);
      toast({ variant: "destructive", title: "Import Failed", description: (error as Error).message });
    }
    setIsImporting(false);
    event.target.value = ''; // Reset file input
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllData();
      toast({ title: "All Data Deleted", description: "All local data has been cleared." });
       window.location.reload();
    } catch (error) {
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
             <label htmlFor="import-zip" className="flex items-center cursor-pointer">
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
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
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
