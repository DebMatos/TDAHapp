import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const homeSource = fs.readFileSync(new URL('../src/screens/Home/HomeScreen.js', import.meta.url), 'utf8');
const homeStylesSource = fs.readFileSync(new URL('../src/screens/Home/HomeScreen.styles.ts', import.meta.url), 'utf8');
const detailsSource = fs.readFileSync(new URL('../src/components/modals/TaskDetailsModal.js', import.meta.url), 'utf8');

const source = fs.readFileSync(
  new URL('../src/domain/taskClipboard.js', import.meta.url),
  'utf8',
);
const clipboard = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

const original = {
  id: 'task-original',
  title: 'Preparar apresentação',
  notes: 'Rever números',
  projectId: 'project-1',
  categoryId: 'work',
  priority: 'high',
  date: '2027-01-04',
  startTime: '09:00',
  durationMinutes: 75,
  dueDate: '2027-01-05',
  dueTime: '12:00',
  status: 'completed',
  repeat: 'never',
  source: 'app',
  completedAt: '2027-01-04T10:15:00.000Z',
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-04T10:15:00.000Z',
  notificationId: 'old-notification',
  trackedDurationMs: 3600000,
  sessions: [{ id: 'session-1' }],
  subtasks: [{ id: 'subtask-1', title: 'Abrir slides', status: 'completed', position: 0 }],
};

test('clipboard keeps planning fields and excludes identity and execution data', () => {
  const copied = clipboard.copyTaskForPaste(original);

  assert.deepEqual(copied, {
    title: 'Preparar apresentação', notes: 'Rever números', projectId: 'project-1',
    categoryId: 'work', priority: 'high', durationMinutes: 75,
    dueDate: '2027-01-05', dueTime: '12:00', repeat: 'never', source: 'app',
    subtasks: [{ title: 'Abrir slides', status: 'pending', position: 0 }],
  });
  assert.equal('id' in copied, false);
  assert.equal('sessions' in copied, false);
  assert.equal('notificationId' in copied, false);
});

test('paste resets state and recalculates the selected schedule', () => {
  const copied = clipboard.copyTaskForPaste(original);
  const pasted = clipboard.buildPastedTask(copied, {
    date: '2027-02-10',
    startTime: '14:30',
  });

  assert.equal(pasted.date, '2027-02-10');
  assert.equal(pasted.startTime, '14:30');
  assert.equal(pasted.durationMinutes, 75);
  assert.equal(pasted.status, 'pending');
  assert.equal('id' in pasted, false);
  assert.notStrictEqual(pasted.subtasks, copied.subtasks);

  pasted.subtasks[0].title = 'Alterado';
  assert.equal(copied.subtasks[0].title, 'Abrir slides');
});

test('the same clipboard value can create independent tasks repeatedly', () => {
  const copied = clipboard.copyTaskForPaste(original);
  const first = clipboard.buildPastedTask(copied, { date: '2027-03-01', startTime: '08:00' });
  const second = clipboard.buildPastedTask(copied, { date: '2027-03-02', startTime: '16:00' });

  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.subtasks, second.subtasks);
  assert.notEqual(first.subtasks[0].id, second.subtasks[0].id);
  assert.equal(first.date, '2027-03-01');
  assert.equal(second.date, '2027-03-02');
});

test('application clipboard keeps only the latest copied task', () => {
  clipboard.storeCopiedTask(original);
  clipboard.storeCopiedTask({ ...original, id: 'other', title: 'Segunda tarefa' });

  assert.equal(clipboard.getCopiedTask().title, 'Segunda tarefa');
  assert.equal('id' in clipboard.getCopiedTask(), false);
});

test('timeline uses a contextual paste toolbar instead of a native alert', () => {
  assert.equal(homeSource.includes("Alert.alert('Adicionar tarefa'"), false);
  assert.match(homeSource, /accessibilityLabel="Ações da timeline"/);
  assert.match(homeSource, /accessibilityLabel="Cancelar"/);
  assert.match(homeSource, /accessibilityLabel="Colar tarefa"/);
  assert.match(homeSource, /accessibilityLabel="Criar nova tarefa"/);
  assert.match(homeSource, /setTimelineAction\(null\)/);
});

test('paste toolbar follows the task-card column and keeps paste visually light', () => {
  assert.match(homeSource, /viewportWidth - TASK_CARD_LEFT - TASK_CARD_RIGHT/);
  assert.match(homeSource, /const left = TASK_CARD_LEFT/);
  assert.match(homeSource, /getVisualY\(timelineAction\.slotMinutes\) - scrollYRef\.current/);
  assert.match(homeSource, /name="clipboard-outline"/);
  assert.equal(homeSource.includes('styles.timelineActionPrimary}'), false);
  assert.match(homeStylesSource, /timelineActionPrimaryText: \{ color: colors\.selectionText \}/);
  assert.match(homeStylesSource, /colors === lightColors[\s\S]*shadowOpacity: 0\.1/);
});

test('copy action is icon-only in the task header and has no success banner', () => {
  assert.match(detailsSource, /style=\{styles\.copyHeaderButton\}/);
  assert.match(detailsSource, /copyConfirmed \? 'checkmark' : 'copy-outline'/);
  assert.equal(detailsSource.includes('copyTaskText'), false);
  assert.equal(homeSource.includes("title: 'Tarefa copiada'"), false);
});
