"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  id: string;
  label: string;
  content: ReactNode;
};

/**
 * Generic section switcher for long pages. Renders only the active tab's
 * content, so the user doesn't have to scroll past everything to find what
 * they need. Keeps the underlying data-fetching/markup of each section
 * untouched — this only changes how the sections are arranged on screen.
 */
export function PageTabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="page-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={tab.id === active}
            className={`page-tab ${tab.id === active ? "page-tab-active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="page-tab-panel">{current?.content}</div>
    </div>
  );
}
