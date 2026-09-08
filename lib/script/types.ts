export type ScriptDocument = {
  source: string;
  version: 1;
};

export function createScriptDocument(): ScriptDocument {
  return { source: "Page\nPanel\nEnter Desc...", version: 1 };
}