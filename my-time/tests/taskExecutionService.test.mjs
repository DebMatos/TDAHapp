import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const modelSource = fs.readFileSync(new URL('../src/domain/taskSessionModel.js', import.meta.url), 'utf8');
const serviceSource = fs.readFileSync(new URL('../src/services/taskExecutionService.js', import.meta.url), 'utf8');
const context = vm.createContext({
  Date, Promise, Math, Error, TypeError, RangeError,
  loadSessions: async () => [],
  saveSessions: async (sessions) => sessions,
});
vm.runInContext(modelSource.replaceAll('export const ', 'const ') +
  '\nglobalThis.createTaskSession = createTaskSession; globalThis.stopTaskSession = stopTaskSession; globalThis.getTaskDurationMs = getTaskDurationMs;', context);
vm.runInContext(serviceSource.replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '').replaceAll('export const ', 'const ') +
  '\nglobalThis.createTaskExecutionService = createTaskExecutionService;', context);

const factory = context.createTaskExecutionService;
const build = () => {
  let saved = [];
  let timestamp = '2026-11-15T14:00:00Z';
  let id = 0;
  const service = factory({
    load: async () => saved.map(x => ({ ...x })),
    save: async (sessions) => { saved = sessions.map(x => ({ ...x })); return saved; },
    now: () => timestamp,
    makeId: () => `s-${++id}`,
  });
  return { service, setNow: (value) => { timestamp = value; }, getSaved: () => saved };
};

test('iniciar e pausar preserva sessão e tempo', async () => {
  const { service, setNow, getSaved } = build();
  await service.startTask('t1');
  assert.equal((await service.getActiveSession()).taskId, 't1');
  setNow('2026-11-15T14:20:00Z');
  await service.pauseTask('t1');
  assert.equal(await service.getActiveSession(), null);
  assert.equal(await service.getTrackedDurationMs('t1'), 20 * 60 * 1000);
  assert.equal(getSaved().length, 1);
});

test('retomar cria uma nova sessão e acumula duração', async () => {
  const { service, setNow, getSaved } = build();
  await service.startTask('t1');
  setNow('2026-11-15T14:10:00Z');
  await service.pauseTask('t1');
  setNow('2026-11-15T14:15:00Z');
  await service.resumeTask('t1');
  setNow('2026-11-15T14:30:00Z');
  assert.equal(await service.getTrackedDurationMs('t1'), 25 * 60 * 1000);
  assert.equal(getSaved().length, 2);
});

test('não permite duas tarefas a contar em simultâneo, incluindo pedidos concorrentes', async () => {
  const { service, getSaved } = build();
  const results = await Promise.allSettled([service.startTask('t1'), service.startTask('t2')]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.filter(x => x.status === 'rejected').length, 1);
  assert.equal(getSaved().length, 1);
});

test('não permite pausar uma tarefa diferente da ativa', async () => {
  const { service, getSaved } = build();
  await service.startTask('t1');
  await assert.rejects(service.pauseTask('t2'), /não tem uma sessão/);
  assert.equal(getSaved()[0].endedAt, null);
});

test('se a gravação falhar, não confirma o início', async () => {
  const service = factory({
    load: async () => [],
    save: async () => { throw new Error('Falha de armazenamento'); },
    now: () => '2026-11-15T14:00:00Z',
    makeId: () => 's1',
  });
  await assert.rejects(service.startTask('t1'), /Falha de armazenamento/);
});
