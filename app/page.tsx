"use client";

import { useRef, useState } from "react";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { ProjectSidebar } from "@/components/editor/ProjectSidebar";
import { AddChildModal } from "@/components/ui/AddChildModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ScriptStudio } from "@/components/script-editor/ScriptStudio";
import { createChapterTemplate, createCharacterTemplate, createVolumeTemplate, storyWriterStarterProject } from "@/lib/schema/defaults";
import { addChild, createNode, removeNode, updateNode } from "@/lib/schema/tree";
import type { NodeType, StoryNode, StoryProject } from "@/lib/schema/types";
import { createScriptDocument } from "@/lib/script/types";

type PendingDelete = { itemName: string; onConfirm: () => void };
type PendingChild = { parentId: string; parentName: string };

export default function Home() {
  const [project, setProject] = useState(storyWriterStarterProject);
  const [activeId, setActiveId] = useState("overview");
  const [activeView, setActiveView] = useState<"story" | "script">("story");
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState("Not saved yet");
  const [canUndo, setCanUndo] = useState(false);
  const loadInputRef = useRef<HTMLInputElement>(null);
  const projectHistoryRef = useRef<StoryProject[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingChild, setPendingChild] = useState<PendingChild | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const activeNode = findNode(project.nodes, activeId) ?? project.nodes[0];

  const updateProject = (recipe: (current: StoryProject) => StoryProject) => {
    setProject((current) => {
      const next = recipe(current);
      if (next !== current) projectHistoryRef.current = [...projectHistoryRef.current.slice(-49), current];
      return next;
    });
    setCanUndo(true);
  };
  const changeNode = (id: string, changes: Partial<StoryNode>) => updateProject((current) => ({ ...current, nodes: updateNode(current.nodes, id, changes) }));
  const changeProject = (changes: Partial<StoryProject>) => updateProject((current) => ({ ...current, ...changes }));
  const addNode = (parentId: string, type: NodeType, label: string) => updateProject((current) => ({ ...current, nodes: addChild(current.nodes, parentId, createNode(type, label)) }));
  const removeNodeNow = (id: string) => updateProject((current) => {
    const nodes = removeNode(current.nodes, id);
    if (activeId === id) setActiveId(nodes[0]?.id ?? "");
    if (activeScriptId && !findNode(nodes, activeScriptId)) { setActiveScriptId(null); setActiveView("story"); }
    return { ...current, nodes };
  });
  const requestDelete = (itemName: string, bypassConfirmation: boolean, onConfirm: () => void) => {
    if (bypassConfirmation) onConfirm();
    else setPendingDelete({ itemName, onConfirm });
  };
  const deleteNode = (id: string, label: string, bypassConfirmation: boolean) => requestDelete(label, bypassConfirmation, () => removeNodeNow(id));
  const deleteListItem = (id: string, index: number, item: string, bypassConfirmation: boolean) => requestDelete(item || "this list item", bypassConfirmation, () => updateProject((current) => {
    const node = findNode(current.nodes, id);
    return { ...current, nodes: updateNode(current.nodes, id, { items: node?.items?.filter((_, itemIndex) => itemIndex !== index) ?? [] }) };
  }));
  const addTopLevelSection = () => {
    if (!newSectionName.trim()) return;
    const node = createNode("section", newSectionName.trim());
    updateProject((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setActiveId(node.id);
    setNewSectionName("");
  };
  const openScript = (id: string) => {
    updateProject((current) => {
      const node = findNode(current.nodes, id);
      return node?.script ? current : { ...current, nodes: updateNode(current.nodes, id, { script: createScriptDocument() }) };
    });
    setActiveScriptId(id);
    setActiveView("script");
  };
  const activeScript = activeScriptId ? findNode(project.nodes, activeScriptId) : undefined;
  const activeParent = findParentNode(project.nodes, activeId);
  const activeChapterNumber = activeParent?.label === "Chapters" ? (activeParent.children?.findIndex((node) => node.id === activeId) ?? -1) + 1 : undefined;
  const closeScript = () => {
    const chapter = activeScriptId ? findParentNode(project.nodes, activeScriptId) : undefined;
    if (chapter) setActiveId(chapter.id);
    setActiveView("story");
  };
  const undoProject = () => {
    const previous = projectHistoryRef.current.pop();
    if (!previous) return;
    setProject(previous);
    if (!findNode(previous.nodes, activeId)) setActiveId(previous.nodes[0]?.id ?? "");
    if (activeScriptId && !findNode(previous.nodes, activeScriptId)) { setActiveScriptId(null); setActiveView("story"); }
    setCanUndo(projectHistoryRef.current.length > 0);
    setSavedAt("Undid last change");
  };
  const saveProject = () => {
    const file = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "story-project"}.storyproj`;
    link.click();
    URL.revokeObjectURL(url);
    setSavedAt("Project saved to Downloads");
  };
  const loadProject = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loadedProject: unknown = JSON.parse(String(reader.result));
        if (!isStoryProject(loadedProject)) throw new Error("Invalid project");
        setProject(loadedProject);
        projectHistoryRef.current = [];
        setCanUndo(false);
        setActiveId(loadedProject.nodes[0]?.id ?? "");
        setActiveScriptId(null);
        setActiveView("story");
        setSavedAt(`Loaded ${file.name}`);
      } catch {
        setSavedAt("Could not load that project file");
      } finally {
        if (loadInputRef.current) loadInputRef.current.value = "";
      }
    };
    reader.onerror = () => setSavedAt("Could not read that project file");
    reader.readAsText(file);
  };

  return (
    <main className={`app-shell ${isSidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>Story Writer</span></div>
        <div className="project-name"><span className="project-dot" />{project.title || "Untitled Story"}</div>
        <div className="top-actions"><span className={`save-status ${savedAt.startsWith("Could not") ? "error" : ""}`} role="status">{savedAt}</span><button className="undo-button" type="button" onClick={undoProject} disabled={!canUndo} title="Undo last project change">Undo</button><input ref={loadInputRef} className="project-load-input" type="file" accept=".storyproj,application/json" onChange={(event) => loadProject(event.target.files?.[0])} /><button className="load-button" type="button" onClick={() => loadInputRef.current?.click()}>Load project</button><button className={`view-mode-button ${isViewOnly ? "active" : ""}`} type="button" onClick={() => setIsViewOnly((current) => !current)}>{isViewOnly ? "Edit mode" : "View mode"}</button><button className="save-button" type="button" onClick={saveProject}>Save project</button></div>
      </header>
      <div className="workspace">
        <ProjectSidebar activeId={activeId} isCollapsed={isSidebarCollapsed} newSectionName={newSectionName} nodes={project.nodes} onAddSection={addTopLevelSection} onNewSectionNameChange={setNewSectionName} onSelect={(id) => { setActiveId(id); setActiveView("story"); }} onToggle={() => setIsSidebarCollapsed(true)} />
        {isSidebarCollapsed && <button className="show-sidebar-button" type="button" title="Show sidebar" aria-label="Show sidebar" onClick={() => setIsSidebarCollapsed(false)}>›</button>}
        {activeView === "script" && activeScript ? <ScriptStudio document={activeScript.script ?? createScriptDocument()} onChange={(script) => changeNode(activeScript.id, { script })} onClose={closeScript} /> : <EditorCanvas activeNode={activeNode} chapterNumber={activeChapterNumber} isViewOnly={isViewOnly} project={project} onOpenScript={openScript} onRequestAddChild={(parentId, parentName) => setPendingChild({ parentId, parentName })} onChangeNode={changeNode} onChangeProject={changeProject} onRemoveNode={deleteNode} onRemoveListItem={deleteListItem} />}
      </div>
      <AddChildModal canAddChapter={pendingChild?.parentName === "Chapters"} canAddCharacter={pendingChild?.parentId === "main-cast"} canAddVolume={pendingChild?.parentId === "volumes"} isOpen={Boolean(pendingChild)} parentName={pendingChild?.parentName ?? ""} onCancel={() => setPendingChild(null)} onConfirm={(type, label, characterLevel) => { if (pendingChild) updateProject((current) => ({ ...current, nodes: addChild(current.nodes, pendingChild.parentId, type === "character" ? createCharacterTemplate(label, characterLevel ?? 1) : type === "chapter" ? createChapterTemplate() : type === "volume" ? createVolumeTemplate() : createNode(type, label)) })); setPendingChild(null); }} />
      <ConfirmModal isOpen={Boolean(pendingDelete)} itemName={pendingDelete?.itemName ?? ""} onCancel={() => setPendingDelete(null)} onConfirm={() => { pendingDelete?.onConfirm(); setPendingDelete(null); }} />
    </main>
  );
}

function findNode(nodes: StoryNode[], id: string): StoryNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = node.children && findNode(node.children, id);
    if (child) return child;
  }
}

function findParentNode(nodes: StoryNode[], id: string): StoryNode | undefined {
  for (const node of nodes) {
    if (node.children?.some((child) => child.id === id)) return node;
    const parent = node.children && findParentNode(node.children, id);
    if (parent) return parent;
  }
}

function isStoryProject(value: unknown): value is StoryProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<StoryProject>;
  return typeof project.title === "string" && typeof project.author === "string" && typeof project.genre === "string" && typeof project.structure === "string" && Array.isArray(project.nodes);
}
