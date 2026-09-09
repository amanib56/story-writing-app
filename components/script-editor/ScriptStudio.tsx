"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ScriptDocument } from "@/lib/script/types";

type ScriptStudioProps = {
  document: ScriptDocument;
  onChange: (document: ScriptDocument) => void;
  onClose: () => void;
};

type LineType = "page" | "panel" | "tag" | "text";
type Line = { id: string; text: string };
type Suggestion = {
  lineId: string;
  top: number;
  left: number;
  rangeStart: number;
  rangeEnd: number;
  options: string[];
};

let idCounter = 0;
const newId = () => `line-${++idCounter}-${Date.now().toString(36)}`;

const PAGE_RE = /^page\b/i;
const PANEL_RE = /^panel\b/i;
const TAG_RE = /^(character|caption|sfx)\b/i;
const OPEN_TAG_RE = /^(\s*)CHARACTER\s*\(([^)]*)$/i;
const TAG_LINE_RE = /^(\s*)(CHARACTER|CAPTION|SFX)\s*\(([^)]*)\)(:?\s*)/i;

const templateText: Record<"3" | "4" | "5", { tag: string; template: string }> = {
  "3": { tag: "CHARACTER", template: "\tCHARACTER (): content" },
  "4": { tag: "CAPTION", template: "\tCAPTION (): content" },
  "5": { tag: "SFX", template: "\tSFX (): content" },
};

function lineType(text: string): LineType {
  const trimmed = text.trim();
  if (PAGE_RE.test(trimmed)) return "page";
  if (PANEL_RE.test(trimmed)) return "panel";
  if (TAG_RE.test(trimmed)) return "tag";
  return "text";
}

function linesFromSource(source: string): Line[] {
  const raw = source.replace(/\r/g, "").split("\n");
  return (raw.length ? raw : [""]).map((text) => ({ id: newId(), text }));
}

function sourceFromLines(lines: Line[]): string {
  return lines.map((line) => line.text).join("\n");
}

function computeBadges(lines: Line[]): Map<string, string> {
  const badges = new Map<string, string>();
  let pageNumber = 0;
  let panelIndex = 0;
  lines.forEach((line) => {
    const type = lineType(line.text);
    if (type === "page") {
      const isSpread = /-\s*\d*\s*$/.test(line.text.trim());
      const start = pageNumber + 1;
      pageNumber += isSpread ? 2 : 1;
      panelIndex = 0;
      badges.set(line.id, isSpread ? `Page ${start}-${start + 1}` : `Page ${start}`);
    } else if (type === "panel") {
      panelIndex += 1;
      badges.set(line.id, `Panel ${panelIndex}`);
    }
  });
  return badges;
}

function buildOutline(lines: Line[], badges: Map<string, string>) {
  const entries: { id: string; label: string; isPage: boolean }[] = [];
  let openPanelId: string | null = null;
  let description = "";
  const flush = () => {
    if (openPanelId) {
      entries.push({ id: openPanelId, label: description || "Enter description...", isPage: false });
    }
    openPanelId = null;
    description = "";
  };
  lines.forEach((line) => {
    const type = lineType(line.text);
    if (type === "page") {
      flush();
      entries.push({ id: line.id, label: badges.get(line.id) ?? "Page", isPage: true });
    } else if (type === "panel") {
      flush();
      openPanelId = line.id;
    } else if (openPanelId && !description && line.text.trim() && type !== "tag") {
      description = line.text.trim();
    }
  });
  flush();
  return entries;
}

