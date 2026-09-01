"use client";

import { useState, type ReactNode } from "react";

/**
 * Tab switcher for long forms. Unlike PageTabs (components/page-tabs.tsx),
 * this keeps every section mounted in the DOM and only toggles CSS
 * visibility. That matters inside a single <form>: switching tabs must
 * never unmount an input, or its value (and any browser autofill/file
 * selection) would be lost. Only use this for sections that live inside
 * one shared form/state — for independent page sections, prefer PageTabs.
 */
export function FormTabs({
  sections,
  defaultTab,
}: {
  sections: { id: string; label: string; content: ReactNode }[];
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? sections[0]?.id);

  return (
    <div className="form-tabs-wrap">
      <div className="page-tabs" role="tablist">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === active}
            className={`page-tab ${s.id === active ? "page-tab-active" : ""}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sections.map((s) => (
        <div key={s.id} className="page-tab-panel" style={{ display: s.id === active ? "grid" : "none" }}>
          {s.content}
        </div>
      ))}
    </div>
  );
}
