import { Language, Parser, Query, type Node } from "web-tree-sitter";
import { GRAMMARS } from "@/lib/grammars";

const MAX_CHUNK_CHARS = 2000;
const MAX_EMBED_CHARS = 12_000;

export type Chunk = {
  symbol: string;
  startLine: number;
  endLine: number;
  text: string;
};

type LoadedGrammar = {
  extensions: string[];
  filenames?: string[];
  language: Language;
  query: Query;
};

let ready: Promise<LoadedGrammar[]> | undefined;

function contains(parent: Chunk, child: Chunk) {
  if (parent === child) return false;
  if (parent.startLine === child.startLine && parent.endLine === child.endLine) return false;
  return parent.startLine <= child.startLine && parent.endLine >= child.endLine;
}


function collapseChunks(chunks: Chunk[]): Chunk[] {
  const roots = chunks.filter((chunk) => !chunks.some((other) => contains(other, chunk)));
  const kept: Chunk[] = [];
  for (const root of roots) {
    const children = chunks.filter((chunk) => contains(root, chunk));
    if (root.text.length <= MAX_CHUNK_CHARS || children.length === 0) {
      kept.push(root);
      continue;
    }
    kept.push(...collapseChunks(children));
  }
  return kept;
}

function splitChunk(chunk: Chunk): Chunk[] {
  if (chunk.text.length <= MAX_EMBED_CHARS) return [chunk];

  const parts: Chunk[] = [];
  let lines: string[] = [];
  let chars = 0;
  let startLine = chunk.startLine;

  const push = (text: string, start: number, end: number) => {
    parts.push({ symbol: chunk.symbol, startLine: start, endLine: end, text });
  };
  const flush = (endLine: number) => {
    if (lines.length === 0) return;
    push(lines.join("\n"), startLine, endLine);
    lines = [];
    chars = 0;
  };

  for (const [index, line] of chunk.text.split("\n").entries()) {
    const lineNo = chunk.startLine + index;
    if (line.length > MAX_EMBED_CHARS) {
      flush(lineNo - 1);
      for (let offset = 0; offset < line.length; offset += MAX_EMBED_CHARS) {
        push(line.slice(offset, offset + MAX_EMBED_CHARS), lineNo, lineNo);
      }
      startLine = lineNo + 1;
      continue;
    }
    const extra = lines.length > 0 ? line.length + 1 : line.length;
    if (lines.length > 0 && chars + extra > MAX_EMBED_CHARS) {
      flush(lineNo - 1);
      startLine = lineNo;
    }
    lines.push(line);
    chars += lines.length === 1 ? line.length : line.length + 1;
  }
  flush(chunk.endLine);

  const seen = new Map<string, number>();
  return parts.map((part) => {
    const key = `${part.startLine}:${part.endLine}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? part : { ...part, symbol: `${part.symbol}#${count}` };
  });
}

function loadGrammars() {
  ready ??= (async () => {
    await Parser.init();
    return Promise.all(
      GRAMMARS.map(async (grammar) => {
        const language = await Language.load(grammar.wasm);
        return {
          extensions: grammar.extensions,
          filenames: grammar.filenames,
          language,
          query: new Query(language, grammar.source),
        };
      }),
    );
  })();
  return ready;
}

