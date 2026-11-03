const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_RECENT_PROJECTS = 20;

function recentProjectsPath() {
  return path.join(app.getPath("userData"), "recent-projects.json");
}

async function readRecentProjects() {
  try {
    const stored = JSON.parse(await fs.readFile(recentProjectsPath(), "utf8"));
    if (!Array.isArray(stored)) return [];
    const projects = [];
    for (const project of stored) {
      if (!project || typeof project.path !== "string") continue;
      try {
        await fs.access(project.path);
        projects.push({
          id: project.path,
          path: project.path,
          name: path.basename(project.path),
          lastOpened: Number(project.lastOpened) || 0,
        });
      } catch {
        continue;
      }
    }
    return projects.sort((left, right) => right.lastOpened - left.lastOpened).slice(0, MAX_RECENT_PROJECTS);
  } catch {
    return [];
  }
}

async function writeRecentProjects(projects) {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(recentProjectsPath(), JSON.stringify(projects.slice(0, MAX_RECENT_PROJECTS), null, 2), "utf8");
}

async function rememberProject(filePath) {
  const projects = await readRecentProjects();
  const next = [
    { path: filePath, lastOpened: Date.now() },
    ...projects.filter((project) => path.resolve(project.path) !== path.resolve(filePath)),
  ];
  await writeRecentProjects(next);
}

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
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, "utf8");
    await rememberProject(filePath);
    return { path: filePath, content };
  } catch {
    return { error: "Could not read that project file" };
  }
});

ipcMain.handle("project:recent-list", () => readRecentProjects());

ipcMain.handle("project:open-recent", async (_event, filePath) => {
  if (typeof filePath !== "string") return { error: "Invalid recent project" };
  const projects = await readRecentProjects();
  const project = projects.find((entry) => path.resolve(entry.path) === path.resolve(filePath));
  if (!project) return { error: "That recent project is no longer available" };
  try {
    const content = await fs.readFile(project.path, "utf8");
    await rememberProject(project.path);
    return { path: project.path, content };
  } catch {
    return { error: "Could not read that project file" };
  }
});

ipcMain.handle("project:recent-remove", async (_event, filePath) => {
  if (typeof filePath !== "string") return false;
  const projects = await readRecentProjects();
  await writeRecentProjects(projects.filter((project) => path.resolve(project.path) !== path.resolve(filePath)));
  return true;
});

ipcMain.handle("project:recent-clear", async () => {
  await writeRecentProjects([]);
  return true;
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
    await rememberProject(filePath);
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