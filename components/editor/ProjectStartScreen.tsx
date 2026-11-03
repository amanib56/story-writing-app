"use client";

import type { RecentProject } from "@/lib/recentProjects";

type ProjectStartScreenProps = {
  recentProjects: RecentProject[];
  isLoadingRecent: boolean;
  onNewProject: () => void;
  onLoadProject: () => void;
  onOpenRecent: (project: RecentProject) => void;
  onRemoveRecent: (id: string) => void;
  onClearRecent: () => void;
};

export function ProjectStartScreen({ recentProjects, isLoadingRecent, onNewProject, onLoadProject, onOpenRecent, onRemoveRecent, onClearRecent }: ProjectStartScreenProps) {
  return (
    <main className="project-start-screen">
      <header className="start-brand"><span className="brand-mark">S</span><span>Story Writer</span></header>
      <section className="start-content" aria-labelledby="start-title">
        <p className="start-eyebrow">A clear page for your next story</p>
        <h1 id="start-title">Your writing desk</h1>
        <div className="start-actions">
          <button className="start-new-button" type="button" onClick={onNewProject}><span aria-hidden="true">＋</span>New project</button>
          <button className="start-load-button" type="button" onClick={onLoadProject}><span aria-hidden="true">↗</span>Load project</button>
        </div>

        <section className="recent-projects" aria-labelledby="recent-projects-title">
          <div className="recent-heading">
            <h2 id="recent-projects-title">Recent projects</h2>
            {recentProjects.length > 0 && <button type="button" onClick={onClearRecent}>Clear history</button>}
          </div>
          {isLoadingRecent ? <p className="recent-empty">Loading recent projects...</p> : recentProjects.length === 0 ? (
            <p className="recent-empty">Projects you open will appear here.</p>
          ) : (
            <ul className="recent-list">
              {recentProjects.map((project) => (
                <li key={project.id}>
                  <button className="recent-project-open" type="button" onClick={() => onOpenRecent(project)}>
                    <span className="recent-project-icon" aria-hidden="true">▤</span>
                    <span className="recent-project-info"><strong>{project.name}</strong><small>{new Date(project.lastOpened).toLocaleString()}</small></span>
                  </button>
                  <button className="recent-project-remove" type="button" aria-label={`Remove ${project.name} from recent projects`} title="Remove from recent projects" onClick={() => onRemoveRecent(project.id)}>×</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
      <footer className="start-footer">Projects stay on this device.</footer>
    </main>
  );
}