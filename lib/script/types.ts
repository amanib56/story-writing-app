export type ScriptDocument = {
  source: string;
  version: 1;
};

export function createScriptDocument(): ScriptDocument {
  return { source: "", version: 1 };
}