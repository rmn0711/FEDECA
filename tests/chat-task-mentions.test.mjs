import test from 'node:test';
import assert from 'node:assert/strict';
import { taskMentionQuery, insertTaskMention } from '../src/lib/chat/task-mentions.ts';

test('searches at the caret by number or title, without hijacking URLs or code', () => {
  assert.deepEqual(taskMentionQuery('Revisa #25', 10), { start: 7, end: 10, query: '25' });
  assert.equal(taskMentionQuery('#', 1).query, '');
  assert.equal(taskMentionQuery('Revisa #diseño web', 18).query, 'diseño web');
  for (const text of ['https://acf.com/#25', 'texto#25', '`#25', '#25\nsiguiente']) assert.equal(taskMentionQuery(text, text.length), null);
});
test('inserts a safe link in the middle of a draft and preserves its suffix', () => {
  const draft = 'Ver #25 mañana';
  const task = { id: 25, projectId: 3, title: 'Diseño [web] <nuevo>', projectName: 'Web', status: 'por_hacer' };
  const result = insertTaskMention(draft, taskMentionQuery(draft, 7), task);
  assert.equal(result.text, 'Ver [#25 Diseño web nuevo](/equipo/proyectos/3?tarea=25)  mañana');
  assert.equal(result.text.slice(result.caret), ' mañana');
});
