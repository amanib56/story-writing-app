"use client";

import { NodeRenderer } from "@/components/tree/NodeRenderer";
import type { NodeType, StoryNode, StoryProject } from "@/lib/schema/types";
import { StoryOverviewMeta } from "./StoryOverviewMeta";

type EditorCanvasProps = { activeNode: StoryNode; chapterNumber?: number; project: StoryProject; onOpenScript: (id: string) => void; onRequestAddChild: (parentId: string, parentName: string) => void; onChangeNode: (id: string, changes: Partial<StoryNode>) => void; onChangeProject: (changes: Partial<StoryProject>) => void; onRemoveNode: (id: string, label: string, bypassConfirmation: boolean) => void; onRemoveListItem: (id: string, index: number, item: string, bypassConfirmation: boolean) => void };

type HierarchyListProps = { node: StoryNode; volumeNumber?: number };

function HierarchyList({ node, volumeNumber }: HierarchyListProps) {
  const isCharacterProfile = Boolean(node.children?.some((child) => child.id.endsWith("-mbti")) && node.children?.some((child) => child.id.endsWith("-enneagram")));
  const label = volumeNumber ? `Volume ${volumeNumber}` : node.label || "Untitled field";
  return <li><a href={`#node-${node.id}`}>{label}</a>{!isCharacterProfile && node.children?.length ? <ul>{node.children.map((child, index) => <HierarchyList key={child.id} node={child} volumeNumber={node.id === "volumes" ? index + 1 : undefined} />)}</ul> : null}</li>;
}

export function EditorCanvas({ activeNode, chapterNumber, isViewOnly, project, onOpenScript, onRequestAddChild, onChangeNode, onChangeProject, onRemoveNode, onRemoveListItem }: EditorCanvasProps & { isViewOnly: boolean }) {
  const isOverview = activeNode.id === "overview";
  const title = chapterNumber ? `Chapter ${chapterNumber}` : activeNode.label || "Untitled section";
  return <section className={`canvas ${isViewOnly ? "canvas-view-only" : ""}`}><div className="canvas-header"><span className="eyebrow">{isOverview ? "Story overview" : "Story section"}</span><h1>{isOverview ? project.title || "Untitled Story" : title}</h1></div>{isOverview && <StoryOverviewMeta isViewOnly={isViewOnly} project={project} onChange={onChangeProject} />}<div className="document-layout"><div className="editor-paper"><NodeRenderer node={activeNode} chapterNumber={chapterNumber} isViewOnly={isViewOnly} onOpenScript={onOpenScript} onChange={onChangeNode} onRequestAddChild={onRequestAddChild} onRemove={onRemoveNode} onRemoveListItem={onRemoveListItem} /></div>{isViewOnly && <nav className="hierarchy-nav" aria-label="Section hierarchy"><span className="hierarchy-heading">ON THIS PAGE</span><ul><HierarchyList node={activeNode} /></ul></nav>}</div></section>;
}