import type { NodeType, StoryNode } from "./types";

export function createNode(type: NodeType, label: string): StoryNode {
  const id = `${type}-${crypto.randomUUID()}`;

  if (type === "section") return { id, label, type, children: [] };
  if (type === "list") return { id, label, type, items: [] };
  if (type === "rank") return { id, label, type, value: "D", options: ["D", "C", "B", "A"] };
  return { id, label, type, value: "" };
}

export function updateNode(nodes: StoryNode[], id: string, changes: Partial<StoryNode>): StoryNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, ...changes };
    return node.children ? { ...node, children: updateNode(node.children, id, changes) } : node;
  });
}

export function addChild(nodes: StoryNode[], parentId: string, child: StoryNode): StoryNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) return { ...node, children: [...(node.children ?? []), child] };
    return node.children ? { ...node, children: addChild(node.children, parentId, child) } : node;
  });
}

export function removeNode(nodes: StoryNode[], id: string): StoryNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.children ? { ...node, children: removeNode(node.children, id) } : node));
}