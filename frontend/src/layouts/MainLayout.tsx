import React from 'react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { PageTab } from '../types';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: PageTab;
  setActiveTab: (tab: PageTab) => void;
  backendConnected: boolean;
  datasetName: string | null;
  datasetRecords: number;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  backendConnected,
  datasetName,
  datasetRecords,
}) => {
  return (
    <div className="flex min-h-screen bg-[#0b1120] text-slate-100">
      {/* Persistent Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          backendConnected={backendConnected}
          datasetName={datasetName}
          datasetRecords={datasetRecords}
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
