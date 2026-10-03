import { join } from "node:path";
import { Language, Parser, Query } from "web-tree-sitter";

export type Chunk = {
  symbol: string;
  startLine: number;
  endLine: number;
  text: string;
};

const NAMED = "[(property_identifier) (private_property_identifier)]";

const TYPESCRIPT_SOURCE = `
  (function_declaration name: (identifier) @name) @def
  (generator_function_declaration name: (identifier) @name) @def
  (function_signature name: (identifier) @name) @def
  (class_declaration name: (type_identifier) @name) @def
  (abstract_class_declaration name: (type_identifier) @name) @def
  (interface_declaration name: (type_identifier) @name) @def
  (type_alias_declaration name: (type_identifier) @name) @def
  (enum_declaration name: (identifier) @name) @def
  (enum_assignment name: (property_identifier) @name) @def
  (internal_module name: [(identifier) (nested_identifier) (string)] @name) @def
  (module name: [(identifier) (nested_identifier) (string)] @name) @def
  (method_definition name: ${NAMED} @name) @def
  (method_signature name: ${NAMED} @name) @def
  (abstract_method_signature name: ${NAMED} @name) @def
  (public_field_definition name: ${NAMED} @name) @def
  (property_signature name: ${NAMED} @name) @def
  (variable_declarator name: (identifier) @name) @def
`;

const JAVASCRIPT_SOURCE = `
  (function_declaration name: (identifier) @name) @def
  (generator_function_declaration name: (identifier) @name) @def
  (class_declaration name: (identifier) @name) @def
  (method_definition name: ${NAMED} @name) @def
  (field_definition property: ${NAMED} @name) @def
  (variable_declarator name: (identifier) @name) @def
`;

const PYTHON_SOURCE = `
  (function_definition name: (identifier) @name) @def
  (class_definition name: (identifier) @name) @def
  (type_alias_statement left: (type) @name) @def
  (module (expression_statement (assignment left: (identifier) @name) @def))
`;

const GO_SOURCE = `
  (function_declaration name: (identifier) @name) @def
  (method_declaration name: (field_identifier) @name) @def
  (type_spec name: (type_identifier) @name) @def
  (type_alias name: (type_identifier) @name) @def
  (const_spec name: (identifier) @name) @def
  (var_spec name: (identifier) @name) @def
`;

const RUST_SOURCE = `
  (function_item name: (identifier) @name) @def
  (function_signature_item name: (identifier) @name) @def
  (struct_item name: (type_identifier) @name) @def
  (enum_item name: (type_identifier) @name) @def
  (union_item name: (type_identifier) @name) @def
  (type_item name: (type_identifier) @name) @def
  (trait_item name: (type_identifier) @name) @def
  (mod_item name: (identifier) @name) @def
  (const_item name: (identifier) @name) @def
  (static_item name: (identifier) @name) @def
  (macro_definition name: (identifier) @name) @def
  (associated_type name: (type_identifier) @name) @def
  (impl_item type: (type_identifier) @name) @def
`;

const HTML_ID = `
  (attribute
    (attribute_name) @attr
    (quoted_attribute_value (attribute_value) @name))
`;

const HTML_SOURCE = `
  (
    (element (start_tag ${HTML_ID})) @def
    (#eq? @attr "id")
  )
  (
    (element (self_closing_tag ${HTML_ID})) @def
    (#eq? @attr "id")
  )
`;

const CSS_SOURCE = `
  (rule_set (selectors (class_selector (class_name) @name))) @def
  (rule_set (selectors (id_selector (id_name) @name))) @def
  (keyframes_statement (keyframes_name) @name) @def
  (
    (declaration (property_name) @name) @def
    (#match? @name "^-{2}")
  )
`;

type Grammar = {
  extensions: string[];
  wasm: string;
  source: string;
};

function wasm(packageName: string, file: string) {
  return join(process.cwd(), "node_modules", packageName, file);
}

const GRAMMARS: Grammar[] = [
  {
    extensions: [".ts"],
    wasm: wasm("tree-sitter-typescript", "tree-sitter-typescript.wasm"),
    source: TYPESCRIPT_SOURCE,
  },
  {
    extensions: [".tsx"],
    wasm: wasm("tree-sitter-typescript", "tree-sitter-tsx.wasm"),
    source: TYPESCRIPT_SOURCE,
  },
  {
    extensions: [".js", ".mjs", ".cjs", ".jsx"],
    wasm: wasm("tree-sitter-javascript", "tree-sitter-javascript.wasm"),
    source: JAVASCRIPT_SOURCE,
  },
  {
    extensions: [".py"],
    wasm: wasm("tree-sitter-python", "tree-sitter-python.wasm"),
    source: PYTHON_SOURCE,
  },
  {
    extensions: [".go"],
    wasm: wasm("tree-sitter-go", "tree-sitter-go.wasm"),
    source: GO_SOURCE,
  },
  {
    extensions: [".rs"],
    wasm: wasm("tree-sitter-rust", "tree-sitter-rust.wasm"),
    source: RUST_SOURCE,
  },
  {
    extensions: [".html", ".htm"],
    wasm: wasm("tree-sitter-html", "tree-sitter-html.wasm"),
    source: HTML_SOURCE,
  },
  {
    extensions: [".css"],
    wasm: wasm("tree-sitter-css", "tree-sitter-css.wasm"),
    source: CSS_SOURCE,
  },
];

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

function extensionOf(path: string) {
  const name = path.split("/").at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot);
}

export async function chunkSource(path: string, source: string): Promise<Chunk[]> {
  const grammars = await loadGrammars();
  const extension = extensionOf(path);
  const grammar = grammars.find((item) => item.extensions.includes(extension));
  if (!grammar) return [];

  const parser = new Parser();
  parser.setLanguage(grammar.language);
  const tree = parser.parse(source);
  if (!tree) return [];

  const chunks = grammar.query.matches(tree.rootNode).map((match) => {
    const definition = match.captures.find((capture) => capture.name === "def")!.node;
    const name = match.captures.find((capture) => capture.name === "name")?.node.text ?? path;
    return {
      symbol: name,
      startLine: definition.startPosition.row + 1,
      endLine: definition.endPosition.row + 1,
      text: source.slice(definition.startIndex, definition.endIndex),
    };
  });

  tree.delete();
  parser.delete();
  if (chunks.length > 0) return chunks;
  return [{ symbol: path, startLine: 1, endLine: source.split("\n").length, text: source }];
}
