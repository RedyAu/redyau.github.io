import { addPathToTree } from "./model.js";

function normalizePath(p) {
  if (!p) return "";
  let s = p.trim();
  if (!s) return "";
  s = s.replace(/^\\\\\?\\/, "");
  s = s.replace(/\\/g, "/");
  s = s.replace(/^[a-zA-Z]:\//, "");
  if (s.startsWith("./")) s = s.slice(2);
  s = s.replace(/^\/+/, "");
  s = s.replace(/\/{2,}/g, "/");
  s = s.replace(/\r$/, "");
  if (s === "." || s === "./") return "";
  return s;
}

function isModeToken(tok) {
  return /^[\-dclpsb][rwxstST\-]{9,}$/.test(tok);
}

function looksLikeTarTvOrLsLong(line) {
  const s = line.trim();
  if (!s) return false;
  if (s.startsWith("total ")) return false;
  const first = s.split(/\s+/)[0];
  return isModeToken(first);
}

function looksLikeFindLs(line) {
  const s = line.trim();
  if (!s) return false;
  const parts = s.split(/\s+/);
  if (parts.length < 10) return false;
  if (!/^\d+$/.test(parts[0])) return false;
  if (!/^\d+$/.test(parts[1])) return false;
  return isModeToken(parts[2]);
}

function looksLikeWindowsDirEntry(line) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?:\s+(AM|PM))?\s+/.test(
    line.trim()
  );
}

function parseWindowsDirEntry(line, baseDir) {
  const s = line.trim();
  const match =
    /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})(?:\s+(AM|PM))?\s+(<[^>]+>|[0-9,]+)\s+(.+)$/.exec(
      s
    );
  if (!match) return null;

  const dateTok = match[1];
  const timeTok = match[2];
  const ampm = match[3] || "";
  const sizeTok = match[4];
  const name = match[5].trim();

  if (!name || name === "." || name === "..") return null;

  if (/^<\s*JUNCTION\s*>$/i.test(sizeTok)) return null;

  const isDir = /^<.+>$/.test(sizeTok);
  const size = isDir ? null : Number(sizeTok.replace(/,/g, ""));

  const meta = {
    mode: null,
    ownerGroup: null,
    size: Number.isFinite(size) ? size : null,
    mtime: `${dateTok} ${timeTok}${ampm ? ` ${ampm}` : ""}`,
    linkTarget: null,
    source: "windows-dir",
  };

  const combined = baseDir ? `${baseDir}/${name}` : name;
  const path = normalizePath(combined);
  if (!path) return null;

  return { path, meta, isDir };
}

function parseTarTvOrLsLong(line) {
  const s = line.trim();
  const parts = s.split(/\s+/);
  if (parts.length < 6) return null;

  const mode = parts[0];
  let sizeIdx = -1;

  for (let i = 1; i < Math.min(parts.length, 10); i++) {
    if (/^\d+$/.test(parts[i])) {
      sizeIdx = i;
      break;
    }
  }
  if (sizeIdx === -1 || sizeIdx + 2 >= parts.length) return null;

  const ownerGroup = parts.slice(1, sizeIdx).join(" ");
  const size = Number(parts[sizeIdx]);
  const dateTok = parts[sizeIdx + 1];
  const timeTok = parts[sizeIdx + 2];

  const nameParts = parts.slice(sizeIdx + 3);
  let name = nameParts.join(" ");
  if (!name) return null;

  let linkTarget = null;
  const arrow = name.indexOf(" -> ");
  if (arrow !== -1) {
    linkTarget = name.slice(arrow + 4);
    name = name.slice(0, arrow);
  }

  const meta = {
    mode,
    ownerGroup: ownerGroup || null,
    size: Number.isFinite(size) ? size : null,
    mtime: `${dateTok} ${timeTok}`,
    linkTarget,
    source: "long",
  };

  let path = normalizePath(name);
  if (!path) return null;

  const isDir = mode.startsWith("d") || path.endsWith("/");
  if (path.endsWith("/")) path = path.slice(0, -1);

  return { path, meta, isDir };
}

