import type { StoryProject } from "@/lib/schema/types";

declare global {
  interface Window {
    storyWriter?: {
      openProject: () => Promise<{ path?: string; content?: string; error?: string } | null>;
      saveProject: (project: StoryProject, currentPath: string | null) => Promise<{ path?: string; error?: string } | null>;
    };
  }
}

export {};