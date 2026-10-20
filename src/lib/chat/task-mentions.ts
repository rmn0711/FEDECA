export type TaskMention = { id: number; projectId: number; title: string; projectName: string; status: string };

/** Only a standalone # before the caret opens task search (never URLs or inline code). */
export function taskMentionQuery(text: string, caret: number) {
  const before = text.slice(0, caret);
  const match = /(?:^|\s)#([^#\n`]{0,80})$/.exec(before);
  if (!match) return null;
  return { start: before.lastIndexOf("#"), end: caret, query: match[1].trim() };
}

export function insertTaskMention(text: string, range: { start: number; end: number }, task: TaskMention) {
  const title = task.title.replace(/\s+/g, " ").replace(/[\\[\]`*_<>]/g, "");
  const mention = `[#${task.id} ${title}](/equipo/proyectos/${task.projectId}?tarea=${task.id}) `;
  return { text: text.slice(0, range.start) + mention + text.slice(range.end), caret: range.start + mention.length };
}
