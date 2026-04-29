import type { GraphEdge, GraphNode } from "../../shared/types.js";
import type { GraphIndex } from "./graph.js";

// =====================================================================
// AST
// =====================================================================

export interface CypherQuery {
  match: PatternPart[];
  where?: Expr;
  ret: ReturnClause;
}

export interface PatternPart {
  nodes: NodePat[];
  rels: RelPat[]; // length nodes.length - 1
}

export interface NodePat {
  variable: string;
  hasVariable: boolean;
  labels: string[]; // matched against GraphNode.kind, case-insensitive
  props: PropMap;
}

export interface RelPat {
  variable: string;
  hasVariable: boolean;
  types: string[]; // matched against GraphEdge.kind, case-insensitive; empty = any
  direction: "forward" | "reversed" | "undirected";
  props: PropMap;
  minHops: number;
  maxHops: number;
  isVariableLength: boolean;
}

export type PropMap = Record<string, Literal>;

export type Literal =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "null" };

export type CmpOp =
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">="
  | "CONTAINS"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "IN"
  | "=~";

export type Expr =
  | { type: "and"; left: Expr; right: Expr }
  | { type: "or"; left: Expr; right: Expr }
  | { type: "not"; expr: Expr }
  | { type: "cmp"; op: CmpOp; left: Expr; right: Expr }
  | { type: "prop"; variable: string; key: string }
  | { type: "var"; name: string }
  | { type: "lit"; value: Literal }
  | { type: "list"; items: Expr[] };

export interface ReturnClause {
  star: boolean;
  items: ReturnItem[];
  distinct: boolean;
}

export interface ReturnItem {
  expr: Expr;
  alias?: string;
}

// =====================================================================
// Lexer
// =====================================================================

type TokenKind =
  | "IDENT"
  | "NUMBER"
  | "STRING"
  | "LPAREN"
  | "RPAREN"
  | "LBRACK"
  | "RBRACK"
  | "LBRACE"
  | "RBRACE"
  | "COMMA"
  | "COLON"
  | "DOT"
  | "DOTDOT"
  | "PIPE"
  | "STAR"
  | "MINUS"
  | "LARROW"
  | "RARROW"
  | "LT"
  | "GT"
  | "LE"
  | "GE"
  | "EQ"
  | "NEQ"
  | "REGEX"
  | "EOF";

interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

class Lexer {
  private i = 0;
  constructor(private src: string) {}

  private peek(off = 0): string | undefined {
    return this.src[this.i + off];
  }

  tokenize(): Token[] {
    const out: Token[] = [];
    while (true) {
      const t = this.next();
      out.push(t);
      if (t.kind === "EOF") return out;
    }
  }

  private next(): Token {
    while (this.i < this.src.length && /\s/.test(this.src[this.i]!)) this.i++;
    if (this.i >= this.src.length) {
      return { kind: "EOF", value: "", pos: this.i };
    }
    const start = this.i;
    const c = this.src[this.i]!;

    if (c === '"' || c === "'") return this.readString(c, start);
    if (/[0-9]/.test(c)) return this.readNumber(start);
    if (/[A-Za-z_]/.test(c)) return this.readIdent(start);

    // multi-char operators
    const next2 = this.src.slice(this.i, this.i + 2);
    const two: Record<string, TokenKind> = {
      "<-": "LARROW",
      "->": "RARROW",
      "<=": "LE",
      "<>": "NEQ",
      ">=": "GE",
      "=~": "REGEX",
      "..": "DOTDOT",
    };
    if (two[next2]) {
      this.i += 2;
      return { kind: two[next2], value: next2, pos: start };
    }

    this.i++;
    const single: Record<string, TokenKind> = {
      "(": "LPAREN",
      ")": "RPAREN",
      "[": "LBRACK",
      "]": "RBRACK",
      "{": "LBRACE",
      "}": "RBRACE",
      ",": "COMMA",
      ":": "COLON",
      ".": "DOT",
      "|": "PIPE",
      "*": "STAR",
      "-": "MINUS",
      "<": "LT",
      ">": "GT",
      "=": "EQ",
    };
    if (single[c]) return { kind: single[c], value: c, pos: start };
    throw new Error(`Unexpected character '${c}' at ${start}`);
  }

