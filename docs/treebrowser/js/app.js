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

const q = $("q");
const btnFind = $("btnFind");
const btnStopFind = $("btnStopFind");
const results = $("results");
const resultsMeta = $("resultsMeta");
const resultsList = $("resultsList");

const selectionEl = $("selection");
const btnCollapseAll = $("btnCollapseAll");

const state = createState();

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

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
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateStatsChip() {
  const st = state.stats;
  const sizeStr =
    st.sizeKnownCount > 0 ? `, size~${fmtBytes(st.totalSize)}` : "";
  chipStats.textContent = `${st.files.toLocaleString()} files, ${st.dirs.toLocaleString()} dirs${sizeStr} • ${st.formatGuess}`;
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

function renderSelectionEmpty() {
  selectionEl.innerHTML =
    '<div class="k">Status</div><div class="v">No item selected.</div>' +
    '<div class="k">Hint</div><div class="v">Use <span class="kbd">Find</span>, then click a result to reveal it.</div>';
}

function resetUI() {
  treeEl.innerHTML = "";
  results.classList.add("hidden");
  resultsList.innerHTML = "";
  resultsMeta.textContent = "";
  q.value = "";
  chipStats.textContent = "No data";
  renderSelectionEmpty();
  hideProgress();
  showLanding();
}

function resetAll() {
  resetState(state);
  resetUI();
}

function dirDisplayMeta(dirNode) {
  if (!dirNode.meta) return "";
  const m = dirNode.meta;
  const size = m.size != null ? fmtBytes(m.size) : "";
  const time = m.mtime ?? "";
  const og = m.ownerGroup ?? "";
  return [size, time, og].filter(Boolean).join(" • ");
}

function fileDisplayMeta(fileEntry) {
  const m = fileEntry.meta;
  if (!m) return "";
  const size = m.size != null ? fmtBytes(m.size) : "";
  const time = m.mtime ?? "";
  return [size, time].filter(Boolean).join(" • ");
}

function clearSelectedStyles() {
  const prev = treeEl.querySelector(".node.selected");
  if (prev) prev.classList.remove("selected");
}

function renderSelection() {
  if (!state.selected) return;

  const sel = state.selected;
  const meta = sel.meta || {};

  const rows = [];
  rows.push(["Type", sel.type]);
  rows.push(["Path", sel.path || "/"]);

  if (meta.source) rows.push(["Source", meta.source]);
  if (meta.mode) rows.push(["Mode", meta.mode]);
  if (meta.ownerGroup) rows.push(["Owner/Group", meta.ownerGroup]);
  if (meta.size != null) rows.push(["Size", fmtBytes(meta.size)]);
  if (meta.mtime) rows.push(["Time", meta.mtime]);
  if (meta.linkTarget) rows.push(["Link target", meta.linkTarget]);

  if (sel.type === "dir") {
    const dir = sel.node;
    rows.push([
      "Children",
      `${dir.children.size.toLocaleString()} dirs, ${dir.files.length.toLocaleString()} files`,
    ]);
  }

  selectionEl.innerHTML = rows
    .map(
      ([k, v]) =>
        `<div class="k">${escHtml(k)}</div><div class="v">${escHtml(String(v))}</div>`
    )
    .join("");
}

function selectDir(dirNode, path) {
  clearSelectedStyles();
  if (dirNode.ui.nodeEl) dirNode.ui.nodeEl.classList.add("selected");

  state.selected = {
    type: "dir",
    path: path || "",
    node: dirNode,
    meta: dirNode.meta,
  };
  renderSelection();
}

function selectFile(fileEntry) {
  clearSelectedStyles();
  state.selected = {
    type: "file",
    path: fileEntry.path,
    file: fileEntry,
    meta: fileEntry.meta,
  };
  renderSelection();
}

function renderRoot() {
  treeEl.innerHTML = "";
  state.root.ui.expanded = true;
  state.root.ui.rendered = false;

  const wrapper = document.createElement("div");
  treeEl.appendChild(wrapper);
  renderDirInto(state.root, wrapper, "");
}

function renderDirInto(dirNode, parentEl, parentPath) {
  const path =
    parentPath === ""
      ? dirNode.name
      : dirNode.name
        ? `${parentPath}/${dirNode.name}`
        : parentPath;

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

    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = "d";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = dirNode.name;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = dirDisplayMeta(dirNode);

    row.appendChild(toggle);
    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(meta);

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDir(dirNode, row, children, path);
    });

    row.addEventListener("click", () => {
      selectDir(dirNode, path);
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

function renderDirChildren(dirNode, childrenEl, dirPath) {
  if (dirNode.ui.rendered) return;

  const dirs = Array.from(dirNode.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const files = dirNode.files
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const dirLimit = dirNode.ui.dirRenderLimit;
  const fileLimit = dirNode.ui.fileRenderLimit;

  const dirsToShow = dirs.slice(0, dirLimit);
  for (const d of dirsToShow) {
    d.ui.expanded = false;
    d.ui.rendered = false;
    renderDirInto(d, childrenEl, dirPath);
  }

  const filesToShow = files.slice(0, fileLimit);
  for (const f of filesToShow) {
    const row = document.createElement("div");
    row.className = "node";
    row.setAttribute("role", "treeitem");

    const spacer = document.createElement("div");
    spacer.className = "toggle";
    spacer.textContent = " ";

    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = "f";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = f.name;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = fileDisplayMeta(f);

    row.appendChild(spacer);
    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(meta);

    row.addEventListener("click", () => {
      selectFile(f);
    });

    childrenEl.appendChild(row);
  }

  const moreNeeded = dirs.length > dirLimit || files.length > fileLimit;
  if (moreNeeded) {
    const more = document.createElement("div");
    more.className = "more";

    const moreDirs =
      dirs.length > dirLimit
        ? `${(dirs.length - dirLimit).toLocaleString()} dirs hidden`
        : null;
    const moreFiles =
      files.length > fileLimit
        ? `${(files.length - fileLimit).toLocaleString()} files hidden`
        : null;

    more.innerHTML =
      `<div class="muted small">Large folder: ${[moreDirs, moreFiles]
        .filter(Boolean)
        .join(", ")}.</div>` +
      '<div class="btns" style="justify-content:flex-start;margin-top:6px">' +
      '<button class="primary">Show more</button></div>';

    const btn = more.querySelector("button");
    btn.addEventListener("click", () => {
      dirNode.ui.dirRenderLimit = Math.min(dirs.length, dirNode.ui.dirRenderLimit * 2);
      dirNode.ui.fileRenderLimit = Math.min(
        files.length,
        dirNode.ui.fileRenderLimit * 2
      );
      dirNode.ui.rendered = false;
      childrenEl.innerHTML = "";
      renderDirChildren(dirNode, childrenEl, dirPath);
    });

    childrenEl.appendChild(more);
    dirNode.ui.moreEl = more;
  }

  dirNode.ui.rendered = true;
}

function toggleDir(dirNode, rowEl, childrenEl, path) {
  dirNode.ui.expanded = !dirNode.ui.expanded;
  rowEl.setAttribute("aria-expanded", String(dirNode.ui.expanded));

  const toggleEl = rowEl.querySelector(".toggle");
  toggleEl.textContent = dirNode.ui.expanded ? "▾" : "▸";

  childrenEl.classList.toggle("hidden", !dirNode.ui.expanded);

  if (dirNode.ui.expanded) {
    renderDirChildren(dirNode, childrenEl, path);
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
        toggleDir(child, child.ui.nodeEl, child.ui.childrenEl, currentPath);
      } else {
        renderDirChildren(child, child.ui.childrenEl, currentPath);
      }
      child.ui.nodeEl.scrollIntoView({ block: "center" });
    }

    node = child;
  }

  if (isDir) {
    selectDir(node, parts.join("/"));
    return;
  }

  const fileName = parts[parts.length - 1];
  const filePath = parts.join("/");
  const f = node.files.find((x) => x.name === fileName);
  if (f) {
    selectFile(f);
    if (node.ui.nodeEl) node.ui.nodeEl.scrollIntoView({ block: "center" });
  } else {
    selectionEl.innerHTML =
      '<div class="k">Status</div><div class="v warn">Found path, but file is not currently rendered.</div>' +
      `<div class="k">File</div><div class="v">${escHtml(filePath)}</div>` +
      '<div class="k">Tip</div><div class="v">Expand the folder and click <span class="kbd">Show more</span> if present.</div>';
  }
}

async function runFind() {
  const needleRaw = q.value.trim();
  if (!needleRaw) return;

  results.classList.remove("hidden");
  resultsList.innerHTML = "";
  resultsMeta.textContent = "";

  const needle = needleRaw.toLowerCase();
  state.stopFind = false;

  const maxResults = 1500;
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
      resultsMeta.textContent = ` (scanned ${scannedDirs.toLocaleString()} dirs, ${scannedFiles.toLocaleString()} files…)`;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const ms = Math.round(performance.now() - started);
  const stopped = state.stopFind ? " (stopped)" : "";
  const limited = found >= maxResults ? ` (hit limit ${maxResults})` : "";

  resultsMeta.textContent = ` — ${found.toLocaleString()} matches${limited} in ${ms} ms${stopped}`;
}

async function loadFromFile(file) {
  resetAll();
  showProgress(`Reading ${file.name}…`, 0);

  await parseFile(state, file, {
    onProgress: (text, pct) => {
      showProgress(text, pct);
    },
  });

  hideProgress();
  showApp();
  updateStatsChip();
  renderRoot();
  selectDir(state.root, "");
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

  resetAll();
  showApp();

  const blob = new Blob([demo], { type: "text/plain" });
  const file = new File([blob], "demo.txt", { type: "text/plain" });
  loadFromFile(file);
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

btnCollapseAll.addEventListener("click", () => collapseAll());

resetAll();
