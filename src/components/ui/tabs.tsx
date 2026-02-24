"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  HTMLAttributes,
  ButtonHTMLAttributes,
} from "react";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue>({
  activeTab: "",
  setActiveTab: () => {},
});

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultTab: string;
}

/**
 * Accessible tabs container. Syncs active tab with the URL hash.
 */
export function Tabs({ defaultTab, className = "", children, ...rest }: TabsProps) {
  const [activeTab, setActiveTabState] = useState<string>(defaultTab);

  // Read initial tab from URL hash on mount.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) setActiveTabState(hash);
  }, []);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    window.location.hash = tab;
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

type TabListProps = HTMLAttributes<HTMLDivElement>;

export function TabList({ className = "", children, ...rest }: TabListProps) {
  return (
    <div
      role="tablist"
      className={`flex gap-1 p-1 rounded-xl bg-surface-1/80 border border-white/5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

interface TabTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabTrigger({
  value,
  className = "",
  children,
  ...rest
}: TabTriggerProps) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${value}`}
      id={`tab-${value}`}
      onClick={() => setActiveTab(value)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        isActive
          ? "bg-brand-600/20 text-brand-200 border border-brand-500/20 shadow-sm"
          : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabPanel({
  value,
  className = "",
  children,
  ...rest
}: TabPanelProps) {
  const { activeTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      hidden={!isActive}
      className={`${isActive ? "animate-fade-in" : ""} ${className}`}
      {...rest}
    >
      {isActive ? children : null}
    </div>
  );
}
