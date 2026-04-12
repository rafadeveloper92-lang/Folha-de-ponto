/** Formato esperado do JSON remoto (URL configurável). */

export type RemoteMessagePayload = {
  id: string;
  title: string;
  body: string;
  createdAt?: number;
};

function normalizeRemote(raw: unknown): RemoteMessagePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : '';
  const title = o.title != null ? String(o.title) : '';
  const body = o.body != null ? String(o.body) : '';
  if (!id || !title) return null;
  const createdAt =
    typeof o.createdAt === 'number'
      ? o.createdAt
      : typeof o.created_at === 'number'
        ? o.created_at
        : Date.now();
  return {id, title, body, createdAt};
}

/**
 * GET JSON: array de mensagens ou `{ "messages": [...] }`.
 * Cada item: `{ id, title, body, createdAt? }`.
 */
export async function fetchRemoteMessages(url: string): Promise<RemoteMessagePayload[]> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('URL vazia');
  const res = await fetch(trimmed, {cache: 'no-store', credentials: 'omit'});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: unknown = await res.json();
  const list = Array.isArray(data) ? data : (data as {messages?: unknown}).messages;
  if (!Array.isArray(list)) throw new Error('Resposta sem lista de mensagens');
  const out: RemoteMessagePayload[] = [];
  for (const item of list) {
    const m = normalizeRemote(item);
    if (m) out.push(m);
  }
  return out;
}
