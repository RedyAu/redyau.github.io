import { createState, resetState } from "./model.js";
import { parseFile } from "./parser.js";

const $ = (id) => document.getElementById(id);

const landing = $("landing");
const app = $("app");
const drop = $("drop");
const fileInput = $("fileInput");
const progress = $("progress");
const progressText = $("progressText");
const progressBar = $("progressBar");

const btnReset = $("btnReset");
const btnDemo = $("btnDemo");

const chipStats = $("chipStats");
const treeEl = $("tree");

const currentPathEl = $("currentPath");
const dirTable = $("dirTable");
const dirBody = $("dirBody");
const sortHeaders = Array.from(document.querySelectorAll(".th.sort"));

const selectionEl = null;
const btnCollapseAll = $("btnCollapseAll");

const btnSearch = $("btnSearch");
const searchModal = $("searchModal");
const btnCloseSearch = $("btnCloseSearch");
const q = $("q");
const btnFind = $("btnFind");
const btnStopFind = $("btnStopFind");
const results = $("results");
const resultsMeta = $("resultsMeta");
const resultsList = $("resultsList");

const state = createState();

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const ui = {
  currentDirPath: "",
  sortKey: "name",
  sortAsc: true,
};

function fmtBytes(n) {
  if (!Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  const dp = i === 0 ? 0 : i <= 2 ? 1 : 2;
  return `${x.toFixed(dp)} ${units[i]}`;
}

function escHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showProgress(text, pct) {
  progress.classList.remove("hidden");
  progressText.textContent = text;
  progressBar.style.width = `${clamp(pct, 0, 100).toFixed(1)}%`;
}

function hideProgress() {
  progress.classList.add("hidden");
  progressBar.style.width = "0%";
}

function showLanding() {
  landing.classList.remove("hidden");
  app.classList.add("hidden");
  btnReset.classList.add("hidden");
}

function showApp() {
  landing.classList.add("hidden");
  app.classList.remove("hidden");
  btnReset.classList.remove("hidden");
}

function updateStatsChip() {
  const st = state.stats;
  const sizeStr = st.sizeKnownCount > 0 ? `, size~${fmtBytes(st.totalSize)}` : "";
  chipStats.textContent = `${st.files.toLocaleString()} files, ${st.dirs.toLocaleString()} dirs${sizeStr}`;
}

function updateToolbarButtons() {
  const hasContent = state.stats.files + state.stats.dirs > 0;
  btnDemo.classList.toggle("hidden", hasContent);
  btnSearch.classList.toggle("hidden", !hasContent);
}

function renderSelectionEmpty() {}
function renderSelection() {}

function clearTreeSelected() {
  const prev = treeEl.querySelector(".node.selected");
  if (prev) prev.classList.remove("selected");
}

function clearListSelected() {
  const prev = dirBody.querySelector(".row.selected");
  if (prev) prev.classList.remove("selected");
}

function setCurrentDir(path) {
  ui.currentDirPath = path || "";
  renderBreadcrumbs();
  renderDirListing();
}

function getDirNodeByPath(path) {
  const parts = (path || "").split("/").filter(Boolean);
  let node = state.root;
  for (const name of parts) {
    const child = node.children.get(name);
    if (!child) return null;
    node = child;
  }
  return node;
}

function selectDir(dirNode, path) {
  clearTreeSelected();
  if (dirNode.ui.nodeEl) dirNode.ui.nodeEl.classList.add("selected");
  clearListSelected();
  state.selected = { type: "dir", path: path || "", node: dirNode, meta: dirNode.meta };
  setCurrentDir(path || "");
}

function selectFile(fileEntry) {
  clearListSelected();
  state.selected = { type: "file", path: fileEntry.path, file: fileEntry, meta: fileEntry.meta };
}

function listSortValue(entry, key) {
  if (key === "name") return entry.name.toLowerCase();
  if (key === "size") return entry.size ?? -1;
  if (key === "time") return entry.time ?? "";
  if (key === "mode") return entry.mode ?? "";
  return entry.name.toLowerCase();
}

function renderDirListing() {
  dirBody.innerHTML = "";

  const node = getDirNodeByPath(ui.currentDirPath);
  if (!node) return;

  const entries = [];

  if (ui.currentDirPath) {
    entries.push({
      kind: "up",
      name: "..",
      path: ui.currentDirPath.split("/").slice(0, -1).join("/"),
      size: null,
      time: "",
      mode: "",
    });
  }

  for (const d of Array.from(node.children.values())) {
    entries.push({
      kind: "dir",
      name: d.name,
      path: ui.currentDirPath ? `${ui.currentDirPath}/${d.name}` : d.name,
      size: d.meta?.size ?? null,
      time: d.meta?.mtime ?? "",
      mode: d.meta?.mode ?? "",
      node: d,
      meta: d.meta ?? null,
      counts: `${d.children.size.toLocaleString()} dirs • ${d.files.length.toLocaleString()} files`,
    });
  }

  for (const f of node.files) {
    entries.push({
      kind: "file",
      name: f.name,
      path: f.path,
      size: f.meta?.size ?? null,
      time: f.meta?.mtime ?? "",
      mode: f.meta?.mode ?? "",
      file: f,
      meta: f.meta ?? null,
    });
  }

  const key = ui.sortKey;
  const asc = ui.sortAsc;

  const kindRank = (k) => (k === "up" ? 0 : k === "dir" ? 1 : 2);
  entries.sort((a, b) => {
    const kr = kindRank(a.kind) - kindRank(b.kind);
    if (kr !== 0) return kr;

    const av = listSortValue(a, key);
    const bv = listSortValue(b, key);

    if (typeof av === "number" && typeof bv === "number") {
      return asc ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return asc ? cmp : -cmp;
  });

  for (const e of entries) {
    const row = document.createElement("div");
    row.className = `row ${e.kind}`;
    row.dataset.kind = e.kind;
    row.dataset.path = e.path;

    const icon = e.kind === "dir" ? "D" : e.kind === "up" ? "↑" : "";
    const meta = e.kind === "dir" && e.counts ? `<div class="entry-meta">${escHtml(e.counts)}</div>` : "";

    row.innerHTML =
      `<div class="td name">` +
      `<div class="entry-name"><span class="entry-icon">${icon}</span>` +
      `<span class="label">${escHtml(e.name)}</span></div>` +
      `${meta}</div>` +
      `<div class="td small">${escHtml(e.size != null ? fmtBytes(e.size) : "")}</div>` +
      `<div class="td small">${escHtml(e.time || "")}</div>` +
      `<div class="td small">${escHtml(e.mode || "")}</div>`;

    row.addEventListener("click", () => {
      clearListSelected();
      row.classList.add("selected");

      if (e.kind === "up") {
        navigateTo(e.path, { push: true });
        return;
      }

      if (e.kind === "dir") {
        navigateTo(e.path, { push: true });
        return;
      }

      if (e.kind === "file") {
        selectFile(e.file);
      }
    });

    dirBody.appendChild(row);
  }
}

function renderRoot() {
  treeEl.innerHTML = "";
  state.root.ui.expanded = true;
  state.root.ui.rendered = false;
  const wrapper = document.createElement("div");
  treeEl.appendChild(wrapper);
  renderDirInto(state.root, wrapper, "");
  state.root.ui.rendered = true;
}

function renderDirInto(dirNode, parentEl, parentPath) {
  const path =
    parentPath === ""
      ? dirNode.name
      : dirNode.name
        ? `${parentPath}/${dirNode.name}`
        : parentPath;

  dirNode.ui.path = path;

  const wrapper = document.createElement("div");
  parentEl.appendChild(wrapper);

  let children;

  if (dirNode !== state.root) {
    const row = document.createElement("div");
    row.className = "node";
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-expanded", String(dirNode.ui.expanded));

    const toggle = document.createElement("div");
    toggle.className = "toggle";
    toggle.textContent = dirNode.ui.expanded ? "▾" : "▸";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = dirNode.name;

    row.appendChild(toggle);
    row.appendChild(name);
    row.addEventListener("click", () => {
      selectDir(dirNode, path);
      if (dirNode.ui.childrenEl) {
        toggleDir(dirNode, row, dirNode.ui.childrenEl);
      }
    });

    dirNode.ui.nodeEl = row;
    wrapper.appendChild(row);

    children = document.createElement("div");
    children.className = "children";
    children.classList.toggle("hidden", !dirNode.ui.expanded);
    wrapper.appendChild(children);
    dirNode.ui.childrenEl = children;
  } else {
    children = wrapper;
  }

  if (dirNode.ui.expanded) {
    renderDirChildren(dirNode, children, path);
  }

  dirNode.ui.containerEl = wrapper;
}

function applyDetailsColumns() {
  const hasDetails = state.stats.formatGuess !== "paths";
  dirTable.classList.toggle("details-simple", !hasDetails);
  if (!hasDetails) {
    ui.sortKey = "name";
    ui.sortAsc = true;
  }
  updateSortIndicators();
}

function updateSortIndicators() {
  for (const header of sortHeaders) {
    const key = header.dataset.key;
    if (key === ui.sortKey) {
      header.setAttribute("aria-sort", ui.sortAsc ? "ascending" : "descending");
    } else {
      header.setAttribute("aria-sort", "none");
    }
  }
}

function renderDirChildren(dirNode, childrenEl, dirPath) {
  if (dirNode.ui.rendered) return;

  const dirs = Array.from(dirNode.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const dirLimit = dirNode.ui.dirRenderLimit;

  const dirsToShow = dirs.slice(0, dirLimit);
  for (const d of dirsToShow) {
    d.ui.expanded = false;
    d.ui.rendered = false;
    renderDirInto(d, childrenEl, dirPath);
  }

  if (dirs.length > dirLimit) {
    const more = document.createElement("div");
    more.className = "more";
    const hiddenCount = dirs.length - dirLimit;
    more.innerHTML =
      `<div class="muted small">${hiddenCount.toLocaleString()} more folders</div>` +
      '<div class="btns" style="justify-content:flex-start;margin-top:6px">' +
      '<button class="primary">Show more</button></div>';

    const btn = more.querySelector("button");
    btn.addEventListener("click", () => {
      dirNode.ui.dirRenderLimit = Math.min(dirs.length, dirNode.ui.dirRenderLimit * 2);
      dirNode.ui.rendered = false;
      childrenEl.innerHTML = "";
      renderDirChildren(dirNode, childrenEl, dirPath);
    });

    childrenEl.appendChild(more);
  }

  dirNode.ui.rendered = true;
}

function toggleDir(dirNode, rowEl, childrenEl) {
  dirNode.ui.expanded = !dirNode.ui.expanded;
  rowEl.setAttribute("aria-expanded", String(dirNode.ui.expanded));

  const toggleEl = rowEl.querySelector(".toggle");
  toggleEl.textContent = dirNode.ui.expanded ? "▾" : "▸";

  childrenEl.classList.toggle("hidden", !dirNode.ui.expanded);
  if (dirNode.ui.expanded) {
    renderDirChildren(dirNode, childrenEl, dirNode.ui.path || "");
  }
}

function collapseAll() {
  const stack = [state.root];
  while (stack.length) {
    const node = stack.pop();
    for (const child of node.children.values()) {
      child.ui.expanded = false;
      if (child.ui.nodeEl) {
        child.ui.nodeEl.setAttribute("aria-expanded", "false");
        const toggleEl = child.ui.nodeEl.querySelector(".toggle");
        if (toggleEl) toggleEl.textContent = "▸";
      }
      if (child.ui.childrenEl) child.ui.childrenEl.classList.add("hidden");
      stack.push(child);
    }
  }
}

function renderBreadcrumbs() {
  const parts = ui.currentDirPath ? ui.currentDirPath.split("/").filter(Boolean) : [];
  const crumbs = [];

  crumbs.push({ name: "/", path: "" });
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    crumbs.push({ name: part, path: acc });
  }

  currentPathEl.innerHTML = crumbs
    .map((c, idx) => {
      const isLast = idx === crumbs.length - 1;
      if (isLast) {
        return `<span class="crumb">${escHtml(c.name)}</span>`;
      }
      return `<span class="crumb"><a href="#" data-path="${escHtml(c.path)}">${escHtml(
        c.name
      )}</a><span class="sep">/</span></span>`;
    })
    .join("");
}

function expandTreeToPath(path) {
  const parts = (path || "").split("/").filter(Boolean);
  let node = state.root;
  let currentPath = "";

  if (!state.root.ui.rendered) renderRoot();

  for (const part of parts) {
    const child = node.children.get(part);
    if (!child) break;
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    if (child.ui.nodeEl && child.ui.childrenEl) {
      if (!child.ui.expanded) {
        toggleDir(child, child.ui.nodeEl, child.ui.childrenEl);
      } else {
        child.ui.rendered = false;
        child.ui.childrenEl.innerHTML = "";
        renderDirChildren(child, child.ui.childrenEl, currentPath);
      }
    }
    node = child;
  }

  clearTreeSelected();
  if (node.ui.nodeEl) {
    node.ui.nodeEl.classList.add("selected");
    node.ui.nodeEl.scrollIntoView({ block: "nearest" });
  }
}

function navigateTo(path, { push = false } = {}) {
  const cleaned = path || "";
  setCurrentDir(cleaned);
  expandTreeToPath(cleaned);

  if (push) {
    const hash = cleaned ? `#${encodeURIComponent(cleaned)}` : "#";
    history.pushState({ path: cleaned }, "", hash);
  }
}

function openSearch() {
  if (!searchModal) return;
  searchModal.classList.remove("hidden");
  q.focus();
  q.select();
}

function closeSearch() {
  if (!searchModal) return;
  searchModal.classList.add("hidden");
}

function stopFind() {
  state.stopFind = true;
}

function revealPath(path, isDir) {
  const parts = path.split("/").filter(Boolean);
  let node = state.root;
  let currentPath = "";

  const dirDepth = isDir ? parts.length : Math.max(0, parts.length - 1);
  if (!state.root.ui.rendered) renderRoot();

  for (let i = 0; i < dirDepth; i++) {
    const name = parts[i];
    const child = node.children.get(name);
    if (!child) break;
    currentPath = currentPath ? `${currentPath}/${name}` : name;

    if (child.ui.nodeEl && child.ui.childrenEl) {
      if (!child.ui.expanded) {
        toggleDir(child, child.ui.nodeEl, child.ui.childrenEl);
      } else {
        child.ui.rendered = false;
        child.ui.childrenEl.innerHTML = "";
        renderDirChildren(child, child.ui.childrenEl, currentPath);
      }
      child.ui.nodeEl.scrollIntoView({ block: "center" });
    }
    node = child;
  }

  if (isDir) {
    navigateTo(parts.join("/"), { push: true });
    return;
  }

  const fileName = parts[parts.length - 1];
  const f = node.files.find((x) => x.name === fileName);
  navigateTo(parts.slice(0, -1).join("/"), { push: true });
  if (f) {
    selectFile(f);
  }
}

async function runFind() {
  const needleRaw = q.value.trim();
  if (!needleRaw) return;

  resultsList.innerHTML = "";
  resultsMeta.textContent = "";
  results.scrollIntoView({ block: "nearest" });

  const needle = needleRaw.toLowerCase();
  state.stopFind = false;

  const maxResults = 10000;
  let found = 0;
  let scannedDirs = 0;
  let scannedFiles = 0;

  const started = performance.now();
  const stack = [{ node: state.root, pathParts: [] }];

  const shouldMatch = (s) => s.toLowerCase().includes(needle);

  function addResult(type, path) {
    const div = document.createElement("div");
    div.className = "result";
    div.innerHTML =
      `<span class="faint">${type === "dir" ? "dir" : "file"}:</span> ` +
      escHtml(path);

    div.addEventListener("click", () => {
      closeSearch();
      revealPath(path, type === "dir");
    });

    resultsList.appendChild(div);
  }

  while (stack.length && !state.stopFind) {
    const { node, pathParts } = stack.pop();
    const dirPath = pathParts.length ? pathParts.join("/") : "";

    if (node !== state.root) {
      scannedDirs++;
      if (shouldMatch(dirPath) || shouldMatch(node.name)) {
        addResult("dir", dirPath);
        found++;
        if (found >= maxResults) break;
      }
    }

    for (const f of node.files) {
      scannedFiles++;
      if (shouldMatch(f.path) || shouldMatch(f.name)) {
        addResult("file", f.path);
        found++;
        if (found >= maxResults) break;
      }
    }
    if (found >= maxResults) break;

    const children = Array.from(node.children.values()).sort((a, b) =>
      b.name.localeCompare(a.name)
    );
    for (const child of children) {
      stack.push({ node: child, pathParts: pathParts.concat(child.name) });
    }

    if ((scannedDirs + scannedFiles) % 8000 === 0) {
      resultsMeta.textContent = `scanned ${scannedDirs.toLocaleString()} dirs, ${scannedFiles.toLocaleString()} files…`;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const ms = Math.round(performance.now() - started);
  const stopped = state.stopFind ? " (stopped)" : "";
  const limited = found >= maxResults ? ` (hit limit ${maxResults})` : "";
  resultsMeta.textContent = `${found.toLocaleString()} matches${limited} in ${ms} ms${stopped}`;
}

function resetUI() {
  treeEl.innerHTML = "";
  dirBody.innerHTML = "";
  currentPathEl.textContent = "/";
  chipStats.textContent = "No data";
  dirTable.classList.remove("details-simple");
  renderSelectionEmpty();
  hideProgress();
  closeSearch();
  showLanding();
  updateToolbarButtons();
}

function resetAll() {
  resetState(state);
  ui.currentDirPath = "";
  ui.sortKey = "name";
  ui.sortAsc = true;
  resetUI();
  updateSortIndicators();
}

async function loadFromFile(file) {
  resetAll();
  showProgress(`Reading ${file.name}…`, 0);

  await parseFile(state, file, {
    onProgress: (text, pct) => showProgress(text, pct),
  });

  hideProgress();
  showApp();
  updateStatsChip();
  updateToolbarButtons();
  applyDetailsColumns();
  renderRoot();
  navigateTo(getPathFromHash(), { push: false });
}

async function loadFromText(text, name = "clipboard.txt") {
  const blob = new Blob([text], { type: "text/plain" });
  const file = new File([blob], name, { type: "text/plain" });
  await loadFromFile(file);
}

function isEditableTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function wireDropzone() {
  function onDragOver(e) {
    e.preventDefault();
    drop.classList.add("dragover");
  }
  function onDragLeave(e) {
    e.preventDefault();
    drop.classList.remove("dragover");
  }
  async function onDrop(e) {
    e.preventDefault();
    drop.classList.remove("dragover");
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await loadFromFile(file);
  }

  drop.addEventListener("dragover", onDragOver);
  drop.addEventListener("dragleave", onDragLeave);
  drop.addEventListener("drop", onDrop);
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });
}

wireDropzone();

document.addEventListener("paste", async (e) => {
  if (state.parsing) return;
  if (isEditableTarget(e.target)) return;
  const text = e.clipboardData?.getData("text/plain") || "";
  if (!text.trim()) return;
  e.preventDefault();
  await loadFromText(text, "clipboard.txt");
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  await loadFromFile(file);
});

btnReset.addEventListener("click", () => resetAll());
btnDemo.addEventListener("click", () => {
  const demo = [
    "etc/hosts",
    "etc/ssh/sshd_config",
    "etc/systemd/system/example.service",
    "-rw-r--r-- root/root 1234 2026-01-01 12:34 var/log/syslog",
    "drwxr-xr-x root/root 0 2026-01-01 12:00 var/log",
    "lrwxrwxrwx root/root 0 2026-01-01 12:00 bin/sh -> bash",
    "12345 4 -rw-r--r-- 1 root root 4321 Jan 2 2026 home/user/readme.txt",
  ].join("\n");
  const blob = new Blob([demo], { type: "text/plain" });
  const file = new File([blob], "demo.txt", { type: "text/plain" });
  loadFromFile(file);
});

btnCollapseAll.addEventListener("click", () => collapseAll());

for (const header of sortHeaders) {
  header.addEventListener("click", () => {
    const key = header.dataset.key;
    if (!key) return;
    if (ui.sortKey === key) {
      ui.sortAsc = !ui.sortAsc;
    } else {
      ui.sortKey = key;
      ui.sortAsc = true;
    }
    updateSortIndicators();
    renderDirListing();
  });
}

btnSearch.addEventListener("click", () => openSearch());
btnCloseSearch.addEventListener("click", () => closeSearch());

currentPathEl.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-path]");
  if (!link) return;
  e.preventDefault();
  const path = link.getAttribute("data-path") || "";
  navigateTo(path, { push: true });
});

searchModal.addEventListener("click", (e) => {
  if (e.target === searchModal) closeSearch();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !searchModal.classList.contains("hidden")) {
    closeSearch();
  }
});

btnFind.addEventListener("click", async () => {
  if (state.parsing) return;
  await runFind();
});

btnStopFind.addEventListener("click", () => stopFind());

q.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    await runFind();
  }
});

window.addEventListener("popstate", () => {
  navigateTo(getPathFromHash(), { push: false });
});

function getPathFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return "";
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

resetAll();
updateToolbarButtons();
