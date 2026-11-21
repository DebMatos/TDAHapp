import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTaskSession } from '../domain/taskSessionModel';

const LEGACY_STORAGE_KEY = '@my_time_task_sessions_local_v1';
const STORAGE_PREFIX = '@my_time_task_sessions_local_v3:';
let activeUserId = null;

const storageContext = (requestedUserId = activeUserId) => {
  if (!requestedUserId) throw new Error('É necessária uma conta para aceder às sessões locais.');
  if (requestedUserId !== activeUserId) {
    throw new Error('A conta foi alterada durante a operação local.');
  }
  return {
    userId: requestedUserId,
    key: `${STORAGE_PREFIX}${encodeURIComponent(requestedUserId)}`,
  };
};

export const getTaskSessionRepositoryUser = () => storageContext().userId;

export const setTaskSessionRepositoryUser = (userId) => {
  activeUserId = typeof userId === 'string' && userId ? userId : null;
  AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(error => {
    console.warn('[Sessions] Não foi possível remover dados locais sem proprietário:', error);
  });
};

// Todas as alterações são serializadas, incluindo confirmações remotas.
let queue = Promise.resolve();
const enqueue = (operation, userId = activeUserId) => {
  const context = storageContext(userId);
  const result = queue.then(() => {
    storageContext(context.userId);
    return operation(context);
  });
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

const readState = async (context) => {
  const stored = await AsyncStorage.getItem(context.key);
  if (stored === null) {
    return { sessions: [], pendingIds: [], ownerId: context.userId };
  }
  const parsed = JSON.parse(stored);
  if (Array.isArray(parsed)) {
    // Migração sem perda: as sessões antigas ainda não foram enviadas.
    const sessions = normalizeList(parsed);
    return { sessions, pendingIds: sessions.map((item) => item.id), ownerId: context.userId };
  }
  if (!parsed || parsed.schemaVersion !== 3 ||
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

const persist = async (context, state) => {
  await AsyncStorage.setItem(context.key, JSON.stringify({ schemaVersion: 3, ...state }));
  return state;
};

export const loadSessions = (userId) => enqueue(
  async context => (await readState(context)).sessions, userId,
);

// Guarda as alterações locais e a respetiva fila na MESMA escrita.
// Nunca apaga sessões remotas já importadas por usar uma lista desatualizada.
export const saveSessions = (sessions, userId) => enqueue(async context => {
  const next = normalizeList(sessions);
  const state = await readState(context);
  const previous = new Map(state.sessions.map((item) => [item.id, item]));
  const merged = new Map(previous);
  const pending = new Set(state.pendingIds);
  for (const session of next) {
    if (JSON.stringify(previous.get(session.id)) !== JSON.stringify(session)) {
      pending.add(session.id);
      merged.set(session.id, session);
    }
  }
  await persist(context, { ...state, sessions: [...merged.values()], pendingIds: [...pending] });
  return next;
}, userId);

export const loadSessionSyncState = (userId) => enqueue(readState, userId);

export const claimSessionOwner = (userId) => enqueue(async context => {
  if (typeof userId !== 'string' || !userId) throw new Error('Utilizador inválido.');
  if (context.userId !== userId) {
    throw new Error('As sessões locais pertencem a outra conta; sincronização bloqueada.');
  }
});

export const confirmSyncedSession = (session, userId) => enqueue(async context => {
  const state = await readState(context);
  const local = state.sessions.find((item) => item.id === session.id);
  // Se houve uma pausa enquanto o envio decorria, o novo estado continua pendente.
  if (!local || JSON.stringify(local) !== JSON.stringify(normalizeTaskSession(session))) return;
  await persist(context, { ...state, pendingIds: state.pendingIds.filter((id) => id !== session.id) });
}, userId);

export const mergeRemoteSessions = (remoteSessions, userId) => enqueue(async context => {
  const remote = normalizeList(remoteSessions);
  const state = await readState(context);
  const merged = new Map(state.sessions.map((item) => [item.id, item]));
  const pending = new Set(state.pendingIds);
  const localActive = state.sessions.find((item) => item.endedAt === null);
  for (const item of remote) {
    const previous = merged.get(item.id);
    // Uma pausa confirmada remotamente nunca deve ser desfeita por um início antigo.
    if (previous?.endedAt === null && item.endedAt !== null) {
      merged.set(item.id, item);
      pending.delete(item.id);
      continue;
    }
    if (pending.has(item.id)) continue;
    // Não importar uma segunda sessão ativa de outro dispositivo.
    if (item.endedAt === null && localActive && localActive.id !== item.id) continue;
    // Não reabrir uma sessão já fechada localmente.
    if (previous?.endedAt !== null && previous?.endedAt !== undefined && item.endedAt === null) continue;
    merged.set(item.id, item);
  }
  await persist(context, { ...state, sessions: [...merged.values()], pendingIds: [...pending] });
  return [...merged.values()];
}, userId);

export const TASK_SESSION_STORAGE_INFO = {
  schemaVersion: 3,
  keyPrefix: STORAGE_PREFIX,
  legacyKey: LEGACY_STORAGE_KEY,
};
