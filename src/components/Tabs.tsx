import { LucideIcon } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:static sm:border-none sm:bg-transparent sm:pb-0">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:rounded-full sm:px-4 sm:py-2 sm:text-sm ${
              isActive ? 'text-brand-700 sm:bg-brand-100' : 'text-slate-500 sm:hover:bg-slate-100'
            }`}
          >
            <Icon size={20} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
