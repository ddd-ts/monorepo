/// <reference lib="webworker" />

import {
  AutoTokenizer,
  AutoModelForImageTextToText,
  env,
} from "@huggingface/transformers";

env.allowLocalModels = false;

// Gemma 3n E2B is a multimodal model (image-text-to-text architecture) with
// mixed fp16/fp32 tensors inside its altup module. The text-generation
// pipeline can't dispatch to it and the uniform "q4f16" dtype trips an ONNX
// type-mismatch error, so we follow the official transformers.js demo: load
// tokenizer + model directly with per-module dtype.
const MODEL_ID = "onnx-community/gemma-3n-E2B-it-ONNX";

const SYSTEM_PROMPT = `You convert natural-language questions about an event-driven system into Cypher queries.

GRAPH SCHEMA
- Node labels (use exactly these, capitalized): Event, Command, Saga, Projection, Effect, Policy
- Node properties: name (string), kind (string, lowercase of the label), file (string, source path), line (number)
- Relationship types (use exactly these, lowercase): emits, reacts, sends
- Edge meanings (note the direction carefully):
  * (:Command)-[:emits]->(:Event)                    a command emits an event
  * (:Event)-[:reacts]->(:Saga|:Projection|:Policy|:Effect)
      semantics: the right-hand handler reacts TO the event.
      So "events that a saga reacts to" matches THIS edge with Event on the
      left and Saga on the right.
  * (:Saga|:Policy)-[:sends]->(:Command)             a saga sends a command

SUPPORTED CYPHER SUBSET
- MATCH with one or more comma-separated patterns
- Node patterns: (var:Label {prop: 'value'})
- Relationship patterns: -[r:type]->, <-[r:type]-, -[r:type]- (multiple types: -[:emits|reacts]->)
- Variable-length: -[:type*1..3]-> (max 5 hops)
- WHERE: =, <>, <, >, <=, >=, AND, OR, NOT, CONTAINS, STARTS WITH, ENDS WITH, IN, =~ (regex)
- RETURN with optional DISTINCT

OUTPUT RULES
- Output ONLY the Cypher query. No prose. No markdown fences. No explanations.
- Use single quotes for string literals.
- The query MUST start with MATCH and end with a RETURN clause.
- Pick label and relationship names exactly from the lists above; never invent new ones.
- WHERE comes AFTER the full MATCH pattern, never inside it. The relationship
  pattern between two nodes must not be split by a WHERE clause.
  WRONG: MATCH (e:Event) WHERE e.name STARTS WITH 'X' -[:reacts]->(s:Saga) RETURN e
  RIGHT: MATCH (e:Event)-[:reacts]->(s:Saga) WHERE e.name STARTS WITH 'X' RETURN e
- Property filters that match a single equality can also live inside the node
  pattern as {key: 'value'}. Use WHERE for STARTS WITH / ENDS WITH / CONTAINS /
  comparisons / boolean combinations.
- RETURN only the entities the user asked about. Identify the SUBJECT of the
  question (usually the noun before the first relative clause like "that…",
  "which…", "where…") and RETURN just that. Other entities mentioned only as
  constraints stay in MATCH but are NOT in RETURN.
  Example: "events that any saga reacts to" → subject is "events" → RETURN e
  Example: "sagas that react to OrderPlaced" → subject is "sagas" → RETURN s
  When in doubt, prefer RETURN DISTINCT on the subject only.

EXAMPLES
Question: show me all commands
Cypher: MATCH (c:Command) RETURN c

Question: which events trigger sagas
Cypher: MATCH (e:Event)-[:reacts]->(:Saga) RETURN DISTINCT e

Question: events that any saga reacts to
Cypher: MATCH (e:Event)-[:reacts]->(:Saga) RETURN DISTINCT e

Question: events that the Shipping saga reacts to
Cypher: MATCH (e:Event)-[:reacts]->(s:Saga) WHERE s.name CONTAINS 'Shipping' RETURN DISTINCT e

Question: events starting with "Ai" that any saga reacts to
Cypher: MATCH (e:Event)-[:reacts]->(:Saga) WHERE e.name STARTS WITH 'Ai' RETURN DISTINCT e

Question: commands ending with Created that emit any event
Cypher: MATCH (c:Command)-[:emits]->(:Event) WHERE c.name ENDS WITH 'Created' RETURN DISTINCT c

Question: sagas that react to OrderPlaced
Cypher: MATCH (:Event {name: 'OrderPlaced'})-[:reacts]->(s:Saga) RETURN DISTINCT s

Question: what is reachable from any command whose name contains Edit, up to 3 hops
Cypher: MATCH (c:Command)-[*1..3]->(n) WHERE c.name CONTAINS 'Edit' RETURN c, n

Question: projections built from any event
Cypher: MATCH (e:Event)-[:reacts]->(p:Projection) RETURN p

Question: commands that sagas send
Cypher: MATCH (s:Saga)-[:sends]->(c:Command) RETURN s, c

Question: events whose name starts with Order
Cypher: MATCH (e:Event) WHERE e.name STARTS WITH 'Order' RETURN e

Question: nodes defined in files containing user
Cypher: MATCH (n) WHERE n.file CONTAINS 'user' RETURN n

Question: any policy reacting to a payment-related event
Cypher: MATCH (e:Event)-[:reacts]->(p:Policy) WHERE e.name CONTAINS 'Payment' RETURN e, p`;

type InMessage =
  | { type: "INIT"; id?: string }
  | { type: "GENERATE"; id: string; payload: { text: string } };

type OutMessage =
  | { type: "PROGRESS"; payload: ProgressInfo }
  | { type: "READY"; id?: string }
  | { type: "RESULT"; id: string; payload: { cypher: string; raw: string } }
  | { type: "ERROR"; id?: string; payload: { message: string } };