  private readString(quote: string, start: number): Token {
    this.i++;
    let val = "";
    while (this.i < this.src.length && this.src[this.i] !== quote) {
      if (this.src[this.i] === "\\") {
        this.i++;
        const esc = this.src[this.i] ?? "";
        if (esc === "n") val += "\n";
        else if (esc === "t") val += "\t";
        else if (esc === "r") val += "\r";
        else val += esc;
        this.i++;
      } else {
        val += this.src[this.i++];
      }
    }
    if (this.src[this.i] !== quote) {
      throw new Error(`Unterminated string at ${start}`);
    }
    this.i++;
    return { kind: "STRING", value: val, pos: start };
  }

  private readNumber(start: number): Token {
    let val = "";
    while (this.i < this.src.length) {
      const c = this.src[this.i]!;
      if (/[0-9]/.test(c)) {
        val += c;
        this.i++;
      } else if (c === "." && this.peek(1) !== ".") {
        val += c;
        this.i++;
      } else {
        break;
      }
    }
    return { kind: "NUMBER", value: val, pos: start };
  }

  private readIdent(start: number): Token {
    let val = "";
    while (this.i < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.i]!)) {
      val += this.src[this.i++];
    }
    return { kind: "IDENT", value: val, pos: start };
  }
}

// =====================================================================
// Parser
// =====================================================================

const KEYWORDS = new Set([
  "MATCH",
  "WHERE",
  "RETURN",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "CONTAINS",
  "STARTS",
  "ENDS",
  "WITH",
  "TRUE",
  "FALSE",
  "NULL",
  "DISTINCT",
]);

class Parser {
  private toks: Token[];
  private p = 0;
  private synthCounter = 0;

  constructor(src: string) {
    this.toks = new Lexer(src).tokenize();
  }

  parse(): CypherQuery {
    this.expectKeyword("MATCH");
    const match = this.parsePatternList();
    let where: Expr | undefined;
    if (this.peekKeyword("WHERE")) {
      this.advance();
      where = this.parseExpr();
    }
    this.expectKeyword("RETURN");
    const ret = this.parseReturn();
    if (this.peek().kind !== "EOF") {
      throw new Error(
        `Unexpected token '${this.peek().value}' at ${this.peek().pos}`,
      );
    }
    return { match, where, ret };
  }

  // pattern, pattern, ...
  private parsePatternList(): PatternPart[] {
    const parts: PatternPart[] = [this.parsePattern()];
    while (this.peek().kind === "COMMA") {
      this.advance();
      parts.push(this.parsePattern());
    }
    return parts;
  }

  // (n) ((-[]->|<-[]-|--|-->|<--|-[]-) (n))*
  private parsePattern(): PatternPart {
    const nodes: NodePat[] = [this.parseNode()];
    const rels: RelPat[] = [];
    while (
      this.peek().kind === "MINUS" ||
      this.peek().kind === "LARROW"
    ) {
      rels.push(this.parseRel());
      nodes.push(this.parseNode());
    }
    return { nodes, rels };
  }

  private parseNode(): NodePat {
    this.expect("LPAREN");
    let variable = "";
    let hasVariable = false;
    if (this.peek().kind === "IDENT" && !this.isKeywordTok(this.peek())) {
      variable = this.advance().value;
      hasVariable = true;
    }
    const labels: string[] = [];
    while (this.peek().kind === "COLON") {
      this.advance();
      const label = this.expect("IDENT").value;
      labels.push(label);
    }
    let props: PropMap = {};
    if (this.peek().kind === "LBRACE") {
      props = this.parsePropMap();
    }
    this.expect("RPAREN");
    if (!hasVariable) variable = `__n${this.synthCounter++}`;
    return { variable, hasVariable, labels, props };
  }

