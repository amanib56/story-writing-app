"use client";

import type { StoryProject } from "@/lib/schema/types";

type StoryOverviewMetaProps = { isViewOnly: boolean; project: StoryProject; onChange: (changes: Partial<StoryProject>) => void };

export function StoryOverviewMeta({ isViewOnly, project, onChange }: StoryOverviewMetaProps) {
  if (isViewOnly) return <dl className="overview-meta overview-meta-read-only"><div><dt>Title</dt><dd>{project.title || "Untitled Story"}</dd></div><div><dt>Author</dt><dd>{project.author || "Not set"}</dd></div><div><dt>Genre</dt><dd>{project.genre || "Not set"}</dd></div><div><dt>Story structure</dt><dd>{project.structure || "Not set"}</dd></div></dl>;
  return <div className="overview-meta"><div className="overview-title-row"><input aria-label="Story title" className="story-title-input" value={project.title} placeholder="Story title" onChange={(event) => onChange({ title: event.target.value })} /><input aria-label="Author" value={project.author} placeholder="Author" onChange={(event) => onChange({ author: event.target.value })} /></div><div className="overview-details-row"><input aria-label="Genre" value={project.genre} placeholder="Genre" onChange={(event) => onChange({ genre: event.target.value })} /><input aria-label="Story structure" value={project.structure} placeholder="Story structure" onChange={(event) => onChange({ structure: event.target.value })} /></div></div>;
}