interface RawProgress {
  status: string;
  file?: string;
  name?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

interface ProgressInfo {
  status: string;
  file?: string;
  /** 0..100, aggregated across all files in flight. */
  progress?: number;
  loaded?: number;
  total?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTokenizer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = any;

let loadPromise: Promise<{ tokenizer: AnyTokenizer; model: AnyModel }> | null =
  null;

function post(msg: OutMessage) {
  (self as unknown as Worker).postMessage(msg);
}

// Aggregate per-file progress so the UI sees one number across parallel
// downloads instead of whichever file fired last.
const fileBytes = new Map<string, { loaded: number; total: number }>();
let lastSentPercent = -1;
let lastSentTs = 0;

function fileKey(p: RawProgress): string {
  return p.file ?? p.name ?? "unknown";
}

function aggregatePercent(): number {
  let totalLoaded = 0;
  let totalTotal = 0;
  for (const { loaded, total } of fileBytes.values()) {
    totalLoaded += loaded;
    totalTotal += total;
  }
  if (totalTotal === 0) return 0;
  return Math.min(100, (totalLoaded / totalTotal) * 100);
}

function handleRawProgress(p: RawProgress) {
  if (p.status === "progress" || p.status === "download") {
    if (typeof p.total === "number" && p.total > 0) {
      const key = fileKey(p);
      const loaded = typeof p.loaded === "number" ? p.loaded : 0;
      fileBytes.set(key, { loaded, total: p.total });
    }
  } else if (p.status === "done" && typeof p.total === "number") {
    fileBytes.set(fileKey(p), { loaded: p.total, total: p.total });
  }

  const aggPercent = fileBytes.size > 0 ? aggregatePercent() : undefined;

  const now = Date.now();
  const isTransition =
    p.status === "initiate" ||
    p.status === "done" ||
    p.status === "ready";
  const moved =
    aggPercent != null && Math.abs(aggPercent - lastSentPercent) >= 0.5;
  if (!isTransition && !moved && now - lastSentTs < 100) return;
  lastSentTs = now;
  if (aggPercent != null) lastSentPercent = aggPercent;

  post({
    type: "PROGRESS",
    payload: {
      status: p.status,
      file: p.file ?? p.name,
      progress: aggPercent,
      loaded: p.loaded,
      total: p.total,
    },
  });
}

async function ensureLoaded(): Promise<{
  tokenizer: AnyTokenizer;
  model: AnyModel;
}> {
  if (loadPromise) return loadPromise;
  const supportsWebGPU =
    typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined";
  loadPromise = (async () => {
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (p: any) => handleRawProgress(p as RawProgress),
    });
    // Per-module dtype matches the onnx-community/gemma-3n-E2B-it-ONNX demo
    // and avoids the fp16/fp32 Mul mismatch inside the altup module.
    const model = await AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
      dtype: {
        embed_tokens: "q8",
        audio_encoder: "q8",
        vision_encoder: "fp16",
        decoder_model_merged: "q4",
      },
      device: supportsWebGPU ? "webgpu" : "wasm",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (p: any) => handleRawProgress(p as RawProgress),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return { tokenizer, model };
  })();
  return loadPromise;
}

async function generateCypher(
  userText: string,
): Promise<{ cypher: string; raw: string }> {
  const { tokenizer, model } = await ensureLoaded();

  // Gemma 3n's chat template expects content as an array of typed parts.
  const messages = [
    {
      role: "system",
      content: [{ type: "text", text: SYSTEM_PROMPT }],
    },
    {
      role: "user",
      content: [
        { type: "text", text: `Question: ${userText.trim()}\nCypher:` },
      ],
    },
  ];

  const inputs = await tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    tokenize: true,
    return_dict: true,
  });

  const output = await model.generate({
    ...inputs,
    max_new_tokens: 256,
    do_sample: false,
  });

  // generate() returns the full sequence including the prompt; slice off the
  // prompt to keep only newly generated tokens.
  const promptLen: number = inputs.input_ids.dims[1];
  const generatedOnly = output.slice(null, [promptLen, null]);
  const decoded: string[] = tokenizer.batch_decode(generatedOnly, {
    skip_special_tokens: true,
  });
  const raw = String(decoded[0] ?? "").trim();
  const cypher = cleanCypher(raw);
  return { cypher, raw };
}

function cleanCypher(text: string): string {
  let t = text.trim();
  // strip ```cypher ... ``` or ``` ... ```
  t = t.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```\s*$/m, "").trim();
  // strip leading "Cypher:" prefix the model may echo
  t = t.replace(/^cypher\s*:\s*/i, "").trim();
  // grab from first MATCH (case-insensitive)
  const idx = t.search(/\bMATCH\b/i);
  if (idx > 0) t = t.slice(idx).trim();
  // cut off after first blank line (everything after is usually commentary)
  const blank = t.search(/\n\s*\n/);
  if (blank > -1) t = t.slice(0, blank).trim();
  // trim trailing semicolon
  t = t.replace(/;\s*$/, "").trim();
  return t;
}

self.addEventListener("message", async (event: MessageEvent<InMessage>) => {
  const msg = event.data;
  try {
    if (msg.type === "INIT") {
      await ensureLoaded();
      post({ type: "READY", id: msg.id });
      return;
    }
    if (msg.type === "GENERATE") {
      const result = await generateCypher(msg.payload.text);
      post({ type: "RESULT", id: msg.id, payload: result });
      return;
    }
  } catch (err) {
    post({
      type: "ERROR",
      id: (msg as { id?: string }).id,
      payload: { message: (err as Error).message },
    });
  }
});