  // start: '-' or '<-'
  // detail: optionally [var? (':' Type ('|' Type)*)? ('*' (N)? ('..' (N)?)?)? ('{' props '}')?]
  // end: '-' or '->'
  private parseRel(): RelPat {
    const start = this.advance(); // MINUS or LARROW
    if (start.kind !== "MINUS" && start.kind !== "LARROW") {
      throw new Error(`Expected start of relationship at ${start.pos}`);
    }
    let variable = "";
    let hasVariable = false;
    const types: string[] = [];
    let props: PropMap = {};
    let minHops = 1;
    let maxHops = 1;
    let isVariableLength = false;

    if (this.peek().kind === "LBRACK") {
      this.advance();
      // optional variable
      if (
        this.peek().kind === "IDENT" &&
        !this.isKeywordTok(this.peek()) &&
        this.peekAt(1).kind !== "DOT"
      ) {
        variable = this.advance().value;
        hasVariable = true;
      }
      // optional types
      if (this.peek().kind === "COLON") {
        this.advance();
        types.push(this.expect("IDENT").value);
        while (this.peek().kind === "PIPE") {
          this.advance();
          types.push(this.expect("IDENT").value);
        }
      }
      // optional variable-length
      if (this.peek().kind === "STAR") {
        this.advance();
        isVariableLength = true;
        minHops = 1;
        maxHops = 5; // sane default cap
        if (this.peek().kind === "NUMBER") {
          minHops = parseInt(this.advance().value, 10);
          maxHops = minHops;
          if (this.peek().kind === "DOTDOT") {
            this.advance();
            if (this.peek().kind === "NUMBER") {
              maxHops = parseInt(this.advance().value, 10);
            } else {
              maxHops = 5;
            }
          }
        } else if (this.peek().kind === "DOTDOT") {
          this.advance();
          minHops = 1;
          if (this.peek().kind === "NUMBER") {
            maxHops = parseInt(this.advance().value, 10);
          } else {
            maxHops = 5;
          }
        }
      }
      // optional props
      if (this.peek().kind === "LBRACE") {
        props = this.parsePropMap();
      }
      this.expect("RBRACK");
    }

    // closing dash/arrow
    let direction: "forward" | "reversed" | "undirected";
    const end = this.advance();
    if (start.kind === "LARROW") {
      if (end.kind !== "MINUS") {
        throw new Error(
          `Expected '-' to close left-pointing relationship at ${end.pos}`,
        );
      }
      direction = "reversed";
    } else {
      // MINUS
      if (end.kind === "RARROW") direction = "forward";
      else if (end.kind === "MINUS") direction = "undirected";
      else {
        throw new Error(
          `Expected '-' or '->' to close relationship at ${end.pos}`,
        );
      }
    }

    if (!hasVariable) variable = `__r${this.synthCounter++}`;
    return {
      variable,
      hasVariable,
      types,
      direction,
      props,
      minHops,
      maxHops,
      isVariableLength,
    };
  }

  private parsePropMap(): PropMap {
    this.expect("LBRACE");
    const map: PropMap = {};
    if (this.peek().kind !== "RBRACE") {
      this.parsePropEntry(map);
      while (this.peek().kind === "COMMA") {
        this.advance();
        this.parsePropEntry(map);
      }
    }
    this.expect("RBRACE");
    return map;
  }

  private parsePropEntry(map: PropMap) {
    const key = this.expect("IDENT").value;
    this.expect("COLON");
    map[key] = this.parseLiteral();
  }

  private parseLiteral(): Literal {
    const t = this.peek();
    if (t.kind === "STRING") {
      this.advance();
      return { type: "string", value: t.value };
    }
    if (t.kind === "NUMBER") {
      this.advance();
      return { type: "number", value: parseFloat(t.value) };
    }
    if (t.kind === "MINUS") {
      this.advance();
      const num = this.expect("NUMBER");
      return { type: "number", value: -parseFloat(num.value) };
    }
    if (t.kind === "IDENT") {
      const upper = t.value.toUpperCase();
      if (upper === "TRUE") {
        this.advance();
        return { type: "boolean", value: true };
      }
      if (upper === "FALSE") {
        this.advance();
        return { type: "boolean", value: false };
      }
      if (upper === "NULL") {
        this.advance();
        return { type: "null" };
      }
    }
    throw new Error(`Expected literal at ${t.pos}, got '${t.value}'`);
  }

