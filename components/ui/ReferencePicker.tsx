"use client";

import { useState } from "react";

export type ReferenceOption = { id: string; label: string };

type ReferencePickerProps = { isOpen: boolean; title: string; options: ReferenceOption[]; selectedIds: string[]; onCancel: () => void; onConfirm: (ids: string[]) => void };

export function ReferencePicker({ isOpen, title, options, selectedIds, onCancel, onConfirm }: ReferencePickerProps) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(selectedIds);
  if (!isOpen) return null;
  const matches = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}><form className="confirm-modal reference-picker" role="dialog" aria-modal="true" aria-labelledby="reference-picker-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onConfirm(selection); }}><h2 id="reference-picker-title">{title}</h2><label className="modal-field"><span>Search</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." /></label><div className="reference-options">{matches.length ? matches.map((option) => <label key={option.id}><input type="checkbox" checked={selection.includes(option.id)} onChange={() => setSelection((current) => current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id])} />{option.label}</label>) : <p>No matches</p>}</div><div className="modal-actions"><button className="modal-cancel" type="button" onClick={onCancel}>Cancel</button><button className="modal-add" type="submit">Apply</button></div></form></div>;
}