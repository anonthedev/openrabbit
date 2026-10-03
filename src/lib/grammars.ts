import { join } from "node:path";

export type Grammar = {
  extensions: string[];
  wasm: string;
  source: string;
};

function wasm(packageName: string, file: string) {
  return join(process.cwd(), "node_modules", packageName, file);
}

function local(file: string) {
  return join(process.cwd(), file);
}

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

const JAVA_SOURCE = `
  (class_declaration name: (identifier) @name) @def
  (interface_declaration name: (identifier) @name) @def
  (enum_declaration name: (identifier) @name) @def
  (enum_constant name: (identifier) @name) @def
  (record_declaration name: (identifier) @name) @def
  (annotation_type_declaration name: (identifier) @name) @def
  (method_declaration name: (identifier) @name) @def
  (constructor_declaration name: (identifier) @name) @def
  (field_declaration declarator: (variable_declarator name: (identifier) @name)) @def
`;

const C_SOURCE = `
  (function_definition
    declarator: (function_declarator declarator: (identifier) @name)) @def
  (function_definition
    declarator: (pointer_declarator
      declarator: (function_declarator declarator: (identifier) @name))) @def
  (declaration
    declarator: (function_declarator declarator: (identifier) @name)) @def
  (declaration
    declarator: (pointer_declarator
      declarator: (function_declarator declarator: (identifier) @name))) @def
  (struct_specifier name: (type_identifier) @name) @def
  (union_specifier name: (type_identifier) @name) @def
  (enum_specifier name: (type_identifier) @name) @def
  (type_definition declarator: (type_identifier) @name) @def
  (preproc_def name: (identifier) @name) @def
  (preproc_function_def name: (identifier) @name) @def
`;

const CPP_SOURCE = `
  (struct_specifier name: (type_identifier) @name) @def
  (union_specifier name: (type_identifier) @name) @def
  (enum_specifier name: (type_identifier) @name) @def
  (class_specifier name: (type_identifier) @name) @def
  (namespace_definition name: (namespace_identifier) @name) @def
  (alias_declaration name: (type_identifier) @name) @def
  (concept_definition name: (identifier) @name) @def
  (type_definition declarator: (type_identifier) @name) @def
  (function_definition
    declarator: (function_declarator declarator: (identifier) @name)) @def
  (function_definition
    declarator: (function_declarator declarator: (field_identifier) @name)) @def
  (function_definition
    declarator: (function_declarator
      declarator: (qualified_identifier name: (identifier) @name))) @def
  (function_definition
    declarator: (function_declarator declarator: (destructor_name) @name)) @def
  (function_definition
    declarator: (function_declarator
      declarator: (qualified_identifier name: (destructor_name) @name))) @def
  (function_definition
    declarator: (pointer_declarator
      declarator: (function_declarator declarator: (identifier) @name))) @def
  (field_declaration
    declarator: (function_declarator declarator: (field_identifier) @name)) @def
  (field_declaration
    declarator: (function_declarator declarator: (destructor_name) @name)) @def
  (field_declaration declarator: (field_identifier) @name) @def
  (preproc_def name: (identifier) @name) @def
  (preproc_function_def name: (identifier) @name) @def
`;

const CSHARP_SOURCE = `
  (class_declaration name: (identifier) @name) @def
  (interface_declaration name: (identifier) @name) @def
  (struct_declaration name: (identifier) @name) @def
  (enum_declaration name: (identifier) @name) @def
  (enum_member_declaration name: (identifier) @name) @def
  (record_declaration name: (identifier) @name) @def
  (namespace_declaration name: (identifier) @name) @def
  (file_scoped_namespace_declaration name: (identifier) @name) @def
  (method_declaration name: (identifier) @name) @def
  (constructor_declaration name: (identifier) @name) @def
  (destructor_declaration name: (identifier) @name) @def
  (property_declaration name: (identifier) @name) @def
  (delegate_declaration name: (identifier) @name) @def
  (event_declaration name: (identifier) @name) @def
  (field_declaration (variable_declaration (variable_declarator name: (identifier) @name))) @def
`;

