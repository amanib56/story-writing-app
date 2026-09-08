"use client";

import type { StoryNode } from "@/lib/schema/types";

type ProjectSidebarProps = {
  activeId: string;
  isCollapsed: boolean;
  newSectionName: string;
  nodes: StoryNode[];
  onAddSection: () => void;
  onNewSectionNameChange: (value: string) => void;
  onSelect: (id: string) => void;
  onToggle: () => void;
};

export function ProjectSidebar({ activeId, isCollapsed, newSectionName, nodes, onAddSection, onNewSectionNameChange, onSelect, onToggle }: ProjectSidebarProps) {
  return <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
    <div className="sidebar-heading"><span>PROJECT</span><button className="sidebar-toggle" type="button" title="Hide sidebar" aria-label="Hide sidebar" onClick={onToggle}>‹</button></div>
    <div className="sidebar-content"><div className="top-level-composer"><input aria-label="New top-level section name" value={newSectionName} placeholder="New section" onChange={(event) => onNewSectionNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAddSection(); }} /><button type="button" onClick={onAddSection} title="Add top-level section" aria-label="Add top-level section">+</button></div><nav aria-label="Story sections">{nodes.map((node) => <button className={`nav-item ${activeId === node.id ? "active" : ""}`} key={node.id} type="button" onClick={() => onSelect(node.id)}><span className="nav-marker" />{node.label || "Untitled section"}</button>)}</nav></div>
    <div className="sidebar-footer"><span>LOCAL PROJECT</span><strong>.storyproj</strong></div>
  </aside>;
}