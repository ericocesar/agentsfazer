import type { ChatwootClient } from "@/modules/chatwoot/client";

// The bChat pipeline context for a conversation's card: which funnel/stage it sits in now, the
// funnel's stages (name → id, plus the operator's per-stage note) so kanban_move_card can take a
// STAGE NAME (the agent can't know ids), and a best-effort snapshot of the card's own data
// (custom_name, notes, lead_status, scheduled_at) so the agent SEES the pipeline state instead of
// being blind. Resolved at turn prep (network, outside any tx). Shapes follow
// docs/integrations/bchat/pipeline.md.

export interface KanbanStep {
  id: number;
  name: string;
  // The operator's per-step note in Chatwoot (≤120 chars), if set — explains what the step means.
  // This is the "dedicated description of the funnel steps" surfaced to the agent automatically.
  description?: string;
  // A cancelled step is a lost/dropped bucket (not forward progress); flag it so the agent knows.
  cancelled?: boolean;
}

// Best-effort snapshot of the card's current data per bChat pipeline doc (docs/integrations/bchat/pipeline.md).
// The card response includes conversation_custom_attributes and labels for read-only access; mutations
// go through the conversation endpoints. Any field is null/empty when absent on the payload — the
// loader never throws on a missing field.
export interface KanbanCard {
  // card.custom_name (string)
  customName: string | null;
  // card.notes (text)
  notes: string | null;
  // card.lead_status — "open" | "won" | "lost"
  leadStatus: string | null;
  // card.total_value — sum of card items (numeric)
  value: number | null;
  // card.scheduled_at — single ISO 8601 datetime (replaces old start_date + due_date)
  scheduledAt: string | null;
  // card.assigned_user_id
  assignedUserId: number | null;
  // card.conversation_custom_attributes — read-only, from linked conversation
  conversationCustomAttributes: Record<string, unknown>;
  // card.labels — read-only, inherited from linked conversation. Empty when none.
  labels: string[];
}

export interface KanbanContext {
  taskId: number;
  boardId: number | null;
  boardName: string | null;
  currentStepId: number | null;
  currentStepName: string | null;
  steps: KanbanStep[];
  card: KanbanCard;
}

// Board steps change rarely → cache per board (mirrors handoff/targets + vocab TTL). The task/card
// lookup itself is per-conversation, so it is NOT cached (a card moves between turns).
const STEPS_TTL_MS = 60_000;
const stepsCache = new Map<string, { value: KanbanStep[]; expires: number }>();

// The fork's board_steps#index wraps the array under `steps`; older shapes used `payload` or a bare
// array. Accept all three so a shape drift never silently empties the step list.
function unwrapArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.steps)) return o.steps;
    if (Array.isArray(o.payload)) return o.payload;
  }
  return [];
}

function parseSteps(raw: unknown): KanbanStep[] {
  const out: KanbanStep[] = [];
  for (const item of unwrapArray(raw)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = Number(o.id);
    const name = o.name;
    if (Number.isInteger(id) && id > 0 && typeof name === "string") {
      const step: KanbanStep = { id, name };
      if (typeof o.description === "string" && o.description.trim()) {
        step.description = o.description.trim();
      }
      if (o.cancelled === true) step.cancelled = true;
      out.push(step);
    }
  }
  return out;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function plainAttributes(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

async function loadBoardSteps(
  client: ChatwootClient,
  cacheKey: string,
  boardId: number,
  now: number,
): Promise<KanbanStep[]> {
  const key = `${cacheKey}:${boardId}`;
  const hit = stepsCache.get(key);
  if (hit && hit.expires > now) return hit.value;
  const steps = parseSteps(await client.listKanbanSteps(boardId));
  stepsCache.set(key, { value: steps, expires: now + STEPS_TTL_MS });
  return steps;
}

// Resolves the conversation's card → funnel + current stage + the funnel's stages + the card snapshot.
// Returns null when the conversation has no linked card. Does NOT swallow errors (the caller treats a
// throw as "no kanban context" and the tool degrades). `cacheKey` scopes the stage cache to the
// instance. Field mapping follows bChat pipeline card response (docs/integrations/bchat/pipeline.md).
export async function loadKanbanContext(
  client: ChatwootClient,
  conversationId: number,
  cacheKey: string,
  now: number = Date.now(),
): Promise<KanbanContext | null> {
  // The conversation payload may embed the card under `kanban_task` (old fork) or `card` (bChat).
  const raw = (await client.kanbanTaskForConversation(
    conversationId,
  )) as Record<string, unknown> | null;
  if (raw == null) return null;
  const cardId = Number(raw.id);
  if (!Number.isInteger(cardId) || cardId <= 0) return null;
  // bChat card uses stage_id (not board_step_id) and references funnel via stage's funnel_id.
  // The embedded card may carry stage + funnel info as nested objects or flat ids.
  const stageId = Number(raw.stage_id ?? raw.board_step_id);
  const funnelId = Number(raw.funnel_id ?? raw.board_id);
  const hasFunnel = Number.isInteger(funnelId) && funnelId > 0;
  // Resolve funnel stages (cached per funnel).
  const stages = hasFunnel
    ? await loadBoardSteps(client, cacheKey, funnelId, now)
    : [];
  const currentStage =
    Number.isInteger(stageId) && stageId > 0
      ? (stages.find((s) => s.id === stageId) ?? null)
      : null;
  // bChat card response: funnel name may be nested under `funnel` or `board` object, or flat.
  const funnelName =
    raw.funnel && typeof raw.funnel === "object"
      ? strOrNull((raw.funnel as Record<string, unknown>).name)
      : raw.board && typeof raw.board === "object"
        ? strOrNull((raw.board as Record<string, unknown>).name)
        : null;
  return {
    taskId: cardId,
    boardId: hasFunnel ? funnelId : null,
    boardName: funnelName,
    currentStepId: currentStage?.id ?? null,
    currentStepName: currentStage?.name ?? null,
    steps: stages,
    card: {
      customName: strOrNull(raw.custom_name ?? raw.title),
      notes: strOrNull(raw.notes ?? raw.description),
      leadStatus: strOrNull(raw.lead_status ?? raw.status),
      value: numOrNull(raw.total_value ?? raw.value),
      scheduledAt: strOrNull(raw.scheduled_at),
      assignedUserId: numOrNull(raw.assigned_user_id),
      conversationCustomAttributes: plainAttributes(
        raw.conversation_custom_attributes ?? raw.custom_attributes,
      ),
      labels: Array.isArray(raw.labels)
        ? raw.labels.filter((l): l is string => typeof l === "string")
        : [],
    },
  };
}

// Case-insensitive step-name → step match. Pure; null when nothing matches.
export function matchKanbanStep(
  steps: KanbanStep[],
  name: string,
): KanbanStep | null {
  const lc = name.trim().toLowerCase();
  if (!lc) return null;
  return steps.find((s) => s.name.toLowerCase() === lc) ?? null;
}

// Test-only: drop the step cache so cases don't leak TTL state into one another.
export function __resetKanbanStepsCache(): void {
  stepsCache.clear();
}
