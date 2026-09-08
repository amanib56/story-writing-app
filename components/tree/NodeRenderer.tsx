"use client";

import { useState } from "react";
import type { StoryNode } from "@/lib/schema/types";
import { AutoResizeTextArea, RichTextField } from "@/components/ui/RichTextField";

type NodeRendererProps = {
  node: StoryNode;
  depth?: number;
  isViewOnly?: boolean;
  chapterNumber?: number;
  volumeNumber?: number;
  onOpenScript: (id: string) => void;
  onChange: (id: string, changes: Partial<StoryNode>) => void;
  onRequestAddChild: (parentId: string, parentName: string) => void;
  onRemove: (id: string, label: string, bypassConfirmation: boolean) => void;
  onRemoveListItem: (id: string, index: number, item: string, bypassConfirmation: boolean) => void;
};

export function NodeRenderer({ node, depth = 0, isViewOnly = false, chapterNumber, volumeNumber, onOpenScript, onChange, onRequestAddChild, onRemove, onRemoveListItem }: NodeRendererProps) {
  const [isOpen, setIsOpen] = useState(true);
  const mbtiNode = node.children?.find((child) => child.id.endsWith("-mbti"));
  const enneagramNode = node.children?.find((child) => child.id.endsWith("-enneagram"));
  const magicSystemNameNode = node.children?.find((child) => child.id === "magic-system-name");
  const isCharacterProfile = Boolean(mbtiNode && enneagramNode);
  const isMagicSystem = Boolean(magicSystemNameNode);
  const displayLabel = volumeNumber ? `Volume ${volumeNumber}` : chapterNumber ? `Chapter ${chapterNumber}` : node.label;

  if (node.type === "section") {
    return (
      <section id={`node-${node.id}`} className={`node-section ${isCharacterProfile ? "character-profile" : ""} ${isMagicSystem ? "magic-system-profile" : ""}`} style={{ "--node-depth": depth } as React.CSSProperties}>
        <div className={`section-heading ${isCharacterProfile ? "character-heading" : ""} ${isMagicSystem ? "magic-system-heading" : ""}`}>
          {isViewOnly ? <span className="view-only-disclosure">—</span> : <button className="disclosure" onClick={() => setIsOpen((open) => !open)} type="button" aria-label={`Toggle ${node.label}`} aria-expanded={isOpen}>{isOpen ? "—" : "+"}</button>}
          {isViewOnly || volumeNumber || chapterNumber ? <h2 className="section-title-read-only">{displayLabel}</h2> : <input className="section-title-input" aria-label="Section name" value={node.label} onChange={(event) => onChange(node.id, { label: event.target.value })} />}
          {isCharacterProfile && <>{isViewOnly ? <span className="identity-value"><small>MBTI</small>{mbtiNode?.value || "Not set"}</span> : <label className="identity-field"><span>MBTI</span><input aria-label="MBTI" value={mbtiNode?.value ?? ""} placeholder="e.g. INFP" onChange={(event) => onChange(mbtiNode!.id, { value: event.target.value })} /></label>}{isViewOnly ? <span className="identity-value"><small>Enneagram</small>{enneagramNode?.value || "Not set"}</span> : <label className="identity-field"><span>Enneagram</span><input aria-label="Enneagram and wing" value={enneagramNode?.value ?? ""} placeholder="e.g. 4w5" onChange={(event) => onChange(enneagramNode!.id, { value: event.target.value })} /></label>}</>}
          {isMagicSystem && (isViewOnly ? <span className="identity-value magic-name-field"><small>System Name</small>{magicSystemNameNode?.value || "Not set"}</span> : <label className="identity-field magic-name-field"><span>System Name</span><input aria-label="Magic system name" value={magicSystemNameNode?.value ?? ""} placeholder="e.g. Mana Orbs" onChange={(event) => onChange(magicSystemNameNode!.id, { value: event.target.value })} /></label>)}
          <span className="node-count">{node.children?.length ?? 0}</span>
          {!isViewOnly && <button className="icon-button icon-button-danger" type="button" title={`Delete ${node.label}. Hold Shift to skip confirmation.`} aria-label={`Delete ${node.label}`} onClick={(event) => onRemove(node.id, node.label, event.shiftKey)}>x</button>}
        </div>
        {(isViewOnly || isOpen) && node.children && (
          <div className="node-children">
            <div className={isCharacterProfile ? "character-fields" : undefined}>{node.children.filter((child) => child !== mbtiNode && child !== enneagramNode && child !==magicSystemNameNode).map((child, index) => <NodeRenderer key={child.id} node={child} depth={depth + 1} chapterNumber={node.label === "Chapters" ? index + 1 : undefined} volumeNumber={node.id === "volumes" ? index + 1 : undefined} isViewOnly={isViewOnly} onOpenScript={onOpenScript} onChange={onChange} onRequestAddChild={onRequestAddChild} onRemove={onRemove} onRemoveListItem={onRemoveListItem} />)}</div>
            {!isViewOnly && <button className="add-child-button" type="button" onClick={() => onRequestAddChild(node.id, node.label)} title={`Add child to ${node.label}`} aria-label={`Add child to ${node.label}`}>+</button>}
          </div>
        )}
      </section>
    );
  }

  if (node.type === "list") {
    return (
      <div id={`node-${node.id}`} className="field-block">
        <div className="field-header">{isViewOnly ? <h3 className="field-label-read-only">{node.label}</h3> : <><input className="field-label-input" aria-label="Field name" value={node.label} onChange={(event) => onChange(node.id, { label: event.target.value })} /><button className="icon-button icon-button-danger" type="button" title={`Delete ${node.label}. Hold Shift to skip confirmation.`} aria-label={`Delete ${node.label}`} onClick={(event) => onRemove(node.id, node.label, event.shiftKey)}>x</button></>}</div>
        <div className="list-editor">
          {(node.items ?? []).map((item, index) => isViewOnly ? <div className="list-item" key={`${node.id}-${index}`}><span className="list-bullet" />{item || "Not set"}</div> : (
            <div className="list-item" key={`${node.id}-${index}`}>
              <span className="list-bullet" />
              <input
                value={item}
                onChange={(event) => {
                  const items = [...(node.items ?? [])];
                  items[index] = event.target.value;
                  onChange(node.id, { items });
                }}
              />
              <button className="icon-button icon-button-danger list-remove-button" type="button" title={`Remove ${item || "list item"}. Hold Shift to skip confirmation.`} aria-label={`Remove ${item || "list item"}`} onClick={(event) => onRemoveListItem(node.id, index, item, event.shiftKey)}>x</button>
            </div>
          ))}
          {!isViewOnly && <button className="add-line" type="button" onClick={() => onChange(node.id, { items: [...(node.items ?? []), "New item"] })}>+ Add item</button>}
        </div>
      </div>
    );
  }

  if (node.type === "rank") {
    return (
      <div id={`node-${node.id}`} className="field-block rank-field">
        <div className="field-header">{isViewOnly ? <h3 className="field-label-read-only">{node.label}</h3> : <><input className="field-label-input" aria-label="Field name" value={node.label} onChange={(event) => onChange(node.id, { label: event.target.value })} /><button className="icon-button icon-button-danger" type="button" title={`Delete ${node.label}. Hold Shift to skip confirmation.`} aria-label={`Delete ${node.label}`} onClick={(event) => onRemove(node.id, node.label, event.shiftKey)}>x</button></>}</div>
        {isViewOnly ? <span className="rank-value">{node.value || "Not set"}</span> : <select value={node.value ?? ""} onChange={(event) => onChange(node.id, { value: event.target.value })}>
          {node.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>}
      </div>
    );
  }

  return (
    <div id={`node-${node.id}`} className={`field-block ${node.type === "script" ? "script-field" : ""}`}>
      <div className="field-header">{isViewOnly ? <h3 className="field-label-read-only">{node.label}</h3> : <><input className="field-label-input" aria-label="Field name" value={node.label} onChange={(event) => onChange(node.id, { label: event.target.value })} /><button className="icon-button icon-button-danger" type="button" title={`Delete ${node.label}. Hold Shift to skip confirmation.`} aria-label={`Delete ${node.label}`} onClick={(event) => onRemove(node.id, node.label, event.shiftKey)}>x</button></>}</div>
      {node.label === "Cover Image" ? <CoverImageField isViewOnly={isViewOnly} value={node.value ?? ""} onChange={(value) => onChange(node.id, { value })} /> : node.type === "script" ? <button className="open-script-button" type="button" onClick={() => onOpenScript(node.id)}>{node.script ? "Open Comic Script" : "Create Comic Script"}</button> : isViewOnly ? node.value ? <div className="field-value" dangerouslySetInnerHTML={{ __html: node.value }} /> : <p className="empty-value">Not set</p> : <RichTextField label={node.label} value={node.value ?? ""} onChange={(value) => onChange(node.id, { value })} placeholder={`Write ${node.label.toLowerCase()}...`} />}
    </div>
  );
}

function CoverImageField({ isViewOnly, onChange, value }: { isViewOnly: boolean; onChange: (value: string) => void; value: string }) {
  if (isViewOnly) return value ? <img className="cover-image-preview" src={value} alt="Volume cover" /> : <p className="empty-value">No cover image</p>;
  return <label className="cover-image-upload"><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onChange(String(reader.result)); reader.readAsDataURL(file); }} />{value ? <img className="cover-image-preview" src={value} alt="Selected volume cover" /> : <span>Upload cover image</span>}</label>;
}