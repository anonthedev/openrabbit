import { Language, Parser, Query, type Node } from "web-tree-sitter";
import { GRAMMARS } from "@/lib/grammars";

export type Chunk = {
  symbol: string;
  startLine: number;
  endLine: number;
  text: string;
};

type LoadedGrammar = {
  extensions: string[];
  language: Language;
  query: Query;
};

let ready: Promise<LoadedGrammar[]> | undefined;

function loadGrammars() {
  ready ??= (async () => {
    await Parser.init();
    return Promise.all(
      GRAMMARS.map(async (grammar) => {
        const language = await Language.load(grammar.wasm);
        return {
          extensions: grammar.extensions,
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

function extensionOf(path: string) {
  const name = path.split("/").at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot);
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
  const grammar = grammars.find((item) => item.extensions.includes(extension));
  if (!grammar) return [];

  const chunks = captureChunks(grammar, source, 0, path);
  if (extension === ".vue" || extension === ".svelte") {
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

  if (chunks.length > 0) return chunks;
  return [{ symbol: path, startLine: 1, endLine: source.split("\n").length, text: source }];
}
