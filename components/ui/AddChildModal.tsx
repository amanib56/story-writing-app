"use client";

import { useState } from "react";
import type { CharacterTemplateLevel } from "@/lib/schema/defaults";
import type { NodeType } from "@/lib/schema/types";

type AddChildModalProps = {
  isOpen: boolean;
  canAddCharacter: boolean;
  canAddChapter: boolean;
  canAddVolume: boolean;
  parentName: string;
  onCancel: () => void;
  onConfirm: (type: NodeType | "character" | "chapter" | "volume", label: string, characterLevel?: CharacterTemplateLevel) => void;
};

const nodeTypes: Array<{ value: NodeType; label: string }> = [
  { value: "section", label: "Section" },
  { value: "text", label: "Text field" },
  { value: "list", label: "List" },
  { value: "rank", label: "Rank" },
  { value: "reference", label: "Reference" },
  { value: "script", label: "Comic script" },
];

export function AddChildModal({ canAddChapter, canAddCharacter, canAddVolume, isOpen, parentName, onCancel, onConfirm }: AddChildModalProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<NodeType | "character" | "chapter" | "volume">("text");
  const [characterLevel, setCharacterLevel] = useState<CharacterTemplateLevel>(1);

  if (!isOpen) return null;

  const submit = () => {
    if (type !== "volume" && type !== "chapter" && !label.trim()) return;
    onConfirm(type, label.trim(), type === "character" ? characterLevel : undefined);
    setLabel("");
    setType("text");
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
    <form className="confirm-modal add-child-modal" role="dialog" aria-modal="true" aria-labelledby="add-child-dialog-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <h2 id="add-child-dialog-title">Add child item</h2>
      <p>Adding to <strong>{parentName || "Untitled section"}</strong></p>
      <label className="modal-field"><span>Item type</span><select value={type} onChange={(event) => setType(event.target.value as NodeType | "character" | "chapter" | "volume")}>{canAddCharacter && <option value="character">Character profile</option>}{canAddChapter && <option value="chapter">Chapter template</option>}{canAddVolume && <option value="volume">Volume template</option>}{nodeTypes.map((nodeType) => <option key={nodeType.value} value={nodeType.value}>{nodeType.label}</option>)}</select></label>
      {type === "character" && <label className="modal-field"><span>Character level</span><select value={characterLevel} onChange={(event) => setCharacterLevel(Number(event.target.value) as CharacterTemplateLevel)}><option value={1}>Level 1 - Character and traits</option><option value={2}>Level 2 - Traits and Mana Orb Grades</option><option value={3}>Level 3 - Traits, grades, signature, and conjure</option></select></label>}
      {type !== "volume" && type !== "chapter" && <label className="modal-field"><span>Name</span><input autoFocus value={label} placeholder="Name this item" onChange={(event) => setLabel(event.target.value)} /></label>}
      <div className="modal-actions"><button className="modal-cancel" type="button" onClick={onCancel}>Cancel</button><button className="modal-add" type="submit" disabled={type !== "volume" && type !== "chapter" && !label.trim()}>Add</button></div>
    </form>
  </div>;
}