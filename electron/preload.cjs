const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storyWriter", {
  openProject: () => ipcRenderer.invoke("project:open"),
  saveProject: (project, currentPath) => ipcRenderer.invoke("project:save", project, currentPath),
  listRecentProjects: () => ipcRenderer.invoke("project:recent-list"),
  openRecentProject: (path) => ipcRenderer.invoke("project:open-recent", path),
  removeRecentProject: (path) => ipcRenderer.invoke("project:recent-remove", path),
  clearRecentProjects: () => ipcRenderer.invoke("project:recent-clear"),
});