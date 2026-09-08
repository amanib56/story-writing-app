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

export function duplicateNode(nodes: StoryNode[], id: string): StoryNode[] {
  return nodes.flatMap((node) => {
    if (node.id === id) return [node, cloneNode(node)];
    return [node.children ? { ...node, children: duplicateNode(node.children, id) } : node];
  });
}

export function moveNode(nodes: StoryNode[], id: string, direction: -1 | 1): StoryNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const target = index + direction;
    if (target < 0 || target >= nodes.length) return nodes;
    const reordered = [...nodes];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    return reordered;
  }
  return nodes.map((node) => node.children ? { ...node, children: moveNode(node.children, id, direction) } : node);
}

function cloneNode(node: StoryNode): StoryNode {
  const id = `${node.type}-${crypto.randomUUID()}`;
  return { ...node, id, label: `${node.label} copy`, items: node.items && [...node.items], options: node.options && [...node.options], script: node.script && { ...node.script }, children: node.children?.map(cloneNode) };
}