function symbolName(text: string | undefined, path: string) {
  if (!text) return path;
  const open = text[0];
  const close = text[text.length - 1];
  if (text.length >= 2 && ((open === '"' && close === '"') || (open === "'" && close === "'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function baseName(path: string) {
  return path.split("/").at(-1) ?? path;
}

function extensionOf(path: string) {
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot);
}

function matchesName(filenames: string[] | undefined, path: string) {
  const base = baseName(path);
  return filenames?.some((name) =>
    name.endsWith("*") ? base.startsWith(name.slice(0, -1)) : base === name,
  );
}

function findGrammar(grammars: LoadedGrammar[], path: string) {
  return (
    grammars.find((item) => matchesName(item.filenames, path)) ??
    grammars.find((item) => item.extensions.includes(extensionOf(path)))
  );
}

function captureChunks(grammar: LoadedGrammar, source: string, row: number, path: string) {
  const parser = new Parser();
  parser.setLanguage(grammar.language);
  const tree = parser.parse(source);
  if (!tree) {
    parser.delete();
    return [];
  }

  const chunks = grammar.query.matches(tree.rootNode).map((match) => {
    const definition = match.captures.find((capture) => capture.name === "def")!.node;
    return {
      symbol: symbolName(match.captures.find((capture) => capture.name === "name")?.node.text, path),
      startLine: definition.startPosition.row + 1 + row,
      endLine: definition.endPosition.row + 1 + row,
      text: source.slice(definition.startIndex, definition.endIndex),
    };
  });

  tree.delete();
  parser.delete();
  return chunks;
}

function attribute(element: Node, name: string) {
  const start = element.descendantsOfType("start_tag")[0];
  if (!start) return;
  for (const attr of start.descendantsOfType("attribute")) {
    const key = attr.descendantsOfType("attribute_name")[0];
    if (key?.text !== name) continue;
    return attr.descendantsOfType("attribute_value")[0]?.text.replace(/^["']|["']$/g, "");
  }
}

function scriptExtension(lang: string | undefined) {
  if (lang === "ts" || lang === "typescript") return ".ts";
  if (lang === "tsx") return ".tsx";
  if (lang === "jsx") return ".jsx";
  return ".js";
}

function styleExtension(lang: string | undefined) {
  if (lang === "scss") return ".scss";
  if (lang === "sass") return ".sass";
  if (lang === "less") return ".less";
  return ".css";
}

function embeddedRegions(root: Node) {
  const regions: { extension: string; text: string; row: number; symbol: string }[] = [];
  for (const front of root.descendantsOfType("frontmatter_js_block")) {
    const text = front.text.replace(/^\s*---\n?/, "").replace(/\n?---\s*$/, "");
    if (!text.trim()) continue;
    const stripped = front.text.length - text.length;
    const rowPad = front.text.slice(0, stripped).split("\n").length - 1;
    regions.push({
      extension: ".ts",
      text,
      row: front.startPosition.row + rowPad,
      symbol: "script",
    });
  }
  for (const element of root.descendantsOfType(["script_element", "style_element"])) {
    const raw = element.descendantsOfType("raw_text")[0];
    if (!raw?.text.trim()) continue;
    const style = element.type === "style_element";
    const lang = attribute(element, "lang");
    regions.push({
      extension: style ? styleExtension(lang) : scriptExtension(lang),
      text: raw.text,
      row: raw.startPosition.row,
      symbol: style ? "style" : "script",
    });
  }
  return regions;
}

export async function chunkSource(path: string, source: string): Promise<Chunk[]> {
  const grammars = await loadGrammars();
  const extension = extensionOf(path);
  const grammar = findGrammar(grammars, path);
  if (!grammar) return [];

  const chunks = captureChunks(grammar, source, 0, path);
  if (extension === ".vue" || extension === ".svelte" || extension === ".astro") {
    const parser = new Parser();
    parser.setLanguage(grammar.language);
    const tree = parser.parse(source);
    if (tree) {
      for (const region of embeddedRegions(tree.rootNode)) {
        const inner = grammars.find((item) => item.extensions.includes(region.extension));
        if (!inner) continue;
        const nested = captureChunks(inner, region.text, region.row, path);
        if (nested.length > 0) {
          chunks.push(...nested);
          continue;
        }
        chunks.push({
          symbol: region.symbol,
          startLine: region.row + 1,
          endLine: region.row + region.text.split("\n").length,
          text: region.text,
        });
      }
      tree.delete();
    }
    parser.delete();
  }
  
  const collapsed = collapseChunks(chunks);
  const chunksToStore =
    collapsed.length > 0
      ? collapsed
      : [{ symbol: path, startLine: 1, endLine: source.split("\n").length, text: source }];
  return chunksToStore.flatMap(splitChunk);
}