const RUBY_SOURCE = `
  (method name: (_) @name) @def
  (singleton_method name: (_) @name) @def
  (class name: (_) @name) @def
  (module name: (_) @name) @def
  (alias name: (_) @name) @def
`;

const PHP_SOURCE = `
  (namespace_definition name: (namespace_name) @name) @def
  (class_declaration name: (name) @name) @def
  (interface_declaration name: (name) @name) @def
  (trait_declaration name: (name) @name) @def
  (enum_declaration name: (name) @name) @def
  (enum_case name: (name) @name) @def
  (function_definition name: (name) @name) @def
  (method_declaration name: (name) @name) @def
  (property_declaration (property_element (variable_name (name) @name))) @def
  (const_declaration (const_element (name) @name)) @def
`;

const BASH_SOURCE = `
  (function_definition name: (word) @name) @def
  (program (variable_assignment name: (variable_name) @name) @def)
  (program (declaration_command (variable_assignment name: (variable_name) @name) @def))
`;

const KOTLIN_SOURCE = `
  (function_declaration name: (identifier) @name) @def
  (class_declaration name: (identifier) @name) @def
  (object_declaration name: (identifier) @name) @def
  (companion_object name: (identifier) @name) @def
  (type_alias type: (identifier) @name) @def
  (property_declaration (variable_declaration . (identifier) @name)) @def
`;

const SQL_SOURCE = `
  (create_table (object_reference name: (identifier) @name)) @def
  (create_view (object_reference name: (identifier) @name)) @def
  (create_materialized_view (object_reference name: (identifier) @name)) @def
  (create_index column: (identifier) @name) @def
  (create_schema (identifier) @name) @def
  (create_type (object_reference name: (identifier) @name)) @def
  (create_sequence (object_reference name: (identifier) @name)) @def
  (create_function (object_reference name: (identifier) @name)) @def
`;

const JSON_SOURCE = `
  (pair key: (string (string_content) @name)) @def
`;

const YAML_SOURCE = `
  (block_mapping_pair key: (flow_node (plain_scalar (string_scalar) @name))) @def
  (flow_pair key: (flow_node (plain_scalar (string_scalar) @name))) @def
  (block_mapping_pair key: (flow_node (double_quote_scalar) @name)) @def
  (block_mapping_pair key: (flow_node (single_quote_scalar) @name)) @def
  (flow_pair key: (flow_node (double_quote_scalar) @name)) @def
  (flow_pair key: (flow_node (single_quote_scalar) @name)) @def
`;

const TOML_SOURCE = `
  (pair (bare_key) @name) @def
  (pair (quoted_key) @name) @def
  (pair (dotted_key) @name) @def
  (table (bare_key) @name) @def
  (table (dotted_key) @name) @def
  (table (quoted_key) @name) @def
  (table_array_element (bare_key) @name) @def
  (table_array_element (dotted_key) @name) @def
  (table_array_element (quoted_key) @name) @def
`;


const SCALA_SOURCE = `
  (class_definition name: (identifier) @name) @def
  (object_definition name: (identifier) @name) @def
  (trait_definition name: (identifier) @name) @def
  (function_definition name: (identifier) @name) @def
  (function_declaration name: (identifier) @name) @def
`;

const DART_SOURCE = `
  (class_definition name: (identifier) @name) @def
  (enum_declaration name: (identifier) @name) @def
  (enum_constant name: (identifier) @name) @def
  (function_signature name: (identifier) @name) @def
`;

const ELIXIR_SOURCE = `
  (
    (call
      target: (identifier) @kw
      (arguments (alias) @name)) @def
    (#match? @kw "^(defmodule|defprotocol|defimpl)$")
  )
  (
    (call
      target: (identifier) @kw
      (arguments (call target: (identifier) @name))) @def
    (#match? @kw "^(def|defp|defmacro|defmacrop)$")
  )
`;

const LUA_SOURCE = `
  (function_declaration name: (identifier) @name) @def
  (function_declaration name: (dot_index_expression field: (identifier) @name)) @def
  (function_declaration name: (method_index_expression) @name) @def
`;

const ZIG_SOURCE = `
  (function_declaration name: (identifier) @name) @def
  (variable_declaration . (identifier) @name) @def
`;