  // expression precedence: OR < AND < NOT < comparison < primary
  private parseExpr(): Expr {
    return this.parseOr();
  }
  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.peekKeyword("OR")) {
      this.advance();
      const right = this.parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }
  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.peekKeyword("AND")) {
      this.advance();
      const right = this.parseNot();
      left = { type: "and", left, right };
    }
    return left;
  }
  private parseNot(): Expr {
    if (this.peekKeyword("NOT")) {
      this.advance();
      return { type: "not", expr: this.parseNot() };
    }
    return this.parseCmp();
  }
  private parseCmp(): Expr {
    const left = this.parsePrimary();
    const t = this.peek();
    let op: CmpOp | null = null;
    if (t.kind === "EQ") op = "=";
    else if (t.kind === "NEQ") op = "<>";
    else if (t.kind === "LT") op = "<";
    else if (t.kind === "GT") op = ">";
    else if (t.kind === "LE") op = "<=";
    else if (t.kind === "GE") op = ">=";
    else if (t.kind === "REGEX") op = "=~";
    else if (this.peekKeyword("CONTAINS")) op = "CONTAINS";
    else if (this.peekKeyword("IN")) op = "IN";
    else if (this.peekKeyword("STARTS")) {
      this.advance();
      this.expectKeyword("WITH");
      const right = this.parsePrimary();
      return { type: "cmp", op: "STARTS_WITH", left, right };
    } else if (this.peekKeyword("ENDS")) {
      this.advance();
      this.expectKeyword("WITH");
      const right = this.parsePrimary();
      return { type: "cmp", op: "ENDS_WITH", left, right };
    }
    if (op) {
      this.advance();
      const right = this.parsePrimary();
      return { type: "cmp", op, left, right };
    }
    return left;
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.kind === "LPAREN") {
      this.advance();
      const e = this.parseExpr();
      this.expect("RPAREN");
      return e;
    }
    if (t.kind === "LBRACK") {
      // list literal
      this.advance();
      const items: Expr[] = [];
      if (this.peek().kind !== "RBRACK") {
        items.push(this.parseExpr());
        while (this.peek().kind === "COMMA") {
          this.advance();
          items.push(this.parseExpr());
        }
      }
      this.expect("RBRACK");
      return { type: "list", items };
    }
    if (t.kind === "STRING") {
      this.advance();
      return { type: "lit", value: { type: "string", value: t.value } };
    }
    if (t.kind === "NUMBER") {
      this.advance();
      return {
        type: "lit",
        value: { type: "number", value: parseFloat(t.value) },
      };
    }
    if (t.kind === "MINUS") {
      this.advance();
      const num = this.expect("NUMBER");
      return {
        type: "lit",
        value: { type: "number", value: -parseFloat(num.value) },
      };
    }
    if (t.kind === "IDENT") {
      const upper = t.value.toUpperCase();
      if (upper === "TRUE") {
        this.advance();
        return { type: "lit", value: { type: "boolean", value: true } };
      }
      if (upper === "FALSE") {
        this.advance();
        return { type: "lit", value: { type: "boolean", value: false } };
      }
      if (upper === "NULL") {
        this.advance();
        return { type: "lit", value: { type: "null" } };
      }
      this.advance();
      // var or var.prop
      if (this.peek().kind === "DOT") {
        this.advance();
        const key = this.expect("IDENT").value;
        return { type: "prop", variable: t.value, key };
      }
      return { type: "var", name: t.value };
    }
    throw new Error(`Unexpected token '${t.value}' at ${t.pos}`);
  }

  private parseReturn(): ReturnClause {
    let distinct = false;
    if (this.peekKeyword("DISTINCT")) {
      this.advance();
      distinct = true;
    }
    if (this.peek().kind === "STAR") {
      this.advance();
      // optional more items after *
      const items: ReturnItem[] = [];
      while (this.peek().kind === "COMMA") {
        this.advance();
        items.push(this.parseReturnItem());
      }
      return { star: true, items, distinct };
    }
    const items: ReturnItem[] = [this.parseReturnItem()];
    while (this.peek().kind === "COMMA") {
      this.advance();
      items.push(this.parseReturnItem());
    }
    return { star: false, items, distinct };
  }

  private parseReturnItem(): ReturnItem {
    const expr = this.parseExpr();
    let alias: string | undefined;
    if (this.peekKeyword("AS")) {
      this.advance();
      alias = this.expect("IDENT").value;
    }
    return { expr, alias };
  }

  // ---- token utils ----

  private peek(): Token {
    return this.toks[this.p]!;
  }
  private peekAt(off: number): Token {
    return this.toks[this.p + off] ?? this.toks[this.toks.length - 1]!;
  }
  private advance(): Token {
    return this.toks[this.p++]!;
  }
  private expect(kind: TokenKind): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new Error(`Expected ${kind} at ${t.pos}, got '${t.value}'`);
    }
    return this.advance();
  }
  private isKeywordTok(t: Token): boolean {
    return t.kind === "IDENT" && KEYWORDS.has(t.value.toUpperCase());
  }
  private peekKeyword(kw: string): boolean {
    const t = this.peek();
    return t.kind === "IDENT" && t.value.toUpperCase() === kw;
  }
  private expectKeyword(kw: string): Token {
    const t = this.peek();
    if (t.kind !== "IDENT" || t.value.toUpperCase() !== kw) {
      throw new Error(`Expected keyword ${kw} at ${t.pos}, got '${t.value}'`);
    }
    return this.advance();
  }
}

