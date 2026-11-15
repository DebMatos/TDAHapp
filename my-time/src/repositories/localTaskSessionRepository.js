import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTaskSession } from '../domain/taskSessionModel';

const STORAGE_KEY = '@my_time_task_sessions_local_v1';

// Todas as alterações são serializadas, incluindo confirmações remotas.
let queue = Promise.resolve();
const enqueue = (operation) => {
  const result = queue.then(operation);
  queue = result.catch(() => {});
  return result;
};

const normalizeList = (sessions) => {
  if (!Array.isArray(sessions)) throw new TypeError('sessions deve ser uma lista.');
  const normalized = sessions.map(normalizeTaskSession);
  if (new Set(normalized.map((session) => session.id)).size !== normalized.length) {
    throw new Error('Existem IDs de sessão repetidos.');
  }
  return normalized;
};

const readState = async () => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === null) {
    return { sessions: [], pendingIds: [], ownerId: null };
  }
  const parsed = JSON.parse(stored);
  if (Array.isArray(parsed)) {
    // Migração sem perda: as sessões antigas ainda não foram enviadas.
    const sessions = normalizeList(parsed);
    return { sessions, pendingIds: sessions.map((item) => item.id), ownerId: null };
  }
  if (!parsed || parsed.schemaVersion !== 2 ||
      !Array.isArray(parsed.sessions) || !Array.isArray(parsed.pendingIds)) {
    throw new Error('Dados locais de sessões inválidos.');
  }
  const sessions = normalizeList(parsed.sessions);
  const ids = new Set(sessions.map((item) => item.id));
  if (parsed.pendingIds.some((id) => !ids.has(id))) {
    throw new Error('Fila de sincronização inválida.');
  }
  if (parsed.ownerId !== null && (typeof parsed.ownerId !== 'string' || !parsed.ownerId)) {
    throw new Error('Proprietário das sessões inválido.');
  }
  return {
    sessions,
    pendingIds: [...new Set(parsed.pendingIds)],
    ownerId: parsed.ownerId,
  };
};

const persist = async (state) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, ...state }));
  return state;
};

export const loadSessions = () => enqueue(async () => (await readState()).sessions);

// Guarda as alterações locais e a respetiva fila na MESMA escrita.
// Nunca apaga sessões remotas já importadas por usar uma lista desatualizada.
export const saveSessions = (sessions) => enqueue(async () => {
  const next = normalizeList(sessions);
  const state = await readState();
  const previous = new Map(state.sessions.map((item) => [item.id, item]));
  const merged = new Map(previous);
  const pending = new Set(state.pendingIds);
  for (const session of next) {
    if (JSON.stringify(previous.get(session.id)) !== JSON.stringify(session)) {
      pending.add(session.id);
      merged.set(session.id, session);
    }
  }
  await persist({ ...state, sessions: [...merged.values()], pendingIds: [...pending] });
  return next;
});

export const loadSessionSyncState = () => enqueue(readState);

export const claimSessionOwner = (userId) => enqueue(async () => {
  if (typeof userId !== 'string' || !userId) throw new Error('Utilizador inválido.');
  const state = await readState();
  if (state.ownerId && state.ownerId !== userId) {
    throw new Error('As sessões locais pertencem a outra conta; sincronização bloqueada.');
  }
  if (!state.ownerId) await persist({ ...state, ownerId: userId });
});

export const confirmSyncedSession = (session) => enqueue(async () => {
  const state = await readState();
  const local = state.sessions.find((item) => item.id === session.id);
  // Se houve uma pausa enquanto o envio decorria, o novo estado continua pendente.
  if (!local || JSON.stringify(local) !== JSON.stringify(normalizeTaskSession(session))) return;
  await persist({ ...state, pendingIds: state.pendingIds.filter((id) => id !== session.id) });
});

export const mergeRemoteSessions = (remoteSessions) => enqueue(async () => {
  const remote = normalizeList(remoteSessions);
  const state = await readState();
  const merged = new Map(state.sessions.map((item) => [item.id, item]));
  const pending = new Set(state.pendingIds);
  const localActive = state.sessions.find((item) => item.endedAt === null);
  for (const item of remote) {
    if (pending.has(item.id)) continue;
    // Não importar uma segunda sessão ativa de outro dispositivo.
    if (item.endedAt === null && localActive && localActive.id !== item.id) continue;
    merged.set(item.id, item);
  }
  await persist({ ...state, sessions: [...merged.values()] });
  return [...merged.values()];
});

export const TASK_SESSION_STORAGE_INFO = {
  schemaVersion: 2,
  key: STORAGE_KEY,
};
