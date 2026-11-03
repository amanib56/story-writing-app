import type { StoryProject } from "@/lib/schema/types";
import type { RecentProject } from "@/lib/recentProjects";

declare global {
  interface Window {
    storyWriter?: {
      openProject: () => Promise<{ path?: string; content?: string; error?: string } | null>;
      saveProject: (project: StoryProject, currentPath: string | null) => Promise<{ path?: string; error?: string } | null>;
      listRecentProjects: () => Promise<RecentProject[]>;
      openRecentProject: (path: string) => Promise<{ path?: string; content?: string; error?: string } | null>;
      removeRecentProject: (path: string) => Promise<boolean>;
      clearRecentProjects: () => Promise<boolean>;
    };
  }
}

export {};