export function parseCypher(src: string): CypherQuery {
  return new Parser(src).parse();
}

// =====================================================================
// Executor
// =====================================================================

type BoundValue =
  | { kind: "node"; node: GraphNode }
  | { kind: "edge"; edge: GraphEdge }
  | { kind: "path"; edges: GraphEdge[] };

type Binding = Record<string, BoundValue>;

export interface CypherResult {
  /** Distinct node IDs referenced by RETURN (or any node variable when RETURN *). */
  nodeIds: Set<string>;
  /** Number of bindings (rows) the query produced. */
  rowCount: number;
}

const MAX_BINDINGS = 50_000;

export function executeCypher(
  src: string,
  index: GraphIndex,
): CypherResult {
  const query = parseCypher(src);
  const bindings: Binding[] = [];
  enumerateParts(query.match, 0, {}, index, (b) => {
    if (query.where && !truthy(evalExpr(query.where, b))) return;
    bindings.push(b);
    if (bindings.length >= MAX_BINDINGS) {
      throw new Error(
        `Query produced more than ${MAX_BINDINGS} matches — refine the pattern`,
      );
    }
  });

  // collect node IDs from RETURN
  const wantedVars = collectReturnVars(query.ret, query.match);
  const nodeIds = new Set<string>();
  for (const b of bindings) {
    for (const v of wantedVars) {
      const val = b[v];
      if (!val) continue;
      if (val.kind === "node") nodeIds.add(val.node.id);
      else if (val.kind === "edge") {
        nodeIds.add(val.edge.from);
        nodeIds.add(val.edge.to);
      } else if (val.kind === "path") {
        for (const e of val.edges) {
          nodeIds.add(e.from);
          nodeIds.add(e.to);
        }
      }
    }
  }
  return { nodeIds, rowCount: bindings.length };
}

function collectReturnVars(
  ret: ReturnClause,
  match: PatternPart[],
): string[] {
  if (ret.star) {
    // all user-named variables
    const all = new Set<string>();
    for (const p of match) {
      for (const n of p.nodes) if (n.hasVariable) all.add(n.variable);
      for (const r of p.rels) if (r.hasVariable) all.add(r.variable);
    }
    // include extra items if any
    for (const it of ret.items) {
      for (const v of varsInExpr(it.expr)) all.add(v);
    }
    if (all.size === 0) {
      // RETURN * with no named vars — fall back to all synthetic node vars
      for (const p of match) for (const n of p.nodes) all.add(n.variable);
    }
    return [...all];
  }
  const all = new Set<string>();
  for (const it of ret.items) {
    for (const v of varsInExpr(it.expr)) all.add(v);
  }
  return [...all];
}