function parseFindLs(line) {
  const s = line.trim();
  const parts = s.split(/\s+/);
  if (parts.length < 11) return null;

  const mode = parts[2];
  const user = parts[4] ?? "";
  const group = parts[5] ?? "";
  const size = Number(parts[6]);
  const month = parts[7];
  const day = parts[8];
  const timeOrYear = parts[9];

  const name = parts.slice(10).join(" ");
  let path = normalizePath(name);
  if (!path) return null;

  let linkTarget = null;
  const arrow = path.indexOf(" -> ");
  if (arrow !== -1) {
    linkTarget = path.slice(arrow + 4);
    path = path.slice(0, arrow);
  }

  const meta = {
    mode,
    ownerGroup: `${user} ${group}`.trim() || null,
    size: Number.isFinite(size) ? size : null,
    mtime: `${month} ${day} ${timeOrYear}`,
    linkTarget,
    source: "find-ls",
  };

  const isDir = mode.startsWith("d") || path.endsWith("/");
  if (path.endsWith("/")) path = path.slice(0, -1);

  return { path, meta, isDir };
}

function parseLine(state, line) {
  state.stats.lines++;

  const s = line.trim();

  if (!s || s === "." || s === "./" || s.startsWith("total ")) {
    state.stats.skipped++;
    return;
  }

  if (s.startsWith("Directory of ")) {
    state.windowsDir = normalizePath(s.slice("Directory of ".length));
    state.stats.skipped++;
    return;
  }

  if (
    s.startsWith("Volume in drive ") ||
    s.startsWith("Volume Serial Number") ||
    /^\d+\s+File\(s\)/i.test(s) ||
    /^\d+\s+Dir\(s\)/i.test(s) ||
    s.startsWith("Total Files Listed")
  ) {
    state.stats.skipped++;
    return;
  }

  let parsed = null;

  if (looksLikeWindowsDirEntry(s)) {
    parsed = parseWindowsDirEntry(s, state.windowsDir || "");
    if (parsed && state.stats.formatGuess === "unknown") {
      state.stats.formatGuess = "windows dir";
    }
  } else if (looksLikeFindLs(s)) {
    parsed = parseFindLs(s);
    if (parsed && state.stats.formatGuess === "unknown") {
      state.stats.formatGuess = "find -ls";
    }
  } else if (looksLikeTarTvOrLsLong(s)) {
    parsed = parseTarTvOrLsLong(s);
    if (parsed && state.stats.formatGuess === "unknown") {
      state.stats.formatGuess = "tar -tvf / ls -l";
    }
  } else {
    let path = normalizePath(s);
    if (!path) {
      state.stats.skipped++;
      return;
    }
    const isDir = path.endsWith("/");
    if (path.endsWith("/")) path = path.slice(0, -1);
    parsed = { path, meta: null, isDir };
    if (state.stats.formatGuess === "unknown") {
      state.stats.formatGuess = "paths";
    }
  }

  if (!parsed || !parsed.path) {
    state.stats.skipped++;
    return;
  }

  state.stats.parsed++;
  addPathToTree(state, parsed.path, parsed.isDir, parsed.meta);
}

export async function parseFile(state, file, { onProgress }) {
  state.parsing = true;
  state.lastFileName = file.name;
  state.windowsDir = "";

  const chunkSize = 2 * 1024 * 1024;
  const decoder = new TextDecoder("utf-8");
  let offset = 0;
  let carry = "";
  let lastYield = performance.now();

  onProgress?.(`Reading ${file.name}…`, 0);

  while (offset < file.size) {
    const slice = file.slice(offset, offset + chunkSize);
    const buf = await slice.arrayBuffer();
    const text = decoder.decode(buf, { stream: true });
    const combined = carry + text;
    const lines = combined.split(/\r?\n/);
    carry = lines.pop() ?? "";

    for (const line of lines) {
      parseLine(state, line);
      const now = performance.now();
      if (now - lastYield > 20) {
        lastYield = now;
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    offset += chunkSize;
    const pct = (offset / file.size) * 100;
    onProgress?.(
      `Parsing… ${state.stats.parsed.toLocaleString()} entries`,
      pct
    );
  }

  const tail = carry + decoder.decode();
  if (tail.trim()) {
    for (const line of tail.split(/\r?\n/)) parseLine(state, line);
  }

  state.parsing = false;
}
