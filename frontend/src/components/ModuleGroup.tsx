import React, { useState } from 'react';

export interface ModuleGroupTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface ModuleGroupProps {
  tabs: ModuleGroupTab[];
}

export const ModuleGroup: React.FC<ModuleGroupProps> = ({ tabs }) => {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? '');
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  if (!activeTab) return null;

  return (
    <section className="space-y-6">
      <div
        role="tablist"
        aria-label="Section modules"
        className="flex flex-wrap gap-2 border-b border-slate-800 pb-3"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`module-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab.id === tab.id}
            aria-controls={`module-panel-${tab.id}`}
            onClick={() => setActiveTabId(tab.id)}
            className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition ${
              activeTab.id === tab.id
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`module-panel-${activeTab.id}`}
        role="tabpanel"
        aria-labelledby={`module-tab-${activeTab.id}`}
      >
        {activeTab.content}
      </div>
    </section>
  );
};
