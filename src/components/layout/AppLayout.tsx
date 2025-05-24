
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
import { FileImage, Settings, BarChartBig, Tag as TagIcon } from "lucide-react";
import CollectionsPanel from '@/components/collections/CollectionsPanel';
import ImageUpload from '@/components/image/ImageUpload';
import SearchBar from '@/components/search/SearchBar';
import SettingsDropdown from '@/components/settings/SettingsDropdown';
import StatisticsModal from '@/components/stats/StatisticsModal';
import TagExplorerModal from '@/components/tags/TagExplorerModal';

interface AppLayoutProps {
  children: ReactNode;
  onSearch: (term: string) => void;
  onCollectionSelect: (collectionId: number | null) => void;
  onUploadComplete: () => void;
}

export default function AppLayout({ children, onSearch, onCollectionSelect, onUploadComplete }: AppLayoutProps) {
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isTagExplorerModalOpen, setIsTagExplorerModalOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4 items-center flex flex-row gap-2">
          <FileImage className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-semibold group-data-[collapsible=icon]:hidden">PicStack</h1>
        </SidebarHeader>
        <SidebarContent asChild>
          <ScrollArea className="h-full">
            <CollectionsPanel onCollectionSelect={onCollectionSelect} />
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
          <Button variant="outline" size="icon" onClick={() => setIsTagExplorerModalOpen(true)} title="View All Tags">
            <TagIcon className="h-5 w-5" />
            <span className="sr-only">View All Tags</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsStatsModalOpen(true)} title="View Statistics">
            <BarChartBig className="h-5 w-5" />
            <span className="sr-only">View Statistics</span>
          </Button>
          <SettingsDropdown />
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </SidebarInset>
      {isStatsModalOpen && <StatisticsModal isOpen={isStatsModalOpen} onClose={() => setIsStatsModalOpen(false)} />}
      {isTagExplorerModalOpen && <TagExplorerModal isOpen={isTagExplorerModalOpen} onClose={() => setIsTagExplorerModalOpen(false)} />}
    </SidebarProvider>
  );
}