const GROOVY_SOURCE = `
  (class_definition name: (identifier) @name) @def
  (function_definition function: (identifier) @name) @def
  (declaration name: (identifier) @name) @def
`;

const POWERSHELL_SOURCE = `
  (function_statement (function_name) @name) @def
`;

const SWIFT_SOURCE = `
  (class_declaration name: (type_identifier) @name) @def
  (function_declaration name: (simple_identifier) @name) @def
  (protocol_declaration name: (type_identifier) @name) @def
  (protocol_function_declaration name: (simple_identifier) @name) @def
  (property_declaration name: (pattern bound_identifier: (simple_identifier) @name)) @def
  (enum_entry name: (simple_identifier) @name) @def
`;

const SCSS_SOURCE = `
  (rule_set (selectors (class_selector (class_name) @name))) @def
  (rule_set (selectors (id_selector (id_name) @name))) @def
  (mixin_statement (name) @name) @def
  (keyframes_statement (keyframes_name) @name) @def
  (declaration (variable_name) @name) @def
`;

const SASS_SOURCE = `
  (rule_set (selectors (class_selector (class_name) @name))) @def
  (rule_set (selectors (id_selector (id_name) @name))) @def
  (rule_set (selectors (placeholder_selector (placeholder_name) @name))) @def
  (mixin_statement (name) @name) @def
  (function_statement (name) @name) @def
  (declaration (variable_name) @name) @def
`;

const LESS_SOURCE = `
  (rule_set (selectors (class_selector (class_name) @name))) @def
  (rule_set (selectors (id_selector (id_name) @name))) @def
  (mixin_definition (class_name) @name) @def
  (
    (declaration (property_name) @name) @def
    (#match? @name "^@")
  )
`;

const GRAPHQL_SOURCE = `
  (object_type_definition . (name) @name) @def
  (input_object_type_definition . (name) @name) @def
  (enum_type_definition . (name) @name) @def
  (interface_type_definition . (name) @name) @def
  (field_definition . (name) @name) @def
`;

const PROTOBUF_SOURCE = `
  (message (message_name (identifier) @name)) @def
  (enum (enum_name (identifier) @name)) @def
  (enum_field (identifier) @name) @def
  (service (service_name (identifier) @name)) @def
  (rpc (rpc_name (identifier) @name)) @def
  (field (identifier) @name) @def
`;

const HCL_SOURCE = `
  (block . (identifier) . (string_lit (template_literal) @name) . (block_start)) @def
  (block
    . (identifier)
    . (string_lit (template_literal))
    . (string_lit (template_literal) @name)) @def
`;

const COMPONENT_SOURCE = `
  (
    (element
      (start_tag
        (attribute
          (attribute_name) @attr
          (quoted_attribute_value (attribute_value) @name)))) @def
    (#eq? @attr "id")
  )
`;

