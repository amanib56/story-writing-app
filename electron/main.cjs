const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#f3ede2",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  window.loadFile(path.join(__dirname, "..", "out", "index.html"));
}

ipcMain.handle("project:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "Load Story Writer project",
    filters: [{ name: "Story Writer project", extensions: ["storyproj", "json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  try {
    return { path: result.filePaths[0], content: await fs.readFile(result.filePaths[0], "utf8") };
  } catch {
    return { error: "Could not read that project file" };
  }
});

ipcMain.handle("project:save", async (_event, project, currentPath) => {
  let filePath = currentPath;
  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: "Save Story Writer project",
      defaultPath: `${safeFileName(project.title)}.storyproj`,
      filters: [{ name: "Story Writer project", extensions: ["storyproj"] }],
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }
  try {
    await fs.writeFile(filePath, JSON.stringify(project, null, 2), "utf8");
    return { path: filePath };
  } catch {
    return { error: "Could not save the project" };
  }
});

function safeFileName(title) {
  return String(title || "story-project").replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "story-project";
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});