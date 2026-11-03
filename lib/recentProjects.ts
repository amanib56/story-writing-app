import type { StoryProject } from "@/lib/schema/types";

export type RecentProject = {
  id: string;
  name: string;
  lastOpened: number;
  path?: string;
  content?: string;
};

const DATABASE_NAME = "story-writer-projects";
const STORE_NAME = "recent-projects";
const MAX_RECENT_PROJECTS = 20;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listBrowserRecentProjects(): Promise<RecentProject[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      resolve((request.result as RecentProject[]).sort((left, right) => right.lastOpened - left.lastOpened));
      database.close();
    };
    request.onerror = () => {
      reject(request.error);
      database.close();
    };
  });
}

export async function rememberBrowserProject(id: string, name: string, project: StoryProject): Promise<void> {
  const database = await openDatabase();
  const content = JSON.stringify(project);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put({ id, name, content, lastOpened: Date.now() } satisfies RecentProject);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => database.close());
  await trimRecentProjects();
}

export async function forgetBrowserProject(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => database.close());
}

export async function clearBrowserRecentProjects(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => database.close());
}

async function trimRecentProjects(): Promise<void> {
  const projects = await listBrowserRecentProjects();
  await Promise.all(projects.slice(MAX_RECENT_PROJECTS).map((project) => forgetBrowserProject(project.id)));
}