export const GRAMMARS: Grammar[] = [
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
  {
    extensions: [".java"],
    wasm: wasm("tree-sitter-java", "tree-sitter-java.wasm"),
    source: JAVA_SOURCE,
  },
  {
    extensions: [".c", ".h"],
    wasm: wasm("tree-sitter-c", "tree-sitter-c.wasm"),
    source: C_SOURCE,
  },
  {
    extensions: [".cc", ".cpp", ".cxx", ".hpp", ".hh"],
    wasm: wasm("tree-sitter-cpp", "tree-sitter-cpp.wasm"),
    source: CPP_SOURCE,
  },
  {
    extensions: [".cs"],
    wasm: wasm("tree-sitter-c-sharp", "tree-sitter-c_sharp.wasm"),
    source: CSHARP_SOURCE,
  },
  {
    extensions: [".rb"],
    wasm: wasm("tree-sitter-ruby", "tree-sitter-ruby.wasm"),
    source: RUBY_SOURCE,
  },
  {
    extensions: [".php"],
    wasm: wasm("tree-sitter-php", "tree-sitter-php.wasm"),
    source: PHP_SOURCE,
  },
  {
    extensions: [".kt", ".kts"],
    wasm: wasm("@tree-sitter-grammars/tree-sitter-kotlin", "tree-sitter-kotlin.wasm"),
    source: KOTLIN_SOURCE,
  },
  {
    extensions: [".sh", ".bash"],
    wasm: wasm("tree-sitter-bash", "tree-sitter-bash.wasm"),
    source: BASH_SOURCE,
  },
  {
    extensions: [".sql"],
    wasm: wasm("@l1xnan/tree-sitter-sql", "tree-sitter-sql.wasm"),
    source: SQL_SOURCE,
  },
  {
    extensions: [".json"],
    wasm: wasm("tree-sitter-json", "tree-sitter-json.wasm"),
    source: JSON_SOURCE,
  },
  {
    extensions: [".yml", ".yaml"],
    wasm: wasm("@tree-sitter-grammars/tree-sitter-yaml", "tree-sitter-yaml.wasm"),
    source: YAML_SOURCE,
  },
  {
    extensions: [".toml"],
    wasm: wasm("@tree-sitter-grammars/tree-sitter-toml", "tree-sitter-toml.wasm"),
    source: TOML_SOURCE,
  },
  {
    extensions: [".swift"],
    wasm: wasm("@lumis-sh/wasm-swift", "tree-sitter-swift.wasm"),
    source: SWIFT_SOURCE,
  },
  {
    extensions: [".scala", ".sc"],
    wasm: wasm("tree-sitter-scala", "tree-sitter-scala.wasm"),
    source: SCALA_SOURCE,
  },
  {
    extensions: [".dart"],
    wasm: wasm("@lumis-sh/wasm-dart", "tree-sitter-dart.wasm"),
    source: DART_SOURCE,
  },
  {
    extensions: [".ex", ".exs"],
    wasm: wasm("tree-sitter-elixir", "tree-sitter-elixir.wasm"),
    source: ELIXIR_SOURCE,
  },
  {
    extensions: [".lua"],
    wasm: wasm("@tree-sitter-grammars/tree-sitter-lua", "tree-sitter-lua.wasm"),
    source: LUA_SOURCE,
  },
  {
    extensions: [".zig"],
    wasm: wasm("@tree-sitter-grammars/tree-sitter-zig", "tree-sitter-zig.wasm"),
    source: ZIG_SOURCE,
  },
  {
    extensions: [".groovy", ".gradle"],
    wasm: wasm("@lumis-sh/wasm-groovy", "tree-sitter-groovy.wasm"),
    source: GROOVY_SOURCE,
  },
  {
    extensions: [".ps1"],
    wasm: wasm("tree-sitter-powershell", "tree-sitter-powershell.wasm"),
    source: POWERSHELL_SOURCE,
  },
  {
    extensions: [".scss"],
    wasm: wasm("@lumis-sh/wasm-scss", "tree-sitter-scss.wasm"),
    source: SCSS_SOURCE,
  },
  {
    extensions: [".sass"],
    wasm: local("grammars/tree-sitter-sass.wasm"),
    source: SASS_SOURCE,
  },
  {
    extensions: [".less"],
    wasm: local("grammars/tree-sitter-less.wasm"),
    source: LESS_SOURCE,
  },
  {
    extensions: [".graphql", ".gql"],
    wasm: wasm("@lumis-sh/wasm-graphql", "tree-sitter-graphql.wasm"),
    source: GRAPHQL_SOURCE,
  },
  {
    extensions: [".proto"],
    wasm: wasm("@lumis-sh/wasm-protobuf", "tree-sitter-protobuf.wasm"),
    source: PROTOBUF_SOURCE,
  },
  {
    extensions: [".hcl"],
    wasm: wasm("@tree-sitter-grammars/tree-sitter-hcl", "tree-sitter-hcl.wasm"),
    source: HCL_SOURCE,
  },
  {
    extensions: [".tf"],
    wasm: wasm("@tree-sitter-grammars/tree-sitter-hcl", "tree-sitter-terraform.wasm"),
    source: HCL_SOURCE,
  },
  {
    extensions: [".vue"],
    wasm: wasm("@lumis-sh/wasm-vue", "tree-sitter-vue.wasm"),
    source: COMPONENT_SOURCE,
  },
  {
    extensions: [".svelte"],
    wasm: wasm("@tree-sitter-grammars/tree-sitter-svelte", "tree-sitter-svelte.wasm"),
    source: COMPONENT_SOURCE,
  },
];

