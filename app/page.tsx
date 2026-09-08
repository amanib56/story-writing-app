"use client";

import "./save-feedback.css";
import { useEffect, useRef, useState } from "react";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { ProjectSidebar } from "@/components/editor/ProjectSidebar";
import { AddChildModal } from "@/components/ui/AddChildModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ScriptStudio } from "@/components/script-editor/ScriptStudio";
import { createArcTemplate, createChapterTemplate, createCharacterTemplate, createVolumeTemplate, storyWriterStarterProject } from "@/lib/schema/defaults";
import { addChild, createNode, duplicateNode, moveNode, removeNode, updateNode } from "@/lib/schema/tree";
import type { NodeType, StoryNode, StoryProject } from "@/lib/schema/types";
import { createScriptDocument } from "@/lib/script/types";
import type { ReferenceOption } from "@/components/ui/ReferencePicker";

type PendingDelete = { itemName: string; onConfirm: () => void };
type PendingChild = { parentId: string; parentName: string };

export default function Home() {
  const [project, setProject] = useState(storyWriterStarterProject);
  const [activeId, setActiveId] = useState("overview");
  const [activeView, setActiveView] = useState<"story" | "script">("story");
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState("Not saved yet");
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);
  const saveNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectHistoryRef = useRef<StoryProject[]>([]);
  const redoHistoryRef = useRef<StoryProject[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingChild, setPendingChild] = useState<PendingChild | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const activeNode = findNode(project.nodes, activeId) ?? project.nodes[0];
  const referenceOptions = getReferenceOptions(project.nodes);
  const linkedVolumeIds = getLinkedVolumeIds(project.nodes, referenceOptions.volumes);

  const updateProject = (recipe: (current: StoryProject) => StoryProject) => {
    setProject((current) => {
      const next = recipe(current);
      if (next !== current) {
        projectHistoryRef.current = [...projectHistoryRef.current.slice(-49), current];
        redoHistoryRef.current = [];
      }
      return next;
    });
    setCanUndo(true);
    setCanRedo(false);
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
  const activeVolumeNumber = activeParent?.id === "volumes" ? (activeParent.children?.findIndex((node) => node.id === activeId) ?? -1) + 1 : undefined;
  const closeScript = () => {
    const chapter = activeScriptId ? findParentNode(project.nodes, activeScriptId) : undefined;
    if (chapter) setActiveId(chapter.id);
    setActiveView("story");
  };
  const undoProject = () => {
    const previous = projectHistoryRef.current.pop();
    if (!previous) return;
    redoHistoryRef.current = [...redoHistoryRef.current.slice(-49), project];
    setProject(previous);
    if (!findNode(previous.nodes, activeId)) setActiveId(previous.nodes[0]?.id ?? "");
    if (activeScriptId && !findNode(previous.nodes, activeScriptId)) { setActiveScriptId(null); setActiveView("story"); }
    setCanUndo(projectHistoryRef.current.length > 0);
    setCanRedo(true);
    setSavedAt("Undid last change");
  };
  const redoProject = () => {
    const next = redoHistoryRef.current.pop();
    if (!next) return;
    projectHistoryRef.current = [...projectHistoryRef.current.slice(-49), project];
    setProject(next);
    setCanUndo(true);
    setCanRedo(redoHistoryRef.current.length > 0);
    setSavedAt("Redid last change");
  };
  const showSaveNotice = (message: string) => {
    if (saveNoticeTimeoutRef.current) clearTimeout(saveNoticeTimeoutRef.current);
    setSaveNotice(message);
    saveNoticeTimeoutRef.current = setTimeout(() => setSaveNotice(null), 3000);
  };
  const saveProject = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (window.storyWriter) {
        const result = await window.storyWriter.saveProject(project, projectPath);
        if (!result) return;
        if (result.error) { setSavedAt(result.error); return; }
        const fileName = result.path?.split(/[\\/]/).pop() ?? "project";
        setProjectPath(result.path ?? projectPath);
        setSavedAt(`Saved ${fileName}`);
        showSaveNotice(`Saved ${fileName}`);
        return;
      }
      const file = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "story-project"}.storyproj`;
      link.click();
      URL.revokeObjectURL(url);
      setSavedAt("Project saved to Downloads");
      showSaveNotice("Project saved to Downloads");
    } finally {
      setIsSaving(false);
    }
  };
  const restoreProject = (content: string, name: string, path: string | null) => {
    try {
      const loadedProject: unknown = JSON.parse(content);
      if (!isStoryProject(loadedProject)) throw new Error("Invalid project");
      setProject(loadedProject);
      projectHistoryRef.current = [];
      redoHistoryRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
      setProjectPath(path);
      setActiveId(loadedProject.nodes[0]?.id ?? "");
      setActiveScriptId(null);
      setActiveView("story");
      setSavedAt(`Loaded ${name}`);
    } catch {
      setSavedAt("Could not load that project file");
    }
  };
  const loadProject = async (file?: File) => {
    if (window.storyWriter) {
      const result = await window.storyWriter.openProject();
      if (!result) return;
      if (result.error || !result.content || !result.path) { setSavedAt(result.error ?? "Could not load that project file"); return; }
      restoreProject(result.content, result.path.split(/[\\/]/).pop() ?? "project", result.path);
      return;
    }
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      restoreProject(String(reader.result), file.name, null);
      if (loadInputRef.current) loadInputRef.current.value = "";
    };
    reader.onerror = () => setSavedAt("Could not read that project file");
    reader.readAsText(file);
  };
  const duplicate = (id: string) => updateProject((current) => ({ ...current, nodes: duplicateNode(current.nodes, id) }));
  const move = (id: string, direction: -1 | 1) => updateProject((current) => ({ ...current, nodes: moveNode(current.nodes, id, direction) }));
  const changeArcVolumes = (fieldId: string, volumeIds: string[]) => updateProject((current) => {
    const arc = findParentNode(current.nodes, fieldId);
    const volumes = findNode(current.nodes, "volumes")?.children ?? [];
    if (!arc) return current;
    const selectedVolumeIds = new Set(volumeIds);
    let nodes = current.nodes;
    for (const volume of volumes) {
      const coveredArcs = volume.children?.find((child) => child.label === "Arcs Covered");
      if (!coveredArcs) continue;
      const references = coveredArcs.references ?? [];
      const nextReferences = selectedVolumeIds.has(volume.id) ? [...new Set([...references, arc.id])] : references.filter((id) => id !== arc.id);
      nodes = updateNode(nodes, coveredArcs.id, { references: nextReferences });
    }
    return { ...current, nodes };
  });
  useEffect(() => () => {
    if (saveNoticeTimeoutRef.current) clearTimeout(saveNoticeTimeoutRef.current);
  }, []);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redoProject() : undoProject(); }
      if (event.key.toLowerCase() === "y") { event.preventDefault(); redoProject(); }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void saveProject(); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  return (
    <main className={`app-shell ${isSidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>Story Writer</span></div>
        <div className="project-name"><span className="project-dot" />{project.title || "Untitled Story"}</div>
        <div className="top-actions"><span className={`save-status ${savedAt.startsWith("Could not") ? "error" : ""}`} role="status">{savedAt}</span><button className="undo-button" type="button" onClick={undoProject} disabled={!canUndo} title="Undo (Ctrl+Z)">Undo</button><button className="undo-button" type="button" onClick={redoProject} disabled={!canRedo} title="Redo (Ctrl+Y)">Redo</button><input ref={loadInputRef} className="project-load-input" type="file" accept=".storyproj,application/json" onChange={(event) => loadProject(event.target.files?.[0])} /><button className="load-button" type="button" onClick={() => window.storyWriter ? loadProject() : loadInputRef.current?.click()}>Load project</button><button className={`view-mode-button ${isViewOnly ? "active" : ""}`} type="button" onClick={() => setIsViewOnly((current) => !current)}>{isViewOnly ? "Edit mode" : "View mode"}</button><button className="save-button" type="button" onClick={saveProject} disabled={isSaving}>{isSaving ? "Saving..." : "Save project"}</button></div>
      </header>
      {saveNotice && <div className="save-notice" role="status" aria-live="polite">{saveNotice}</div>}
      <div className="workspace">
        <ProjectSidebar activeId={activeId} isCollapsed={isSidebarCollapsed} newSectionName={newSectionName} nodes={project.nodes} onAddSection={addTopLevelSection} onNewSectionNameChange={setNewSectionName} onSelect={(id) => { setActiveId(id); setActiveView("story"); }} onToggle={() => setIsSidebarCollapsed(true)} />
        {isSidebarCollapsed && <button className="show-sidebar-button" type="button" title="Show sidebar" aria-label="Show sidebar" onClick={() => setIsSidebarCollapsed(false)}>›</button>}
        {activeView === "script" && activeScript ? <ScriptStudio document={activeScript.script ?? createScriptDocument()} onChange={(script) => changeNode(activeScript.id, { script })} onClose={closeScript} /> : <EditorCanvas activeNode={activeNode} chapterNumber={activeChapterNumber} isViewOnly={isViewOnly} linkedVolumeIds={linkedVolumeIds} project={project} referenceOptions={referenceOptions} volumeNumber={activeVolumeNumber} onChangeArcVolumes={changeArcVolumes} onDuplicateNode={duplicate} onMoveNode={move} onNavigateNode={(id) => { setActiveId(id); setActiveView("story"); }} onOpenScript={openScript} onRequestAddChild={(parentId, parentName) => setPendingChild({ parentId, parentName })} onChangeNode={changeNode} onChangeProject={changeProject} onRemoveNode={deleteNode} onRemoveListItem={deleteListItem} />}
      </div>
      <AddChildModal canAddArc={pendingChild?.parentId === "arcs"} canAddChapter={pendingChild?.parentName === "Chapters"} canAddCharacter={pendingChild?.parentId === "main-cast"} canAddVolume={pendingChild?.parentId === "volumes"} isOpen={Boolean(pendingChild)} parentName={pendingChild?.parentName ?? ""} onCancel={() => setPendingChild(null)} onConfirm={(type, label, characterLevel) => { if (pendingChild) updateProject((current) => ({ ...current, nodes: addChild(current.nodes, pendingChild.parentId, type === "arc" ? createArcTemplate() : type === "character" ? createCharacterTemplate(label, characterLevel ?? 1) : type === "chapter" ? createChapterTemplate() : type === "volume" ? createVolumeTemplate() : createNode(type, label)) })); setPendingChild(null); }} />
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

function getReferenceOptions(nodes: StoryNode[]) {
  const characters = findNode(nodes, "characters");
  const arcs = findNode(nodes, "arcs");
  const volumes = findNode(nodes, "volumes");
  return {
    characters: collectNodes(characters?.children ?? [], (node) => Boolean(node.children?.some((child) => child.id.endsWith("-mbti")) && node.children?.some((child) => child.id.endsWith("-enneagram")))).map(toReferenceOption),
    arcs: (arcs?.children ?? []).map(toReferenceOption),
    volumes: (volumes?.children ?? []).map((node, index) => ({ id: node.id, label: `Volume ${index + 1}` })),
  };
}

function getLinkedVolumeIds(nodes: StoryNode[], volumes: ReferenceOption[]) {
  const arcs = findNode(nodes, "arcs")?.children ?? [];
  const arcVolumeFields = new Map(arcs.map((arc) => [arc.id, arc.children?.find((child) => child.label === "Volumes Covered")?.id]).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const links: Record<string, string[]> = {};
  for (const volume of volumes) {
    const volumeNode = findNode(nodes, volume.id);
    const coveredArcs = volumeNode?.children?.find((child) => child.label === "Arcs Covered")?.references ?? [];
    for (const arcId of coveredArcs) {
      const fieldId = arcVolumeFields.get(arcId);
      if (fieldId) links[fieldId] = [...(links[fieldId] ?? []), volume.id];
    }
  }
  return links;
}

function collectNodes(nodes: StoryNode[], matches: (node: StoryNode) => boolean): StoryNode[] {
  return nodes.flatMap((node) => [ ...(matches(node) ? [node] : []), ...collectNodes(node.children ?? [], matches) ]);
}

function toReferenceOption(node: StoryNode): ReferenceOption {
  return { id: node.id, label: node.label || "Untitled entry" };
}
