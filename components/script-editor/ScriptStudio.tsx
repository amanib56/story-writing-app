"use client";

import { useRef } from "react";
import type { ScriptDocument } from "@/lib/script/types";

type ScriptStudioProps = { document: ScriptDocument; onChange: (document: ScriptDocument) => void; onClose: () => void };
type ParsedPanel = { description: string; lines: string[] };
type ParsedPage = { panels: ParsedPanel[]; spread: boolean };

const templates: Record<string, string> = {
  "1": "Page\nPanel\n",
  "2": "Panel\n.",
  "3": "\tCHARACTER (): content",
  "4": "\tCAPTION (): content",
  "5": "\tSFX (): content",
};

export function ScriptStudio({ document: script, onChange, onClose }: ScriptStudioProps) {
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const pages = parseScript(script.source);
  const names = rememberedNames(script.source);
  const replaceSource = (source: string) => onChange({ source, version: 1 });
  const insertTemplate = (key: string) => {
    const editor = sourceRef.current;
    if (!editor) return;
    const template = templates[key];
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const prefix = script.source.slice(0, start);
    const suffix = script.source.slice(end);
    const spacing = prefix && !prefix.endsWith("\n") ? "\n" : "";
    const trailing = suffix && !suffix.startsWith("\n") ? "\n" : "";
    const inserted = `${spacing}${template}${trailing}`;
    replaceSource(`${prefix}${inserted}${suffix}`);
    requestAnimationFrame(() => { editor.focus(); editor.setSelectionRange(start + inserted.length, start + inserted.length); });
  };
  return <section className="script-studio" onKeyDown={(event) => { if (event.altKey && !event.ctrlKey && !event.metaKey && templates[event.key]) { event.preventDefault(); insertTemplate(event.key); } }}>
    <div className="script-commandbar"><button type="button" onClick={onClose}>Back to chapter</button><button type="button" title="Alt+1" onClick={() => insertTemplate("1")}>Page</button><button type="button" title="Alt+2" onClick={() => insertTemplate("2")}>Panel</button><button type="button" title="Alt+3" onClick={() => insertTemplate("3")}>Balloon</button><button type="button" title="Alt+4" onClick={() => insertTemplate("4")}>Caption</button><button type="button" title="Alt+5" onClick={() => insertTemplate("5")}>SFX</button><span>{names.length ? `${names.length} character tag${names.length === 1 ? "" : "s"}` : ""}</span></div>
    <div className="script-workspace"><nav className="script-outline" aria-label="Script outline"><a href="#script-source">Top</a>{pages.map((page, pageIndex) => { const number = pageNumber(pages, pageIndex); return <div key={`${pageIndex}-${number}`}><a className="script-outline-page" href={`#script-source`}>Page {page.spread ? `${number}-${number + 1}` : number}</a>{page.panels.map((panel, panelIndex) => <a key={panelIndex} className="script-outline-panel" href="#script-source">{panelIndex + 1}. {panel.description || "Enter description..."}</a>)}</div>; })}</nav><main className="script-document"><div className="script-editor-shell"><pre aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightScript(script.source, pages) }} /><textarea id="script-source" className="script-editor" ref={sourceRef} value={script.source} onChange={(event) => replaceSource(event.target.value)} placeholder="Press Alt+1 to add a page" spellCheck aria-label="Comic script source" /></div></main></div>
  </section>;
}

function parseScript(source: string): ParsedPage[] {
  const pages: ParsedPage[] = [];
  let page: ParsedPage | undefined;
  let panel: ParsedPanel | undefined;
  source.replace(/\r/g, "").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (/^page\b/i.test(line)) { page = { panels: [], spread: /-\s*\d+\s*$/.test(line) }; pages.push(page); panel = undefined; return; }
    if (/^panel\b/i.test(line)) { if (!page) { page = { panels: [], spread: false }; pages.push(page); } panel = { description: "", lines: [] }; page.panels.push(panel); return; }
    if (!panel) return;
    if (/^(character|caption|sfx)\b/i.test(line)) panel.lines.push(line);
    else if (!panel.description && line) panel.description = line;
    else if (line) panel.lines.push(line);
  });
  return pages.length ? pages : [{ panels: [], spread: false }];
}

function pageNumber(pages: ParsedPage[], index: number) {
  return pages.slice(0, index).reduce((number, page) => number + (page.spread ? 2 : 1), 1);
}

function rememberedNames(source: string) {
  return [...new Set([...source.matchAll(/^\s*CHARACTER\s*\(([^)]*)\)/gim)].map((match) => match[1].trim()).filter(Boolean))];
}

function highlightScript(source: string, pages: ParsedPage[]) {
  let pageIndex = -1;
  let panelIndex = 0;
  return source.replace(/\r/g, "").split("\n").map((rawLine) => {
    const line = rawLine.trim();
    let className = "script-line-text";
    let display = escapeHtml(rawLine) || " ";
    if (/^page\b/i.test(line)) {
      pageIndex += 1;
      panelIndex = 0;
      const number = pageNumber(pages, pageIndex);
      className = "script-line-page";
      display = `Page ${pages[pageIndex]?.spread ? `${number}-${number + 1}` : number}`;
    } else if (/^panel\b/i.test(line)) {
      panelIndex += 1;
      className = "script-line-panel";
      display = `Panel ${panelIndex}`;
    } else if (/^(character|caption|sfx)\b/i.test(line)) className = "script-line-lettering";
    return `<span class="${className}">${display}</span>`;
  }).join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[character] ?? character);
}

