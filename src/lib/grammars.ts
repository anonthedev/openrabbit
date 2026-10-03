import { join } from "node:path";

export type Grammar = {
  extensions: string[];
  filenames?: string[];
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


const OBJC_SOURCE = `
  (class_interface . (identifier) @name) @def
  (class_implementation . (identifier) @name) @def
  (method_declaration (method_type) (identifier) @name) @def
  (method_definition (method_type) (identifier) @name) @def
`;

const HASKELL_SOURCE = `
  (module (module_id) @name) @def
  (signature name: (variable) @name) @def
  (function name: (variable) @name) @def
  (data_type name: (name) @name) @def
`;

const OCAML_SOURCE = `
  (value_definition (let_binding pattern: (value_name) @name)) @def
  (module_definition (module_binding (module_name) @name)) @def
  (type_definition (type_binding name: (type_constructor) @name)) @def
`;

const OCAML_INTERFACE_SOURCE = `
  (value_specification (value_name) @name) @def
  (type_definition (type_binding name: (type_constructor) @name)) @def
`;

const CLOJURE_SOURCE = `
  (
    (list_lit
      . (sym_lit (sym_name) @kw)
      . (sym_lit (sym_name) @name)) @def
    (#match? @kw "^(ns|defn|defn-|def|defmacro)$")
  )
`;

const ERLANG_SOURCE = `
  (module_attribute name: (atom) @name) @def
  (fun_decl (function_clause name: (atom) @name)) @def
`;

const FSHARP_SOURCE = `
  (module_defn (identifier) @name) @def
  (function_declaration_left . (identifier) @name) @def
  (record_type_defn (type_name (identifier) @name)) @def
`;

const JULIA_SOURCE = `
  (function_definition (signature (call_expression (identifier) @name))) @def
  (struct_definition (type_head (identifier) @name)) @def
`;

const R_SOURCE = `
  (binary_operator lhs: (identifier) @name rhs: (function_definition)) @def
`;

const PERL_SOURCE = `
  (subroutine_declaration_statement name: (bareword) @name) @def
  (package_statement name: (package) @name) @def
`;

const SOLIDITY_SOURCE = `
  (contract_declaration name: (identifier) @name) @def
  (function_definition name: (identifier) @name) @def
`;

const NIX_SOURCE = `
  (binding attrpath: (attrpath (identifier) @name)) @def
`;

const PRISMA_SOURCE = `
  (model_block . (identifier) @name) @def
  (enum_block . (identifier) @name) @def
  (model_field field_name: (identifier) @name) @def
`;

const DOCKERFILE_SOURCE = `
  (from_instruction (image_spec (image_name) @name)) @def
  (env_instruction (env_pair name: (unquoted_string) @name)) @def
`;

const MAKE_SOURCE = `
  (rule (targets (word) @name)) @def
`;

const CMAKE_SOURCE = `
  (function_def (function_command (argument_list . (argument (unquoted_argument) @name)))) @def
  (
    (normal_command
      (identifier) @cmd
      (argument_list . (argument (unquoted_argument) @name))) @def
    (#eq? @cmd "set")
  )
`;

const STARLARK_SOURCE = `
  (function_definition name: (identifier) @name) @def
  (assignment left: (identifier) @name) @def
`;

const GLSL_SOURCE = `
  (function_definition
    declarator: (function_declarator declarator: (identifier) @name)) @def
  (struct_specifier name: (type_identifier) @name) @def
`;

const WGSL_SOURCE = `
  (function_declaration name: (identifier) @name) @def
  (struct_declaration name: (identifier) @name) @def
`;

const VERILOG_SOURCE = `
  (module_ansi_header name: (simple_identifier) @name) @def
  (function_body_declaration name: (simple_identifier) @name) @def
`;

const FORTRAN_SOURCE = `
  (subroutine_statement name: (name) @name) @def
  (function_statement name: (name) @name) @def
`;

const LISP_SOURCE = `
  (defun (defun_header function_name: (sym_lit) @name)) @def
`;

const SCHEME_SOURCE = `
  (
    (list . (symbol) @kw . (list . (symbol) @name)) @def
    (#eq? @kw "define")
  )
  (
    (list . (symbol) @kw . (symbol) @name) @def
    (#eq? @kw "define")
  )
`;

const RACKET_SOURCE = `
  (
    (list . (symbol) @kw . (list . (symbol) @name)) @def
    (#eq? @kw "define")
  )
  (
    (list . (symbol) @kw . (symbol) @name) @def
    (#match? @kw "^(define|struct)$")
  )
`;

const ELM_SOURCE = `
  (module_declaration name: (upper_case_qid) @name) @def
  (function_declaration_left (lower_case_identifier) @name) @def
  (type_declaration name: (upper_case_identifier) @name) @def
`;

const FISH_SOURCE = `
  (function_definition name: (word) @name) @def
`;

const ZSH_SOURCE = `
  (function_definition name: (word) @name) @def
  (program (variable_assignment name: (variable_name) @name) @def)
`;

const XML_SOURCE = `
  (element (STag (Name) @name)) @def
  (element (EmptyElemTag (Name) @name)) @def
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

  {
    extensions: [".m", ".mm"],
    wasm: wasm("tree-sitter-objc", "tree-sitter-objc.wasm"),
    source: OBJC_SOURCE,
  },
  {
    extensions: [".hs"],
    wasm: wasm("tree-sitter-haskell", "tree-sitter-haskell.wasm"),
    source: HASKELL_SOURCE,
  },
  {
    extensions: [".ml"],
    wasm: wasm("tree-sitter-ocaml", "tree-sitter-ocaml.wasm"),
    source: OCAML_SOURCE,
  },
  {
    extensions: [".mli"],
    wasm: wasm("tree-sitter-ocaml", "tree-sitter-ocaml_interface.wasm"),
    source: OCAML_INTERFACE_SOURCE,
  },
  {
    extensions: [".clj", ".cljs", ".cljc"],
    wasm: wasm("@lumis-sh/wasm-clojure", "tree-sitter-clojure.wasm"),
    source: CLOJURE_SOURCE,
  },
  {
    extensions: [".erl", ".hrl"],
    wasm: wasm("@lumis-sh/wasm-erlang", "tree-sitter-erlang.wasm"),
    source: ERLANG_SOURCE,
  },
  {
    extensions: [".fs", ".fsx"],
    wasm: wasm("tree-sitter-fsharp", "tree-sitter-fsharp.wasm"),
    source: FSHARP_SOURCE,
  },
  {
    extensions: [".jl"],
    wasm: wasm("tree-sitter-julia", "tree-sitter-julia.wasm"),
    source: JULIA_SOURCE,
  },
  {
    extensions: [".r", ".R"],
    wasm: wasm("@davisvaughan/tree-sitter-r", "tree-sitter-r.wasm"),
    source: R_SOURCE,
  },
  {
    extensions: [".pl", ".pm"],
    wasm: wasm("@lumis-sh/wasm-perl", "tree-sitter-perl.wasm"),
    source: PERL_SOURCE,
  },
  {
    extensions: [".sol"],
    wasm: wasm("tree-sitter-solidity", "tree-sitter-solidity.wasm"),
    source: SOLIDITY_SOURCE,
  },
  {
    extensions: [".nix"],
    wasm: wasm("@lumis-sh/wasm-nix", "tree-sitter-nix.wasm"),
    source: NIX_SOURCE,
  },
  {
    extensions: [".prisma"],
    wasm: wasm("@lumis-sh/wasm-prisma", "tree-sitter-prisma.wasm"),
    source: PRISMA_SOURCE,
  },
  {
    extensions: [".astro"],
    wasm: wasm("@lumis-sh/wasm-astro", "tree-sitter-astro.wasm"),
    source: COMPONENT_SOURCE,
  },
  {
    extensions: [],
    filenames: ["Dockerfile", "Dockerfile*", "dockerfile", "dockerfile*"],
    wasm: wasm("@lumis-sh/wasm-dockerfile", "tree-sitter-dockerfile.wasm"),
    source: DOCKERFILE_SOURCE,
  },
  {
    extensions: [],
    filenames: ["Makefile", "makefile", "GNUmakefile"],
    wasm: wasm("tree-sitter-make", "tree-sitter-make.wasm"),
    source: MAKE_SOURCE,
  },
  {
    extensions: [".cmake"],
    filenames: ["CMakeLists.txt"],
    wasm: wasm("@lumis-sh/wasm-cmake", "tree-sitter-cmake.wasm"),
    source: CMAKE_SOURCE,
  },
  {
    extensions: [".bzl", ".bazel"],
    filenames: ["BUILD", "BUILD.bazel"],
    wasm: wasm("tree-sitter-starlark", "tree-sitter-starlark.wasm"),
    source: STARLARK_SOURCE,
  },
  {
    extensions: [".glsl"],
    wasm: wasm("@lumis-sh/wasm-glsl", "tree-sitter-glsl.wasm"),
    source: GLSL_SOURCE,
  },
  {
    extensions: [".wgsl"],
    wasm: wasm("@lumis-sh/wasm-wgsl", "tree-sitter-wgsl.wasm"),
    source: WGSL_SOURCE,
  },
  {
    extensions: [".v", ".sv"],
    wasm: wasm("@lumis-sh/wasm-systemverilog", "tree-sitter-systemverilog.wasm"),
    source: VERILOG_SOURCE,
  },
  {
    extensions: [".f90", ".f95"],
    wasm: wasm("@lumis-sh/wasm-fortran", "tree-sitter-fortran.wasm"),
    source: FORTRAN_SOURCE,
  },
  {
    extensions: [".lisp"],
    wasm: wasm("@lumis-sh/wasm-commonlisp", "tree-sitter-commonlisp.wasm"),
    source: LISP_SOURCE,
  },
  {
    extensions: [".scm"],
    wasm: wasm("@lumis-sh/wasm-scheme", "tree-sitter-scheme.wasm"),
    source: SCHEME_SOURCE,
  },
  {
    extensions: [".rkt"],
    wasm: wasm("@lumis-sh/wasm-racket", "tree-sitter-racket.wasm"),
    source: RACKET_SOURCE,
  },
  {
    extensions: [".elm"],
    wasm: wasm("@lumis-sh/wasm-elm", "tree-sitter-elm.wasm"),
    source: ELM_SOURCE,
  },
  {
    extensions: [".fish"],
    wasm: wasm("@lumis-sh/wasm-fish", "tree-sitter-fish.wasm"),
    source: FISH_SOURCE,
  },
  {
    extensions: [".zsh"],
    wasm: wasm("@lumis-sh/wasm-zsh", "tree-sitter-zsh.wasm"),
    source: ZSH_SOURCE,
  },
  {
    extensions: [".xml"],
    wasm: wasm("@lumis-sh/wasm-xml", "tree-sitter-xml.wasm"),
    source: XML_SOURCE,
  },
];