function rememberedNames(lines: Line[]) {
  return [
    ...new Set(
      lines
        .map((line) => line.text.match(/^\s*CHARACTER\s*\(([^)]*)\)/i)?.[1]?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
}

// Real caret pixel position, straight from the Selection API — no mirror
// element needed, since this is genuinely contentEditable now.
function getCaretRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  if (rects.length) return rects[0];
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  range.insertNode(marker);
  const rect = marker.getBoundingClientRect();
  marker.remove();
  return rect;
}

export function ScriptStudio({ document: script, onChange, onClose }: ScriptStudioProps) {
  const [lines, setLines] = useState<Line[]>(() => linesFromSource(script.source));
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const isInternalUpdate = useRef(false);
  const elementsRef = useRef(new Map<string, HTMLDivElement>());
  const focusRequest = useRef<{ id: string; offset: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resync from an externally-changed document (e.g. switching chapters),
  // but ignore the echo of our own onChange call below.
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    setLines(linesFromSource(script.source));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.source]);

  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    const el = elementsRef.current.get(request.id);
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    const textNode = el.firstChild;
    if (textNode) {
      const offset = Math.min(request.offset, textNode.textContent?.length ?? 0);
      range.setStart(textNode, offset);
    } else {
      range.setStart(el, 0);
    }
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [lines]);

  const commit = (next: Line[]) => {
    setLines(next);
    isInternalUpdate.current = true;
    onChange({ source: sourceFromLines(next), version: 1 });
  };

  const registerRef = (id: string, el: HTMLDivElement | null) => {
    if (el) elementsRef.current.set(id, el);
    else elementsRef.current.delete(id);
  };

  const refocus = () => setLines((current) => [...current]);

  const handleTextChange = (id: string, text: string) => {
    const next = lines.map((line) => (line.id === id ? { ...line, text } : line));
    commit(next);
    updateSuggestion(id, text);
  };

  const updateSuggestion = (id: string, text: string) => {
    const selection = window.getSelection();
    const offset = selection?.anchorOffset ?? text.length;
    const before = text.slice(0, offset);
    const match = before.match(OPEN_TAG_RE);
    if (!match) {
      setSuggestion(null);
      return;
    }
    const query = match[2];
    const options = rememberedNames(lines).filter(
      (name) =>
        name.toLowerCase().startsWith(query.toLowerCase()) &&
        name.toLowerCase() !== query.toLowerCase(),
    );
    if (!options.length) {
      setSuggestion(null);
      return;
    }
    const rect = getCaretRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    const scrollLeft = containerRef.current?.scrollLeft ?? 0;
    setSuggestion({
      lineId: id,
      top: (rect?.bottom ?? 0) - (containerRect?.top ?? 0) + scrollTop,
      left: (rect?.left ?? 0) - (containerRect?.left ?? 0) + scrollLeft,
      rangeStart: offset - query.length,
      rangeEnd: offset,
      options,
    });
  };

  const applySuggestion = (name: string) => {
    if (!suggestion) return;
    const line = lines.find((l) => l.id === suggestion.lineId);
    if (!line) return;
    const nextText =
      line.text.slice(0, suggestion.rangeStart) + name + line.text.slice(suggestion.rangeEnd);
    handleTextChange(suggestion.lineId, nextText);
    focusRequest.current = { id: suggestion.lineId, offset: suggestion.rangeStart + name.length };
    setSuggestion(null);
  };

  const insertAtCaret = (id: string, textToInsert: string, caretOffsetInInsert: number) => {
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    const selection = window.getSelection();
    const pos = selection?.anchorOffset ?? line.text.length;
    const before = line.text.slice(0, pos);
    const after = line.text.slice(pos);
    const index = lines.findIndex((l) => l.id === id);
    const newLines = textToInsert.split("\n");
    if (newLines.length === 1) {
      const replacement: Line = { ...line, text: before + newLines[0] + after };
      commit([...lines.slice(0, index), replacement, ...lines.slice(index + 1)]);
      focusRequest.current = { id: line.id, offset: before.length + caretOffsetInInsert };
      return;
    }
    const replacement: Line[] = [];
    if (before) replacement.push({ ...line, text: before });
    let focusId = line.id;
    let runningOffset = 0;
    newLines.forEach((text, i) => {
      const lineId = i === 0 && !before ? line.id : newId();
      replacement.push({ id: lineId, text });
      if (runningOffset <= caretOffsetInInsert && caretOffsetInInsert <= runningOffset + text.length) {
        focusId = lineId;
      }
      runningOffset += text.length + 1;
    });
    if (after) replacement.push({ id: newId(), text: after });
    commit([...lines.slice(0, index), ...replacement, ...lines.slice(index + 1)]);
    const focusLine = replacement.find((l) => l.id === focusId)!;
    focusRequest.current = { id: focusId, offset: focusLine.text.length };
  };

  const insertTemplate = (key: string, lineId: string | null) => {
    const id = lineId ?? lines[lines.length - 1]?.id;
    if (!id) return;
    if (key === "1") {
      insertAtCaret(id, "Page\nPanel", 5); // caret lands right after "Panel"
      return;
    }
    if (key === "2") {
      insertAtCaret(id, "Panel", 5);
      return;
    }
    const tag = templateText[key as "3" | "4" | "5"];
    if (!tag) return;
    const caret = tag.tag.length + 3; // right after "TAG ("
    insertAtCaret(id, tag.template, caret);
  };

  const handleEnter = (id: string) => {
    const index = lines.findIndex((line) => line.id === id);
    if (index === -1) return;
    const current = lines[index];
    const selection = window.getSelection();
    const offset = selection?.anchorOffset ?? current.text.length;
    const before = current.text.slice(0, offset);
    const after = current.text.slice(offset);
    const newLine: Line = { id: newId(), text: after };
    const next = [...lines];
    next.splice(index, 1, { ...current, text: before }, newLine);
    commit(next);
    focusRequest.current = { id: newLine.id, offset: 0 };
  };

  const handleBackspaceMerge = (id: string) => {
    const index = lines.findIndex((line) => line.id === id);
    if (index <= 0) return;
    const previous = lines[index - 1];
    const current = lines[index];
    const mergedText = previous.text + current.text;
    const next = lines
      .filter((line) => line.id !== id)
      .map((line) => (line.id === previous.id ? { ...line, text: mergedText } : line));
    commit(next);
    focusRequest.current = { id: previous.id, offset: previous.text.length };
  };

  const handleTab = (id: string, event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    const selection = window.getSelection();
    const pos = selection?.anchorOffset ?? 0;
    const match = line.text.match(TAG_LINE_RE);
    if (match) {
      const openParen = match[0].indexOf("(");
      const closeParen = match[0].indexOf(")", openParen);
      if (pos <= closeParen + 1) {
        focusRequest.current = { id, offset: match[0].length };
        refocus();
        return;
      }
    }
    const nextText = `${line.text.slice(0, pos)}\t${line.text.slice(pos)}`;
    handleTextChange(id, nextText);
    focusRequest.current = { id, offset: pos + 1 };
  };

  const handleNav = (id: string, event: ReactKeyboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed) return;
    const index = lines.findIndex((l) => l.id === id);
    if (index === -1) return;
    const offset = selection.anchorOffset;
    const textLength = lines[index].text.length;

    if (event.key === "ArrowUp" && index > 0) {
      event.preventDefault();
      const target = lines[index - 1];
      focusRequest.current = { id: target.id, offset: Math.min(offset, target.text.length) };
      refocus();
      return;
    }
    if (event.key === "ArrowDown" && index < lines.length - 1) {
      event.preventDefault();
      const target = lines[index + 1];
      focusRequest.current = { id: target.id, offset: Math.min(offset, target.text.length) };
      refocus();
      return;
    }
    if (event.key === "ArrowLeft" && offset === 0 && index > 0) {
      event.preventDefault();
      const target = lines[index - 1];
      focusRequest.current = { id: target.id, offset: target.text.length };
      refocus();
      return;
    }
    if (event.key === "ArrowRight" && offset === textLength && index < lines.length - 1) {
      event.preventDefault();
      const target = lines[index + 1];
      focusRequest.current = { id: target.id, offset: 0 };
      refocus();
      return;
    }
  };

  const handleLineKeyDown = (id: string, event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (suggestion?.lineId === id) {
      if (event.key === "Escape") {
        setSuggestion(null);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && suggestion.options.length) {
        event.preventDefault();
        applySuggestion(suggestion.options[0]);
        return;
      }
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && "12345".includes(event.key)) {
      event.preventDefault();
      insertTemplate(event.key, id);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      handleEnter(id);
      return;
    }
    if (event.key === "Backspace") {
      const selection = window.getSelection();
      if (selection?.isCollapsed && selection.anchorOffset === 0) {
        event.preventDefault();
        handleBackspaceMerge(id);
        return;
      }
    }
    if (event.key === "Tab") {
      handleTab(id, event);
      return;
    }
    handleNav(id, event);
  };

  const badges = computeBadges(lines);
  const outline = buildOutline(lines, badges);
  const names = rememberedNames(lines);

  return (
    <section className="script-studio">
      <div className="script-commandbar">
        <button type="button" onClick={onClose}>
          Back to chapter
        </button>
        <button type="button" title="Alt+1" onClick={() => insertTemplate("1", activeLineId)}>
          Page
        </button>
        <button type="button" title="Alt+2" onClick={() => insertTemplate("2", activeLineId)}>
          Panel
        </button>
        <button type="button" title="Alt+3" onClick={() => insertTemplate("3", activeLineId)}>
          Balloon
        </button>
        <button type="button" title="Alt+4" onClick={() => insertTemplate("4", activeLineId)}>
          Caption
        </button>
        <button type="button" title="Alt+5" onClick={() => insertTemplate("5", activeLineId)}>
          SFX
        </button>
        <span>
          {names.length ? `${names.length} character tag${names.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      <div className="script-workspace">
        <nav className="script-outline" aria-label="Script outline">
          {outline.map((entry) =>
            entry.isPage ? (
              <a key={entry.id} className="script-outline-page" href={`#${entry.id}`}>
                {entry.label}
              </a>
            ) : (
              <a key={entry.id} className="script-outline-panel" href={`#${entry.id}`}>
                {entry.label}
              </a>
            ),
          )}
        </nav>
        <main className="script-document" ref={containerRef}>
          <div className="script-editor-shell">
            {lines.map((line, index) => {
              const type = lineType(line.text);
              const badge = badges.get(line.id);
              const isOnlyEmptyLine = lines.length === 1 && line.text === "";
              return (
                <div key={line.id} id={line.id} className={`script-line script-line-${type}`}>
                  {badge && (
                    <span className="script-line-badge" contentEditable={false}>
                      {badge}
                    </span>
                  )}
                  <div
                    ref={(el) => registerRef(line.id, el)}
                    className="script-line-input"
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label={`Script line ${index + 1}`}
                    data-placeholder={isOnlyEmptyLine ? "Press Alt+1 to add a page" : undefined}
                    onFocus={() => setActiveLineId(line.id)}
                    onInput={(event) =>
                      handleTextChange(line.id, (event.target as HTMLDivElement).textContent ?? "")
                    }
                    onKeyDown={(event) => handleLineKeyDown(line.id, event)}
                  />
                </div>
              );
            })}
            {suggestion && (
              <ul className="script-suggestions" style={{ top: suggestion.top, left: suggestion.left }}>
                {suggestion.options.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        applySuggestion(name);
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}