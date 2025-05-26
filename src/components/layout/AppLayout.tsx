
"use client";

import { useState, type ReactNode } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileImage, Settings, BarChartBig, Tag as TagIconLucide, FolderSearch } from "lucide-react";
import CollectionsPanel from '@/components/collections/CollectionsPanel';
import ImageUpload from '@/components/image/ImageUpload';
import SearchBar from '@/components/search/SearchBar';
import SettingsDropdown from '@/components/settings/SettingsDropdown';
import StatisticsModal from '@/components/stats/StatisticsModal';
import TagExplorerModal from '@/components/tags/TagExplorerModal';
import CollectionExplorerModal from '@/components/collections/CollectionExplorerModal';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  onSearch: (term: string) => void;
  onCollectionSelect: (collectionId: number | null) => void;
  onUploadComplete: () => void;
  onToggleReviewDuplicates: () => void;
  isReviewDuplicatesMode: boolean;
  onToggleShowUnassigned: () => void; 
  isShowUnassignedMode: boolean; 
  onToggleShowUntagged: () => void; // New prop
  isShowUntaggedMode: boolean; // New prop
}

export default function AppLayout({ 
  children, 
  onSearch, 
  onCollectionSelect, 
  onUploadComplete,
  onToggleReviewDuplicates,
  isReviewDuplicatesMode,
  onToggleShowUnassigned, 
  isShowUnassignedMode, 
  onToggleShowUntagged, // New prop
  isShowUntaggedMode, // New prop
}: AppLayoutProps) {
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isTagExplorerModalOpen, setIsTagExplorerModalOpen] = useState(false);
  const [isCollectionExplorerModalOpen, setIsCollectionExplorerModalOpen] = useState(false);

  const handleCollectionSelectedFromExplorer = (collectionId: number | null) => {
    onCollectionSelect(collectionId);
    setIsCollectionExplorerModalOpen(false); 
  };

  const handleTagSelectedFromExplorer = (tag: string) => {
    onSearch(`tag:${tag}`); 
    setIsTagExplorerModalOpen(false);
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4 items-center flex flex-row gap-2">
          <FileImage className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-semibold group-data-[collapsible=icon]:hidden">PicStack</h1>
        </SidebarHeader>
        <SidebarContent asChild>
          <ScrollArea className="h-full">
            <CollectionsPanel 
              onCollectionSelect={onCollectionSelect} 
              onToggleReviewDuplicates={onToggleReviewDuplicates}
              isReviewDuplicatesMode={isReviewDuplicatesMode}
              onToggleShowUnassigned={onToggleShowUnassigned} 
              isShowUnassignedMode={isShowUnassignedMode} 
              onToggleShowUntagged={onToggleShowUntagged} // Pass new prop
              isShowUntaggedMode={isShowUntaggedMode} // Pass new prop
            />
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="p-2">
          {/* Footer content if any */}
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1">
            <SearchBar onSearch={onSearch} />
          </div>
          <ImageUpload onUploadComplete={onUploadComplete} />
          <Button variant="outline" size="icon" onClick={() => setIsCollectionExplorerModalOpen(true)} title="Explorador de Colecciones">
            <FolderSearch className="h-5 w-5" />
            <span className="sr-only">Explorador de Colecciones</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsTagExplorerModalOpen(true)} title="Explorador de Etiquetas">
            <TagIconLucide className="h-5 w-5" /> 
            <span className="sr-only">Explorador de Etiquetas</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsStatsModalOpen(true)} title="Ver Estadísticas">
            <BarChartBig className="h-5 w-5" />
            <span className="sr-only">Ver Estadísticas</span>
          </Button>
          <SettingsDropdown />
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </SidebarInset>
      {isStatsModalOpen && <StatisticsModal isOpen={isStatsModalOpen} onClose={() => setIsStatsModalOpen(false)} />}
      {isTagExplorerModalOpen && (
        <TagExplorerModal 
          isOpen={isTagExplorerModalOpen} 
          onClose={() => setIsTagExplorerModalOpen(false)} 
          onTagSelectAndClose={handleTagSelectedFromExplorer} 
        />
      )}
      {isCollectionExplorerModalOpen && (
        <CollectionExplorerModal 
          isOpen={isCollectionExplorerModalOpen} 
          onClose={() => setIsCollectionExplorerModalOpen(false)}
          onCollectionSelectAndClose={handleCollectionSelectedFromExplorer}
        />
      )}
    </SidebarProvider>
  );
}
