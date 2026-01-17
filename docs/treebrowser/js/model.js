export function makeDirNode(name) {
  return {
    name,
    children: new Map(),
    files: [],
    meta: null,
    ui: {
      expanded: false,
      rendered: false,
      fileRenderLimit: 400,
      dirRenderLimit: 400,
      containerEl: null,
      nodeEl: null,
      childrenEl: null,
      moreEl: null,
    },
  };
}

export function createState() {
  return {
    root: makeDirNode(""),
    stats: {
      lines: 0,
      parsed: 0,
      skipped: 0,
      files: 0,
      dirs: 0,
      withMeta: 0,
      totalSize: 0,
      sizeKnownCount: 0,
      formatGuess: "unknown",
    },
    selected: null,
    parsing: false,
    stopFind: false,
    lastFileName: null,
  };
}

export function resetState(state) {
  state.root = makeDirNode("");
  state.stats = {
    lines: 0,
    parsed: 0,
    skipped: 0,
    files: 0,
    dirs: 0,
    withMeta: 0,
    totalSize: 0,
    sizeKnownCount: 0,
    formatGuess: "unknown",
  };
  state.selected = null;
  state.parsing = false;
  state.stopFind = false;
  state.lastFileName = null;
}

export function addPathToTree(state, path, isDir, meta) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return;

  let node = state.root;

  for (let i = 0; i < parts.length - (isDir ? 0 : 1); i++) {
    const dirName = parts[i];
    let child = node.children.get(dirName);
    if (!child) {
      child = makeDirNode(dirName);
      node.children.set(dirName, child);
      state.stats.dirs++;
    }
    node = child;
  }

  if (isDir) {
    if (meta) {
      node.meta = node.meta || meta;
      state.stats.withMeta++;
      if (meta.size != null) {
        state.stats.totalSize += meta.size;
        state.stats.sizeKnownCount++;
      }
    }
    return;
  }

  const fileName = parts[parts.length - 1];
  const fullPath = parts.join("/");

  const existingIdx = node.files.findIndex((f) => f.name === fileName);
  const entry = { name: fileName, path: fullPath, meta: meta || null };

  if (existingIdx !== -1) {
    node.files[existingIdx] = entry;
  } else {
    node.files.push(entry);
    state.stats.files++;
  }

  if (meta) {
    state.stats.withMeta++;
    if (meta.size != null) {
      state.stats.totalSize += meta.size;
      state.stats.sizeKnownCount++;
    }
  }
}
