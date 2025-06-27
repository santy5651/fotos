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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Settings, Download, Upload, Trash2, Loader2, FileJson, UploadCloud, FileSpreadsheet, Wand2, Sun, Moon, Laptop, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';
import { exportData, importData, deleteAllData, exportDataAsSingleJson, importDataFromJson, getTotalImageCount, exportDataAsCsv } from '@/lib/db';
import { validateApiKey } from '@/ai/flows/validate-api-key-flow';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

interface SettingsDropdownProps {
  isAiProcessingEnabled: boolean;
  onAiProcessingToggle: () => void;
}

export default function SettingsDropdown({ isAiProcessingEnabled, onAiProcessingToggle }: SettingsDropdownProps) {
  const { setTheme } = useTheme();
  const { toast } = useToast();
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const zipFileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isKeyValidating, setIsKeyValidating] = useState(false);

  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      const { metadataJson, imageFiles } = await exportData();
      const totalImages = await getTotalImageCount();
      const zip = new JSZip();
      zip.file("metadata.json", metadataJson);
      const imagesFolder = zip.folder("images");
      if (imagesFolder) {
        imageFiles.forEach(imgFile => {
          imagesFolder.file(imgFile.name, imgFile.blob);
        });
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const formattedDate = new Date().toISOString().split('T')[0];
      saveAs(zipBlob, `picstack_local_export_V1_${formattedDate}_${totalImages}images.zip`);
      toast({ title: "Export ZIP Successful", description: "Data exported as a ZIP file." });
    } catch (error) {
      toast({ variant: "destructive", title: "Export ZIP Failed", description: (error as Error).message });
    }
    setIsExportingZip(false);
  };

  const handleExportSingleJsonFile = async () => {
    setIsExportingJson(true);
    try {
      const singleJsonString = await exportDataAsSingleJson();
      const totalImages = await getTotalImageCount();
      const blob = new Blob([singleJsonString], { type: "application/json;charset=utf-8" });
      const formattedDate = new Date().toISOString().split('T')[0];
      saveAs(blob, `picstack_data_V1_${formattedDate}_${totalImages}images.json`);
      toast({ title: "Export JSON Successful", description: "Data exported as a single JSON file." });
    } catch (error) {
      toast({ variant: "destructive", title: "Export JSON Failed", description: (error as Error).message });
    }
    setIsExportingJson(false);
  };

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const csvData = await exportDataAsCsv();
      const totalImages = await getTotalImageCount();
      const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8;' });
      const formattedDate = new Date().toISOString().split('T')[0];
      saveAs(blob, `picstack_metadata_V1_${formattedDate}_${totalImages}images.csv`);
      toast({ title: "Exportación a CSV Exitosa", description: "Los metadatos se han exportado a un archivo CSV." });
    } catch (error) {
      toast({ variant: "destructive", title: "Fallo en Exportación a CSV", description: (error as Error).message });
    }
    setIsExportingCsv(false);
  };

  const handleTriggerZipImport = () => {
    if (zipFileInputRef.current) {
      zipFileInputRef.current.value = '';
    }
    zipFileInputRef.current?.click();
  };

  const handleZipImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsImportingZip(true);
    const file = event.target.files?.[0];

    if (!file) {
      toast({ variant: "destructive", title: "Import ZIP Canceled", description: "No file was selected." });
      setIsImportingZip(false);
      return;
    }

    if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
        toast({ variant: "destructive", title: "Import ZIP Error", description: "Invalid file type. Please select a .zip file for import." });
        setIsImportingZip(false);
        if (event.target) event.target.value = '';
        return;
    }

    try {
      const zip = await JSZip.loadAsync(file);
      const metadataFile = zip.file("metadata.json");

      if (!metadataFile) {
        toast({ variant: "destructive", title: "Import ZIP Error", description: "metadata.json not found in the selected ZIP file." });
        setIsImportingZip(false);
        return;
      }

      const metadataJson = await metadataFile.async("string");
      const imageFilesPromises: Promise<File>[] = [];
      const imagesFolder = zip.folder("images");

      if (imagesFolder) {
        imagesFolder.forEach((relativePath, zipEntry) => {
          if(!zipEntry.dir) {
              const fileName = zipEntry.name.split('/').pop() || relativePath;
              const promise = zipEntry.async("blob").then(blob => new File([blob], fileName, {type: blob.type}));
              imageFilesPromises.push(promise);
          }
        });
      }

      const imageFiles = await Promise.all(imageFilesPromises);
      const warnings = await importData(metadataJson, imageFiles);

      if (warnings.length > 0) {
        toast({ title: "Import ZIP Complete with Warnings", description: `Imported with warnings: ${warnings.join('; ')}. Check console for details. You may need to refresh the page.`, duration: 10000 });
      } else {
        toast({ title: "Import ZIP Successful", description: "Data imported successfully. You may need to refresh the page." });
      }

    } catch (error) {
      toast({ variant: "destructive", title: "Import ZIP Failed Critically", description: `An unexpected error occurred: ${(error as Error).message}. Check console for details.` });
    } finally {
      setIsImportingZip(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleTriggerJsonImport = () => {
    if (jsonFileInputRef.current) {
      jsonFileInputRef.current.value = '';
    }
    jsonFileInputRef.current?.click();
  };

  const handleJsonImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsImportingJson(true);
    const file = event.target.files?.[0];

    if (!file) {
      toast({ variant: "destructive", title: "Import JSON Canceled", description: "No file was selected." });
      setIsImportingJson(false);
      return;
    }

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        toast({ variant: "destructive", title: "Import JSON Error", description: "Invalid file type. Please select a .json file for import." });
        setIsImportingJson(false);
        if (event.target) event.target.value = '';
        return;
    }
    
    try {
      const jsonDataString = await file.text();
      const warnings = await importDataFromJson(jsonDataString);

      if (warnings.length > 0) {
        toast({ title: "Import JSON Complete with Warnings", description: `Imported with warnings: ${warnings.join('; ')}. Check console for details. You may need to refresh the page.`, duration: 10000 });
      } else {
        toast({ title: "Import JSON Successful", description: "Data imported successfully. You may need to refresh the page." });
      }

    } catch (error) {
      toast({ variant: "destructive", title: "Import JSON Failed Critically", description: `An unexpected error occurred: ${(error as Error).message}. Check console for details.` });
    } finally {
      setIsImportingJson(false);
      if (event.target) {
        event.target.value = '';
      }
    }
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

  const handleValidateKey = async () => {
    if (!apiKeyInput) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, ingrese una clave de API para validar.' });
      return;
    }
    setIsKeyValidating(true);
    try {
      const result = await validateApiKey({ apiKey: apiKeyInput });
      if (result.success) {
        toast({ title: 'Validación Exitosa', description: result.message, variant: 'default' });
      } else {
        toast({ title: 'Validación Fallida', description: result.message, variant: 'destructive', duration: 8000 });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error de Validación', description: 'Ocurrió un error inesperado.' });
    } finally {
      setIsKeyValidating(false);
    }
  };

  const anyOperationInProgress = isImportingZip || isImportingJson || isExportingZip || isExportingJson || isExportingCsv || isKeyValidating;

  return (
    <>
      <Input
        ref={zipFileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleZipImport}
        id="zip-import-input"
      />
      <Input
        ref={jsonFileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleJsonImport}
        id="json-import-input"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={anyOperationInProgress}>
            {anyOperationInProgress ? <Loader2 className="h-5 w-5 animate-spin" /> : <Settings className="h-5 w-5" />}
            <span className="sr-only">Settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>App Settings</DropdownMenuLabel>
          <DropdownMenuSeparator />
           <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="ml-2">Toggle Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Laptop className="mr-2 h-4 w-4" />
                  System
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
            <Label htmlFor="ai-processing-switch" className="flex items-center gap-2 font-normal cursor-pointer">
              <Wand2 className="h-4 w-4" />
              Procesamiento IA en subida
            </Label>
            <Switch
              id="ai-processing-switch"
              checked={isAiProcessingEnabled}
              onCheckedChange={onAiProcessingToggle}
            />
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Gestión de Clave de API</DropdownMenuLabel>
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Para usar las funciones de IA, añade tu clave de API de Google al archivo <code className="font-mono bg-muted p-0.5 rounded">.env</code> y reinicia el servidor.
          </div>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Pega tu clave para validarla"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="h-8"
                  disabled={isKeyValidating}
                />
              </div>
              <Button
                onClick={handleValidateKey}
                disabled={!apiKeyInput || isKeyValidating}
                className="w-full h-8"
                variant="secondary"
              >
                {isKeyValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Validar Clave
              </Button>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Gestión de Datos</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleExportZip} disabled={anyOperationInProgress}>
            {isExportingZip ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Data (ZIP)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportSingleJsonFile} disabled={anyOperationInProgress}>
            {isExportingJson ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
            Export Data (JSON)
          </DropdownMenuItem>
           <DropdownMenuItem onClick={handleExportCsv} disabled={anyOperationInProgress}>
            {isExportingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Exportar a CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleTriggerZipImport} disabled={anyOperationInProgress}>
            {isImportingZip ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import Data (ZIP)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleTriggerJsonImport} disabled={anyOperationInProgress}>
            {isImportingJson ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Import Data (JSON)
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
