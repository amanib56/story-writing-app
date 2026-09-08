import type { ScriptDocument } from "@/lib/script/types";

export type NodeType = "section" | "text" | "list" | "rank" | "reference" | "script";

export type StoryNode = {
  id: string;
  label: string;
  type: NodeType;
  value?: string;
  items?: string[];
  options?: string[];
  references?: string[];
  children?: StoryNode[];
  script?: ScriptDocument;
};

export type StoryProject = {
  title: string;
  author: string;
  genre: string;
  structure: string;
  nodes: StoryNode[];
};