function varsInExpr(e: Expr): string[] {
  switch (e.type) {
    case "var":
      return [e.name];
    case "prop":
      return [e.variable];
    case "lit":
      return [];
    case "not":
      return varsInExpr(e.expr);
    case "and":
    case "or":
    case "cmp":
      return [...varsInExpr(e.left), ...varsInExpr(e.right)];
    case "list":
      return e.items.flatMap(varsInExpr);
  }
}

function enumerateParts(
  parts: PatternPart[],
  i: number,
  binding: Binding,
  index: GraphIndex,
  emit: (b: Binding) => void,
) {
  if (i === parts.length) {
    emit(binding);
    return;
  }
  enumeratePart(parts[i]!, binding, index, (b2) =>
    enumerateParts(parts, i + 1, b2, index, emit),
  );
}

function enumeratePart(
  part: PatternPart,
  binding: Binding,
  index: GraphIndex,
  emit: (b: Binding) => void,
) {
  enumerateNode(part.nodes[0]!, binding, index, (b1) => {
    walkPart(part, 0, b1, index, emit);
  });
}

function walkPart(
  part: PatternPart,
  i: number,
  binding: Binding,
  index: GraphIndex,
  emit: (b: Binding) => void,
) {
  if (i === part.rels.length) {
    emit(binding);
    return;
  }
  const rel = part.rels[i]!;
  const fromPat = part.nodes[i]!;
  const toPat = part.nodes[i + 1]!;
  const fromVal = binding[fromPat.variable];
  if (!fromVal || fromVal.kind !== "node") return;
  const fromNode = fromVal.node;
  enumerateRelStep(rel, fromNode, binding, index, (b2, nextNode) => {
    bindNodeAt(toPat, nextNode, b2, (b3) => {
      walkPart(part, i + 1, b3, index, emit);
    });
  });
}

function enumerateNode(
  pat: NodePat,
  binding: Binding,
  index: GraphIndex,
  visit: (b: Binding) => void,
) {
  const existing = binding[pat.variable];
  if (existing) {
    if (existing.kind !== "node") return;
    if (!nodeMatches(pat, existing.node)) return;
    visit(binding);
    return;
  }
  for (const node of index.nodes) {
    if (!nodeMatches(pat, node)) continue;
    visit({ ...binding, [pat.variable]: { kind: "node", node } });
  }
}

function bindNodeAt(
  pat: NodePat,
  node: GraphNode,
  binding: Binding,
  visit: (b: Binding) => void,
) {
  if (!nodeMatches(pat, node)) return;
  const existing = binding[pat.variable];
  if (existing) {
    if (existing.kind !== "node" || existing.node.id !== node.id) return;
    visit(binding);
    return;
  }
  visit({ ...binding, [pat.variable]: { kind: "node", node } });
}

function enumerateRelStep(
  rel: RelPat,
  fromNode: GraphNode,
  binding: Binding,
  index: GraphIndex,
  visit: (b: Binding, nextNode: GraphNode) => void,
) {
  for (let L = rel.minHops; L <= rel.maxHops; L++) {
    expandPath(rel, fromNode, [], L, binding, index, visit);
  }
}

function expandPath(
  rel: RelPat,
  current: GraphNode,
  edgesSoFar: GraphEdge[],
  remaining: number,
  binding: Binding,
  index: GraphIndex,
  visit: (b: Binding, nextNode: GraphNode) => void,
) {
  if (remaining === 0) {
    let b2 = binding;
    if (rel.hasVariable) {
      if (rel.isVariableLength) {
        b2 = { ...binding, [rel.variable]: { kind: "path", edges: edgesSoFar } };
      } else {
        b2 = {
          ...binding,
          [rel.variable]: { kind: "edge", edge: edgesSoFar[0]! },
        };
      }
    }
    visit(b2, current);
    return;
  }
  const candidates = candidateEdges(rel, current, index);
  for (const { edge, next } of candidates) {
    if (!relMatches(rel, edge)) continue;
    if (edgesSoFar.includes(edge)) continue; // avoid trivial loops in var-length
    expandPath(
      rel,
      next,
      [...edgesSoFar, edge],
      remaining - 1,
      binding,
      index,
      visit,
    );
  }
}

