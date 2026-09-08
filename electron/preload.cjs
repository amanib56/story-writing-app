const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storyWriter", {
  openProject: () => ipcRenderer.invoke("project:open"),
  saveProject: (project, currentPath) => ipcRenderer.invoke("project:save", project, currentPath),
});