function candidateEdges(
  rel: RelPat,
  current: GraphNode,
  index: GraphIndex,
): { edge: GraphEdge; next: GraphNode }[] {
  const out: { edge: GraphEdge; next: GraphNode }[] = [];
  if (rel.direction === "forward" || rel.direction === "undirected") {
    for (const e of index.outgoing[current.id] || []) {
      const n = index.byId[e.to];
      if (n) out.push({ edge: e, next: n });
    }
  }
  if (rel.direction === "reversed" || rel.direction === "undirected") {
    for (const e of index.incoming[current.id] || []) {
      const n = index.byId[e.from];
      if (n) out.push({ edge: e, next: n });
    }
  }
  return out;
}

function nodeMatches(pat: NodePat, node: GraphNode): boolean {
  for (const label of pat.labels) {
    if (node.kind.toLowerCase() !== label.toLowerCase()) return false;
  }
  for (const [k, v] of Object.entries(pat.props)) {
    const actual = (node as unknown as Record<string, unknown>)[k];
    if (!literalEquals(actual, v)) return false;
  }
  return true;
}

function relMatches(rel: RelPat, edge: GraphEdge): boolean {
  if (rel.types.length > 0) {
    const ok = rel.types.some(
      (t) => edge.kind.toLowerCase() === t.toLowerCase(),
    );
    if (!ok) return false;
  }
  for (const [k, v] of Object.entries(rel.props)) {
    const actual = (edge as unknown as Record<string, unknown>)[k];
    if (!literalEquals(actual, v)) return false;
  }
  return true;
}

function literalEquals(actual: unknown, lit: Literal): boolean {
  if (lit.type === "null") return actual == null;
  if (lit.type === "string") return actual === lit.value;
  if (lit.type === "number") return actual === lit.value;
  if (lit.type === "boolean") return actual === lit.value;
  return false;
}

// ---- expr eval ----

type Value = string | number | boolean | null | unknown[] | undefined;

function evalExpr(e: Expr, b: Binding): Value {
  switch (e.type) {
    case "lit":
      return e.value.type === "null" ? null : e.value.value;
    case "var": {
      const v = b[e.name];
      if (!v) return undefined;
      if (v.kind === "node") return v.node.id;
      if (v.kind === "edge") return v.edge.kind;
      return undefined;
    }
    case "prop": {
      const v = b[e.variable];
      if (!v) return undefined;
      if (v.kind === "node") {
        return (v.node as unknown as Record<string, unknown>)[e.key] as Value;
      }
      if (v.kind === "edge") {
        return (v.edge as unknown as Record<string, unknown>)[e.key] as Value;
      }
      return undefined;
    }
    case "list":
      return e.items.map((x) => evalExpr(x, b));
    case "and":
      return truthy(evalExpr(e.left, b)) && truthy(evalExpr(e.right, b));
    case "or":
      return truthy(evalExpr(e.left, b)) || truthy(evalExpr(e.right, b));
    case "not":
      return !truthy(evalExpr(e.expr, b));
    case "cmp": {
      const l = evalExpr(e.left, b);
      const r = evalExpr(e.right, b);
      return evalCmp(e.op, l, r);
    }
  }
}

function truthy(v: Value): boolean {
  return v !== false && v != null && v !== "" && v !== 0;
}

function evalCmp(op: CmpOp, l: Value, r: Value): boolean {
  if (op === "=") return l === r;
  if (op === "<>") return l !== r;
  if (op === "<") return cmpOrder(l, r) < 0;
  if (op === ">") return cmpOrder(l, r) > 0;
  if (op === "<=") return cmpOrder(l, r) <= 0;
  if (op === ">=") return cmpOrder(l, r) >= 0;
  if (op === "CONTAINS") return String(l ?? "").includes(String(r ?? ""));
  if (op === "STARTS_WITH") return String(l ?? "").startsWith(String(r ?? ""));
  if (op === "ENDS_WITH") return String(l ?? "").endsWith(String(r ?? ""));
  if (op === "IN") return Array.isArray(r) && r.includes(l as never);
  if (op === "=~") {
    try {
      return new RegExp(String(r ?? "")).test(String(l ?? ""));
    } catch {
      return false;
    }
  }
  return false;
}

function cmpOrder(a: Value, b: Value): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}
