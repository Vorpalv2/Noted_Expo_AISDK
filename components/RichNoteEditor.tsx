'use dom';

import { useEffect, useRef, useState } from 'react';

type Props = {
  noteId: string;
  markdown: string;
  replaceSignal?: number;
  flushSignal: number;
  safeBottom?: number;
  darkMode?: boolean;
  taskRemindersEnabled?: boolean;
  keyboardVisible?: boolean;
  scheduleTaskReminder?: (reminder: { taskId: string; task: string; remindAt: number; requestPermission?: boolean }) => Promise<void>;
  cancelTaskReminder?: (taskId: string) => Promise<void>;
  openTaskReminder?: (reminder: { taskId: string; task: string; remindAt: number }) => Promise<number | null>;
  onChange: (markdown: string) => Promise<void>;
  onFinish: (markdown: string) => Promise<void>;
  onReady: () => void;
  dom?: import('expo/dom').DOMProps;
};

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(value: string) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '<strong>$1$2</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\*([^*]+)\*|_([^_]+)_/g, '<em>$1$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function taskCheckbox(checked: boolean) {
  const state = checked ? 'true' : 'false';
  return `<button type="button" class="task-checkbox" contenteditable="false" role="checkbox" aria-checked="${state}" aria-label="${checked ? 'Mark task incomplete' : 'Mark task complete'}"><span aria-hidden="true"></span></button>`;
}

function taskReminderButton(active = false, disabled = false) {
  return `<button type="button" class="task-reminder" aria-label="Set task reminder" title="Set reminder" contenteditable="false"${disabled ? ' disabled' : ''}${active ? ' data-reminder-active="true"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3"/></svg></button>`;
}

function formatReminderDate(remindAt: number) {
  const date = new Date(remindAt);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const dateLabel = sameDay(date, now) ? 'Today' : sameDay(date, tomorrow) ? 'Tomorrow' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeLabel = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
}

function taskReminderInfo(remindAt: number) {
  return `<div class="task-reminder-info" contenteditable="false"><span class="task-reminder-when"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3"/></svg>${escapeHtml(formatReminderDate(remindAt))}</span><span class="task-reminder-set">Reminder set</span></div>`;
}

function taskReminderMeta(id: string, remindAt: number) {
  return `<!-- noted-reminder:${id}:${remindAt} -->`;
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function reminderFields(task: string) {
  const match = task.match(/\s*<!-- noted-reminder:([\w-]+):(\d+) -->\s*$/);
  return {
    text: match ? task.slice(0, match.index).trimEnd() : task,
    id: match?.[1] ?? '',
    remindAt: match ? Number(match[2]) : 0,
  };
}

const editablePlaceholder = '\u200B';

function toLocalDateTimeInput(value: number) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function normalizeTaskLists(root: HTMLElement) {
  root.querySelectorAll<HTMLUListElement>('ul[data-task-list="true"]').forEach((list) => {
    Array.from(list.children).filter((child): child is HTMLLIElement => child instanceof HTMLLIElement).forEach((item) => {
      if (!item.querySelector(':scope > .task-checkbox')) {
        const oldMarker = item.firstChild;
        const marker = oldMarker?.nodeType === Node.TEXT_NODE ? oldMarker.textContent?.match(/^\s*[☐☑]\s*/) : null;
        if (marker && oldMarker) oldMarker.textContent = oldMarker.textContent?.slice(marker[0].length) ?? '';
        item.insertAdjacentHTML('afterbegin', taskCheckbox(false));
      }
      if (!item.querySelector(':scope > .task-text')) {
        const text = document.createElement('span');
        text.className = 'task-text';
        Array.from(item.childNodes).forEach((child) => {
          if (!(child instanceof HTMLElement && child.classList.contains('task-checkbox'))) text.appendChild(child);
        });
        item.appendChild(text);
      }
      if (!item.querySelector(':scope > .task-reminder')) {
        item.querySelector(':scope > .task-checkbox')?.insertAdjacentHTML('afterend', taskReminderButton());
      }
    });
  });
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (/^```/.test(line.trim())) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !/^```/.test(lines[index].trim())) code.push(lines[index++]);
      index++;
      output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); index++; continue; }
    if (index + 1 < lines.length && line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
      const headers = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes('|')) rows.push(cells(lines[index++]));
      output.push(`<table><thead><tr>${headers.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, column) => `<td>${inline(row[column] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^\s*>\s?/.test(line)) { output.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`); index++; continue; }
    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) { output.push('<hr>'); index++; continue; }
    const list = line.match(/^\s*(?:([-+*])|(\d+[.)]))\s+(.+)$/);
    if (list) {
      const ordered = !!list[2];
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*(?:([-+*])|(\d+[.)]))\s+(.+)$/);
        if (!match || !!match[2] !== ordered) break;
        const task = match[3].match(/^\[([ xX])\]\s*(.*)$/);
        const taskContent = task ? reminderFields(task[2]) : null;
        items.push(task
          ? `<li data-task-id="${escapeHtml(taskContent!.id)}" data-remind-at="${taskContent!.remindAt || ''}">${taskCheckbox(task[1].toLowerCase() === 'x')}${taskReminderButton(Boolean(taskContent!.remindAt && task[1].toLowerCase() !== 'x'), task[1].toLowerCase() === 'x')}<span class="task-text">${inline(taskContent!.text) || editablePlaceholder}</span>${taskContent!.remindAt && task[1].toLowerCase() !== 'x' ? taskReminderInfo(taskContent!.remindAt) : ''}</li>`
          : `<li>${inline(match[3])}</li>`);
        index++;
      }
      const taskList = !ordered && items.some((item) => item.includes('class="task-checkbox"'));
      output.push(`<${ordered ? 'ol' : 'ul'}${taskList ? ' data-task-list="true"' : ''}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const image = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
    if (image) { output.push(`<p><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}"></p>`); index++; continue; }
    output.push(`<p>${inline(line)}</p>`);
    index++;
  }
  return output.join('') || '<p><br></p>';
}

function markdownFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\u200B/g, '');
  if (!(node instanceof HTMLElement)) return '';
  const tag = node.tagName.toLowerCase();
  const children = () => Array.from(node.childNodes).map(markdownFromNode).join('');
  if (tag === 'br') return '\n';
  if (tag === 'strong' || tag === 'b') return `**${children()}**`;
  if (tag === 'em' || tag === 'i') return `*${children()}*`;
  if (tag === 's' || tag === 'strike' || tag === 'del') return `~~${children()}~~`;
  if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${children()}\``;
  if (tag === 'a') return `[${children()}](${node.getAttribute('href') ?? ''})`;
  if (tag === 'img') return `![${node.getAttribute('alt') ?? ''}](${node.getAttribute('src') ?? ''})`;
  if (tag === 'pre') return `\`\`\`\n${node.textContent ?? ''}\n\`\`\`\n\n`;
  if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${children()}\n\n`;
  if (tag === 'blockquote') return `> ${children().trim().replace(/\n/g, '\n> ')}\n\n`;
  if (tag === 'hr') return '---\n\n';
  if (tag === 'table') {
    const rows = Array.from(node.querySelectorAll('tr')).map((row) => Array.from(row.children).map((cell) => cell.textContent?.trim().replace(/\|/g, '\\|') ?? ''));
    if (!rows.length) return '';
    const width = rows[0].length;
    return [`| ${rows[0].join(' | ')} |`, `| ${Array(width).fill('---').join(' | ')} |`, ...rows.slice(1).map((row) => `| ${row.join(' | ')} |`)].join('\n') + '\n\n';
  }
  if (tag === 'ul' || tag === 'ol') return Array.from(node.children).map((child, index) => {
    const checkbox = child instanceof HTMLElement ? child.querySelector<HTMLButtonElement>(':scope > .task-checkbox') : null;
    if (checkbox) {
      const text = child.querySelector<HTMLElement>(':scope > .task-text');
      const checked = checkbox.getAttribute('aria-checked') === 'true';
      const id = child.getAttribute('data-task-id') ?? '';
      const remindAt = Number(child.getAttribute('data-remind-at')) || 0;
      const reminder = !checked && id && remindAt ? ` ${taskReminderMeta(id, remindAt)}` : '';
      return `- [${checked ? 'x' : ' '}] ${text ? markdownFromNode(text).trim() : ''}${reminder}`;
    }
    const value = markdownFromNode(child).trim();
    const task = value.match(/^([☐☑])\s*(.*)$/);
    return task ? `- [${task[1] === '☑' ? 'x' : ' '}] ${task[2]}` : `${tag === 'ol' ? `${index + 1}.` : '-'} ${value}`;
  }).join('\n') + '\n\n';
  if (tag === 'li') return children();
  if (tag === 'p' || tag === 'div') return `${children().trimEnd()}\n\n`;
  return children();
}

type ToolIconName = 'bold' | 'italic' | 'strike' | 'body' | 'title' | 'heading' | 'bullets' | 'numbered' | 'checklist' | 'quote' | 'code' | 'link' | 'divider' | 'table';

function ToolIcon({ name }: { name: ToolIconName }) {
  const shared = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let drawing;
  switch (name) {
    case 'bold': drawing = <path {...shared} d="M7 4.5h5.7a3.2 3.2 0 0 1 0 6.4H7zm0 6.4h6.4a3.3 3.3 0 0 1 0 6.6H7z" />; break;
    case 'italic': drawing = <path {...shared} d="M14.8 4.5h-5m4.4 0L9.8 17.5m4.4 0h-5" />; break;
    case 'strike': drawing = <><path {...shared} d="M7 7.2c.7-1.8 2.2-2.7 4.4-2.7 2.3 0 3.8 1.1 3.8 2.8 0 1.2-.7 2-1.8 2.7M7 16.8c.8.8 2.1 1.2 3.8 1.2 2.6 0 4.2-1 4.2-2.8 0-1.1-.7-1.9-1.9-2.5"/><path {...shared} d="M4 12h16"/></>; break;
    case 'body': drawing = <><path {...shared} d="M5 6h14M5 10h14M5 14h9M5 18h9"/><path {...shared} d="m17 15 2 4 2-4"/></>; break;
    case 'title': drawing = <><path {...shared} d="M5 5v14M19 5v14M5 12h14"/><path {...shared} d="M5 7h3M16 7h3"/></>; break;
    case 'heading': drawing = <><path {...shared} d="M5 5v14M12 5v14M5 12h7M16 8h4M18 8v11M16.5 19h3"/></>; break;
    case 'bullets': drawing = <><circle {...shared} cx="5" cy="6" r="1"/><circle {...shared} cx="5" cy="12" r="1"/><circle {...shared} cx="5" cy="18" r="1"/><path {...shared} d="M10 6h9M10 12h9M10 18h9"/></>; break;
    case 'numbered': drawing = <><path {...shared} d="M10 6h9M10 12h9M10 18h9M4 5h2v3M4 11h2l-2 2h2M4 17c0-1 2-1 2 0s-2 1-2 2h2"/></>; break;
    case 'checklist': drawing = <><rect {...shared} x="3.5" y="4" width="5" height="5" rx="1"/><path {...shared} d="m4.5 6.5 1.2 1.2 2-2.3M11.5 6.5H20"/><rect {...shared} x="3.5" y="14" width="5" height="5" rx="1"/><path {...shared} d="M11.5 16.5H20"/></>; break;
    case 'quote': drawing = <><path {...shared} d="M10.5 6H6a2 2 0 0 0-2 2v4h6v6H4M20 6h-4.5a2 2 0 0 0-2 2v4h6v6h-6"/></>; break;
    case 'code': drawing = <><path {...shared} d="m8 6-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/></>; break;
    case 'link': drawing = <><path {...shared} d="M9.5 14.5 14.5 9.5"/><path {...shared} d="M7.8 16.2 6.4 17.6a3.4 3.4 0 0 1-4.8-4.8l4-4a3.4 3.4 0 0 1 4.8 0M16.2 7.8l1.4-1.4a3.4 3.4 0 1 1 4.8 4.8l-4 4a3.4 3.4 0 0 1-4.8 0"/></>; break;
    case 'divider': drawing = <><path {...shared} d="M4 12h5M15 12h5M9 8l3 4-3 4M15 8l-3 4 3 4"/></>; break;
    case 'table': drawing = <><rect {...shared} x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path {...shared} d="M3.5 10h17M9 4.5v15M15 4.5v15"/></>; break;
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" {...shared}>{drawing}</svg>;
}

export default function RichNoteEditor({ noteId, markdown, replaceSignal = 0, flushSignal, safeBottom = 0, darkMode = false, taskRemindersEnabled = false, keyboardVisible = false, scheduleTaskReminder, cancelTaskReminder, openTaskReminder, onChange, onFinish, onReady }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const loadedNote = useRef<string | null>(null);
  const lastFlushSignal = useRef(0);
  const lastReplaceSignal = useRef(replaceSignal);
  const [tableOpen, setTableOpen] = useState(false);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('https://');
  const [activeTools, setActiveTools] = useState<Set<ToolIconName>>(() => new Set());
  const [toolbarCollapsed, setToolbarCollapsed] = useState(true);
  const [reminderTask, setReminderTask] = useState<HTMLLIElement | null>(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderError, setReminderError] = useState('');
  const toolbarRail = useRef<HTMLDivElement>(null);
  const toolbarDragStart = useRef<{ x: number; y: number; left: number } | null>(null);
  const focusedLineScrollTimers = useRef<number[]>([]);

  useEffect(() => {
    setToolbarCollapsed(true);
  }, [noteId]);

  useEffect(() => {
    if (loadedNote.current === noteId || !editor.current) return;
    loadedNote.current = noteId;
    editor.current.innerHTML = markdownToHtml(markdown);
    void restoreReminders();
    onReady();
  }, [noteId, markdown, onReady]);

  useEffect(() => {
    if (replaceSignal === lastReplaceSignal.current) return;
    lastReplaceSignal.current = replaceSignal;
    if (editor.current) {
      editor.current.innerHTML = markdownToHtml(markdown);
      void restoreReminders();
    }
  }, [replaceSignal, markdown]);

  useEffect(() => {
    if (flushSignal <= lastFlushSignal.current) return;
    lastFlushSignal.current = flushSignal;
    void onFinish(editor.current ? markdownFromNode(editor.current).trimEnd() : markdown);
  }, [flushSignal, markdown, onFinish]);

  const emitChange = () => {
    if (editor.current) void onChange(markdownFromNode(editor.current).trimEnd());
  };
  const handleEditorInput = () => {
    if (!editor.current) return;
    normalizeTaskLists(editor.current);
    emitChange();
    syncActiveTools();
  };
  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const checkbox = target.closest<HTMLButtonElement>('.task-checkbox');
    const reminderButton = target.closest<HTMLButtonElement>('.task-reminder');
    if (reminderButton && editor.current?.contains(reminderButton)) {
      event.preventDefault();
      event.stopPropagation();
      const item = reminderButton.closest<HTMLLIElement>('li');
      if (!item) return;
      const existing = Number(item.dataset.remindAt);
      if (openTaskReminder && scheduleTaskReminder) {
        editor.current.blur();
        reminderButton.disabled = true;
        const taskId = item.dataset.taskId || createTaskId();
        const task = item.querySelector<HTMLElement>(':scope > .task-text')?.textContent?.trim() ?? 'Untitled task';
        item.dataset.taskId = taskId;
        void openTaskReminder({ taskId, task, remindAt: existing }).then(async (remindAt) => {
          if (!remindAt) return;
          await scheduleTaskReminder({ taskId, task, remindAt, requestPermission: true });
          item.dataset.remindAt = String(remindAt);
          item.querySelector(':scope > .task-reminder-info')?.remove();
          item.insertAdjacentHTML('beforeend', taskReminderInfo(remindAt));
          reminderButton.setAttribute('data-reminder-active', 'true');
          emitChange();
        }).catch(() => setReminderError('Could not schedule the reminder. Check notification permissions and try again.')).finally(() => {
          reminderButton.disabled = false;
        });
        return;
      }
      setReminderDate(toLocalDateTimeInput(existing > Date.now() ? existing : Date.now() + 60 * 60 * 1000));
      setReminderError('');
      setReminderTask(item);
      return;
    }
    if (!checkbox || !editor.current?.contains(checkbox)) return;
    event.preventDefault();
    event.stopPropagation();
    editor.current.blur();
    checkbox.blur();
    const checked = checkbox.getAttribute('aria-checked') !== 'true';
    checkbox.setAttribute('aria-checked', String(checked));
    checkbox.setAttribute('aria-label', checked ? 'Mark task incomplete' : 'Mark task complete');
    const taskReminderControl = checkbox.parentElement?.querySelector<HTMLButtonElement>(':scope > .task-reminder');
    if (taskReminderControl) taskReminderControl.disabled = checked;
    const taskItem = checkbox.closest<HTMLLIElement>('li');
    if (checked && taskItem) {
      const taskId = taskItem.dataset.taskId;
      if (taskId) void cancelTaskReminder?.(taskId);
      taskItem.dataset.remindAt = '';
      taskItem.querySelector(':scope > .task-reminder-info')?.remove();
      taskItem.querySelector('.task-reminder')?.removeAttribute('data-reminder-active');
    }
    emitChange();
  };
  const restoreReminders = async () => {
    if (!taskRemindersEnabled || !scheduleTaskReminder || !editor.current) return;
    const tasks = Array.from(editor.current.querySelectorAll<HTMLLIElement>('ul[data-task-list="true"] > li'));
    for (const item of tasks) {
      const checkbox = item.querySelector<HTMLButtonElement>(':scope > .task-checkbox');
      const remindAt = Number(item.dataset.remindAt) || 0;
      if (!checkbox || !remindAt) continue;
      if (checkbox.getAttribute('aria-checked') === 'true') {
        const taskId = item.dataset.taskId;
        if (taskId) await cancelTaskReminder?.(taskId);
        item.dataset.remindAt = '';
        emitChange();
        continue;
      }
      if (!item.dataset.taskId) item.dataset.taskId = createTaskId();
      const task = item.querySelector<HTMLElement>(':scope > .task-text')?.textContent?.trim() ?? 'Untitled task';
      await scheduleTaskReminder({ taskId: item.dataset.taskId, task, remindAt, requestPermission: false });
    }
  };
  const saveTaskReminder = async () => {
    if (!reminderTask || !scheduleTaskReminder) return;
    const remindAt = new Date(reminderDate).getTime();
    if (!Number.isFinite(remindAt) || remindAt <= Date.now()) {
      setReminderError('Choose a time in the future.');
      return;
    }
    const taskText = reminderTask.querySelector<HTMLElement>(':scope > .task-text')?.textContent?.trim() ?? '';
    const taskId = reminderTask.dataset.taskId || createTaskId();
    try {
      await scheduleTaskReminder({ taskId, task: taskText || 'Untitled task', remindAt, requestPermission: true });
      reminderTask.dataset.taskId = taskId;
      reminderTask.dataset.remindAt = String(remindAt);
      reminderTask.querySelector(':scope > .task-reminder-info')?.remove();
      reminderTask.insertAdjacentHTML('beforeend', taskReminderInfo(remindAt));
      reminderTask.querySelector('.task-reminder')?.setAttribute('data-reminder-active', 'true');
      emitChange();
      setReminderTask(null);
    } catch {
      setReminderError('Could not schedule the reminder. Check notification permissions and try again.');
    }
  };
  const handleMobileListEnter = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || !editor.current) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const anchor = range.startContainer;
    const element = anchor instanceof HTMLElement ? anchor : anchor.parentElement;
    const item = element?.closest('li');
    const list = item?.parentElement;
    if (!item || !list || !editor.current.contains(item) || !['UL', 'OL'].includes(list.tagName)) return;

    const taskList = list.matches('ul[data-task-list="true"]');
    const currentText = taskList ? item.querySelector<HTMLElement>(':scope > .task-text') : item;
    if (!currentText || !currentText.textContent?.trim()) return;

    event.preventDefault();
    if (!range.collapsed) range.deleteContents();
    if (range.startContainer !== currentText && !currentText.contains(range.startContainer)) {
      range.selectNodeContents(currentText);
      range.collapse(false);
    }

    const tail = document.createRange();
    tail.setStart(range.startContainer, range.startOffset);
    tail.setEnd(currentText, currentText.childNodes.length);
    const trailingContent = tail.extractContents();
    if (!currentText.hasChildNodes()) currentText.appendChild(document.createElement('br'));

    const nextItem = document.createElement('li');
    let nextText: HTMLElement;
    if (taskList) {
        nextItem.innerHTML = `${taskCheckbox(false)}${taskReminderButton()}<span class="task-text"></span>`;
      nextText = nextItem.querySelector<HTMLElement>(':scope > .task-text')!;
    } else {
      nextText = nextItem;
    }
    nextText.appendChild(trailingContent);
    let placeholder: Text | null = null;
    if (!nextText.hasChildNodes()) {
      placeholder = document.createTextNode(editablePlaceholder);
      nextText.appendChild(placeholder);
    }
    item.parentElement?.insertBefore(nextItem, item.nextSibling);

    const caret = document.createRange();
    if (placeholder) caret.setStart(placeholder, placeholder.length);
    else {
      caret.selectNodeContents(nextText);
      caret.collapse(true);
    }
    editor.current.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(caret);
    savedRange.current = caret.cloneRange();
    emitChange();
    syncActiveTools();
  };
  const syncActiveTools = () => {
    if (!editor.current) return;
    const active = new Set<ToolIconName>();
    if (document.queryCommandState('bold')) active.add('bold');
    if (document.queryCommandState('italic')) active.add('italic');
    if (document.queryCommandState('strikeThrough')) active.add('strike');

    const block = document.queryCommandValue('formatBlock').toLowerCase().replace(/[<>]/g, '');
    if (block === 'p' || block === 'div') active.add('body');
    if (block === 'h1') active.add('title');
    if (block === 'h2' || block === 'h3') active.add('heading');
    if (block === 'blockquote') active.add('quote');

    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const element = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
    const node = element && editor.current.contains(element) ? element : null;
    const listItem = node?.closest('li');
    const checklist = !!listItem && /^[☐☑]/.test(listItem.textContent?.trim() ?? '');
    if (checklist) active.add('checklist');
    else if (document.queryCommandState('insertUnorderedList')) active.add('bullets');
    if (document.queryCommandState('insertOrderedList')) active.add('numbered');
    if (node?.closest('code')) active.add('code');
    if (node?.closest('a')) active.add('link');
    if (node?.closest('table')) active.add('table');
    setActiveTools(active);
  };
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  };
  const scrollFocusedLineToTop = (delays: number[] = [0]) => {
    focusedLineScrollTimers.current.forEach(window.clearTimeout);
    focusedLineScrollTimers.current = delays.map((delay) => window.setTimeout(() => {
      const root = editor.current;
      const bodyScroll = root?.closest<HTMLElement>('.body-scroll');
      const selection = window.getSelection();
      const anchor = selection?.anchorNode;
      const element = anchor instanceof Element ? anchor : anchor?.parentElement;
      if (!root || !bodyScroll || !element || !root.contains(element)) return;
      const line = element.closest<HTMLElement>('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th') ?? root;
      const scrollRect = bodyScroll.getBoundingClientRect();
      const lineRect = line.getBoundingClientRect();
      const caretRect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
      const topPadding = Number.parseFloat(window.getComputedStyle(bodyScroll).paddingTop) || 0;
      const focusTop = caretRect && caretRect.height > 0 ? caretRect.top : lineRect.top;
      const offset = focusTop - scrollRect.top - topPadding;
      if (Math.abs(offset) > 3) bodyScroll.scrollTo({ top: bodyScroll.scrollTop + offset, behavior: 'smooth' });
    }, delay));
  };

  useEffect(() => {
    if (!keyboardVisible) return;
    // The WebView's viewport resizes after the keyboard animation begins.
    // Re-align once during and once after that resize so the tapped line stays clear.
    scrollFocusedLineToTop([90, 300]);
    return () => focusedLineScrollTimers.current.forEach(window.clearTimeout);
  }, [keyboardVisible]);
  const restoreSelection = () => {
    editor.current?.focus();
    const selection = window.getSelection();
    if (selection && savedRange.current) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
  };
  const startToolbarDrag = (x: number, y: number) => {
    if (!toolbarRail.current) return;
    toolbarDragStart.current = { x, y, left: toolbarRail.current.getBoundingClientRect().left };
  };
  const updateToolbarDrag = (x: number, y: number) => {
    const start = toolbarDragStart.current;
    if (!start) return;
    const movedX = x - start.x;
    if (movedX > 120 && Math.abs(y - start.y) < 56 && start.x - start.left < 112) {
      setToolbarCollapsed(true);
      toolbarDragStart.current = null;
    }
  };
  const finishToolbarDrag = (x: number, y: number) => {
    updateToolbarDrag(x, y);
    toolbarDragStart.current = null;
  };
  const command = (name: string, value?: string, tool?: ToolIconName, toggle = false) => {
    restoreSelection();
    document.execCommand(name, false, value);
    rememberSelection();
    syncActiveTools();
    if (tool) {
      setActiveTools((current) => {
        const next = new Set(current);
        if (toggle && next.has(tool)) next.delete(tool);
        else next.add(tool);
        if (tool === 'body' || tool === 'title' || tool === 'heading' || tool === 'quote') {
          for (const format of ['body', 'title', 'heading', 'quote'] as ToolIconName[]) {
            if (format !== tool) next.delete(format);
          }
        }
        return next;
      });
    }
    emitChange();
  };
  const insertTable = () => {
    restoreSelection();
    const cells = (tag: string) => Array.from({ length: columns }, (_, i) => `<${tag}>${tag === 'th' ? `Column ${i + 1}` : '<br>'}</${tag}>`).join('');
    const html = `<table><thead><tr>${cells('th')}</tr></thead><tbody>${Array.from({ length: rows - 1 }, () => `<tr>${cells('td')}</tr>`).join('')}</tbody></table><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    setTableOpen(false);
    emitChange();
  };
  const insertLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return;
    restoreSelection();
    document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(linkText.trim() || url)}</a>`);
    setLinkOpen(false);
    syncActiveTools();
    emitChange();
  };
  const tools: { icon: ToolIconName; title: string; action: () => void }[] = [
    { icon: 'bold', title: 'Bold', action: () => command('bold', undefined, 'bold', true) },
    { icon: 'italic', title: 'Italic', action: () => command('italic', undefined, 'italic', true) },
    { icon: 'strike', title: 'Strikethrough', action: () => command('strikeThrough', undefined, 'strike', true) },
    { icon: 'body', title: 'Body text', action: () => command('formatBlock', 'p', 'body') },
    { icon: 'title', title: 'Large heading', action: () => command('formatBlock', 'h1', 'title') },
    { icon: 'heading', title: 'Heading', action: () => command('formatBlock', 'h2', 'heading') },
    { icon: 'bullets', title: 'Bullet list', action: () => command('insertUnorderedList', undefined, 'bullets', true) },
    { icon: 'numbered', title: 'Numbered list', action: () => command('insertOrderedList', undefined, 'numbered', true) },
    { icon: 'checklist', title: 'Checklist', action: () => {
      command('insertHTML', `<ul data-task-list="true"><li>${taskCheckbox(false)}${taskReminderButton()}<span class="task-text">${editablePlaceholder}</span></li></ul><p><br></p>`, 'checklist');
      const list = editor.current?.querySelector<HTMLUListElement>('ul[data-task-list="true"]:last-of-type');
      const text = list?.querySelector<HTMLElement>(':scope > li:last-child > .task-text');
      if (text) {
        const range = document.createRange();
        range.selectNodeContents(text);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        savedRange.current = range.cloneRange();
      }
    } },
    { icon: 'quote', title: 'Quote', action: () => command('formatBlock', 'blockquote', 'quote') },
    { icon: 'code', title: 'Code', action: () => command('insertHTML', '<code>code</code>', 'code') },
    { icon: 'link', title: 'Insert link', action: () => { rememberSelection(); setLinkText(window.getSelection()?.toString() ?? ''); setLinkOpen(true); } },
    { icon: 'divider', title: 'Divider', action: () => command('insertHorizontalRule') },
    { icon: 'table', title: 'Insert table', action: () => { rememberSelection(); setTableOpen(true); } },
  ];

  const theme = darkMode ? {
    page: '#080a0f', surface: '#141821', ink: '#f4f6fb', muted: '#b0bacb', line: '#2a3140', pale: '#1b2c50',
    toolbar: 'rgba(20, 24, 33, .96)', toolbarBorder: '#303849', tool: '#c2ccdc', active: '#24385d', activeBorder: '#4567a9',
  } : {
    page: '#f8fafe', surface: '#ffffff', ink: '#101d38', muted: '#75829c', line: '#e5eaf3', pale: '#eaf0ff',
    toolbar: 'rgba(255, 255, 255, .96)', toolbarBorder: '#e0e6f0', tool: '#53617a', active: '#dce7ff', activeBorder: '#9db8ff',
  };

  return <div className={`rich-shell${taskRemindersEnabled ? ' reminders-enabled' : ''}`}>
    <style>{`
      html, body, #root { margin: 0; width: 100%; max-width: 100%; min-width: 0; height: 100%; overflow-x: hidden; background: ${theme.page}; }
      * { box-sizing: border-box; }
      .rich-shell { position: relative; width: 100%; max-width: 100%; min-width: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: ${theme.ink}; }
      .toolbar-rail { position: fixed; z-index: 10; left: 16px; right: 16px; bottom: max(8px, ${safeBottom}px); display: flex; justify-content: flex-end; min-width: 0; pointer-events: none; }
      .toolbar-panel { position: relative; display: flex; align-items: center; width: 100%; min-width: 0; overflow: hidden; border: 1px solid ${theme.toolbarBorder}; border-radius: 22px; background: ${theme.toolbar}; box-shadow: 0 8px 25px rgba(18, 39, 83, .14), 0 2px 5px rgba(18, 39, 83, .08); backdrop-filter: blur(16px); pointer-events: auto; transition: width 240ms cubic-bezier(.2,.8,.2,1), height 240ms cubic-bezier(.2,.8,.2,1), border-radius 240ms ease; }
      .toolbar-rail.collapsed .toolbar-panel { width: 56px; height: 56px; border-radius: 28px; }
      .toolbar-toggle { flex: none; display: grid; place-items: center; width: 46px; height: 46px; margin-left: 8px; padding: 0; border: 0; border-radius: 15px; background: transparent; color: ${theme.muted}; -webkit-tap-highlight-color: transparent; }
      .toolbar-toggle:active { background: ${theme.pale}; color: #1749e8; }
      .toolbar-toggle svg { width: 21px; height: 21px; }
      .toolbar-rail.collapsed .toolbar-toggle { width: 54px; height: 54px; margin-left: 0; border-radius: 50%; color: #1749e8; }
      .tools { display: flex; flex: 1; width: 0; min-width: 0; gap: 8px; padding: 8px; overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: none; -webkit-overflow-scrolling: touch; touch-action: pan-x; }
      .tools::-webkit-scrollbar { display: none; }
      .toolbar-rail.collapsed .tools { flex: 0 0 0; width: 0; padding: 0; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 120ms ease, visibility 0s linear 120ms; }
      button { font: inherit; cursor: pointer; }
      .tool { flex: none; display: grid; place-items: center; width: 46px; height: 46px; padding: 0; border: 0; border-radius: 16px; background: transparent; color: ${theme.tool}; -webkit-tap-highlight-color: transparent; }
      .tool:active { background: ${theme.pale}; color: #1749e8; }
      .tool.active, .tool[aria-pressed="true"] { background: ${theme.active}; color: #1749e8; box-shadow: inset 0 0 0 1px ${theme.activeBorder}; }
      .tool:focus-visible { outline: 2px solid #1749e8; outline-offset: -2px; }
      .body-scroll { flex: 1; min-width: 0; min-height: 0; width: 100%; overflow-x: hidden; overflow-y: auto; padding: 16px 25px ${safeBottom + 78}px; }
      .editor { width: 100%; min-width: 0; max-width: 100%; min-height: 100%; outline: none; font-size: 17px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
      .editor:empty:before { content: 'Start anywhere…'; color: ${darkMode ? '#7f8ba0' : '#a3aec2'}; }
      .editor p { margin: 0 0 12px; }
      .editor h1, .editor h2, .editor h3 { color: ${theme.ink}; margin: 12px 0 10px; line-height: 1.25; }
      .editor h1 { font-size: 29px; } .editor h2 { font-size: 24px; } .editor h3 { font-size: 20px; }
      .editor blockquote { margin: 12px 0; padding-left: 15px; border-left: 3px solid #1749e8; color: ${theme.muted}; }
      .editor ul, .editor ol { padding-left: 24px; margin: 8px 0 13px; }
      .editor ul[data-task-list="true"] { padding-left: 0; list-style: none; }
      .editor ul[data-task-list="true"] > li { display: flow-root; margin: 9px 0; }
      .task-checkbox { float: left; display: grid; place-items: center; width: 23px; height: 23px; margin: 2px 10px 0 0; padding: 0; border: 1.7px solid ${darkMode ? '#71809b' : '#9aa8be'}; border-radius: 7px; background: transparent; color: white; -webkit-tap-highlight-color: transparent; }
      .task-checkbox span { width: 11px; height: 6px; border: solid currentColor; border-width: 0 0 2px 2px; transform: rotate(-45deg) scale(0); transition: transform 120ms ease; }
      .task-checkbox[aria-checked="true"] { border-color: #1749e8; background: #1749e8; }
      .task-checkbox[aria-checked="true"] span { transform: rotate(-45deg) scale(1); }
      .task-reminder { display: none; float: left; place-items: center; width: 38px; height: 38px; margin: -5px 7px 0 -4px; padding: 0; border: 0; border-radius: 11px; background: transparent; color: ${darkMode ? '#9ba9c0' : '#8190a9'}; font-size: 22px; line-height: 1; -webkit-tap-highlight-color: transparent; }
      .reminders-enabled .task-reminder { display: grid; }
      .task-reminder svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
      .task-reminder[data-reminder-active="true"] { color: #1749e8; background: ${theme.pale}; }
      .task-reminder:disabled { opacity: .4; }
      .task-reminder:active { background: ${theme.pale}; color: #1749e8; }
      .task-text { display: block; min-width: 0; min-height: 1.55em; overflow: hidden; }
      .task-reminder-info { clear: both; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; margin: 1px 0 5px 78px; font-size: 11px; line-height: 1.3; }
      .task-reminder-when { display: inline-flex; align-items: center; gap: 5px; color: ${darkMode ? '#B8C9F5' : '#526A9E'}; font-weight: 700; }
      .task-reminder-when svg { width: 13px; height: 13px; fill: none; stroke: #1749e8; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .task-reminder-set { color: ${theme.muted}; }
      .task-checkbox[aria-checked="true"] ~ .task-text { color: ${darkMode ? '#929db1' : '#8290a7'}; text-decoration: line-through; }
      .editor a { color: #1749e8; }
      .editor code { background: ${theme.pale}; border-radius: 4px; padding: 1px 3px; }
      .editor pre { max-width: 100%; background: #101d38; color: white; border-radius: 12px; padding: 14px; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
      .editor pre code { background: none; }
      .editor hr { border: 0; border-top: 1px solid ${theme.line}; margin: 17px 0; }
      .editor table { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; margin: 12px 0; }
      .editor th, .editor td { min-width: 0; border: 1px solid ${darkMode ? '#3a4559' : '#cbd5e5'}; padding: 8px 10px; overflow-wrap: anywhere; word-break: break-word; }
      .editor th { background: ${theme.pale}; color: ${theme.ink}; }
      .editor img { max-width: 100%; border-radius: 12px; }
      .veil { position: fixed; inset: 0; background: #0a142c66; display: grid; place-items: center; padding: 24px; }
      .dialog { width: min(100%, 390px); padding: 24px; border-radius: 24px; background: ${theme.surface}; box-shadow: 0 12px 26px #0a163333; }
      .eyebrow { color: #1749e8; font-size: 10px; font-weight: 800; letter-spacing: 1.4px; }
      .dialog h2 { margin: 8px 0 5px; color: ${theme.ink}; font: 600 25px Georgia, serif; }
      .dialog p { margin: 0 0 16px; color: ${theme.muted}; font-size: 14px; }
      .dimension { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid ${theme.line}; color: ${theme.ink}; }
      .dialog-input { display: block; width: 100%; height: 44px; margin: 8px 0; padding: 0 12px; border: 1px solid ${theme.line}; border-radius: 10px; color: ${theme.ink}; background: ${theme.surface}; font: inherit; font-size: 14px; }
      .dialog-input[type="datetime-local"] { color-scheme: ${darkMode ? 'dark' : 'light'}; }
      .dialog-error { margin-top: 8px !important; color: #d13d45 !important; font-weight: 600; }
      .stepper, .dialog-actions { display: flex; align-items: center; gap: 12px; }
      .stepper button { width: 34px; height: 34px; border: 0; border-radius: 10px; color: #1749e8; background: #eaf0ff; font-size: 20px; }
      .dialog-actions { margin-top: 19px; gap: 10px; }
      .dialog-actions button { flex: 1; height: 47px; border-radius: 13px; border: 1px solid ${theme.line}; background: ${theme.surface}; color: ${theme.ink}; font-weight: 700; }
      .dialog-actions .primary { background: #1749e8; color: white; border-color: #1749e8; }
    `}</style>
    <div className="body-scroll"><div ref={editor} className="editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Note body" aria-multiline="true" onInput={handleEditorInput} onKeyDown={handleMobileListEnter} onMouseDown={(event) => { if (event.target instanceof Element && event.target.closest('.task-reminder, .task-checkbox')) event.preventDefault(); }} onClick={handleEditorClick} onKeyUp={() => { rememberSelection(); syncActiveTools(); }} onMouseUp={(event) => { rememberSelection(); syncActiveTools(); if (keyboardVisible && event.target instanceof Element && !event.target.closest('button') && editor.current?.contains(event.target)) scrollFocusedLineToTop([0]); }} onTouchEnd={(event) => { rememberSelection(); syncActiveTools(); if (keyboardVisible && event.target instanceof Element && !event.target.closest('button') && editor.current?.contains(event.target)) scrollFocusedLineToTop([0]); }} /></div>
    <div ref={toolbarRail} className={`toolbar-rail${toolbarCollapsed ? ' collapsed' : ''}`}
      onTouchStart={(event) => { const point = event.touches[0]; if (point) startToolbarDrag(point.clientX, point.clientY); }}
      onTouchMove={(event) => { const point = event.touches[0]; if (point) updateToolbarDrag(point.clientX, point.clientY); }}
      onTouchEnd={(event) => { const point = event.changedTouches[0]; if (point) finishToolbarDrag(point.clientX, point.clientY); }}
      onTouchCancel={() => { toolbarDragStart.current = null; }}
      onMouseDown={(event) => startToolbarDrag(event.clientX, event.clientY)}
      onMouseMove={(event) => { if (event.buttons === 1) updateToolbarDrag(event.clientX, event.clientY); }}
      onMouseUp={(event) => finishToolbarDrag(event.clientX, event.clientY)}
    >
      <div className="toolbar-panel">
        <button type="button" className="toolbar-toggle" aria-label={toolbarCollapsed ? 'Show formatting tools' : 'Collapse formatting tools'} title={toolbarCollapsed ? 'Show formatting tools' : 'Collapse formatting tools'} aria-expanded={!toolbarCollapsed} onMouseDown={(event) => event.preventDefault()} onClick={() => setToolbarCollapsed((collapsed) => !collapsed)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d={toolbarCollapsed ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="tools" role="toolbar" aria-label="Note formatting">
          {tools.map((tool) => <button key={tool.title} type="button" className={`tool${activeTools.has(tool.icon) ? ' active' : ''}`} title={tool.title} aria-label={tool.title} aria-pressed={activeTools.has(tool.icon)} onMouseDown={(event) => event.preventDefault()} onClick={tool.action}><ToolIcon name={tool.icon} /></button>)}
        </div>
      </div>
    </div>
    {tableOpen && <div className="veil"><div className="dialog">
      <div className="eyebrow">TABLE</div><h2>Set up your table</h2><p>Choose its size. The first row is the header.</p>
      <div className="dimension"><span>Rows</span><div className="stepper"><button onClick={() => setRows(Math.max(2, rows - 1))}>−</button><b>{rows}</b><button onClick={() => setRows(Math.min(12, rows + 1))}>+</button></div></div>
      <div className="dimension"><span>Columns</span><div className="stepper"><button onClick={() => setColumns(Math.max(1, columns - 1))}>−</button><b>{columns}</b><button onClick={() => setColumns(Math.min(8, columns + 1))}>+</button></div></div>
      <div className="dialog-actions"><button onClick={() => setTableOpen(false)}>Cancel</button><button className="primary" onClick={insertTable}>Insert table</button></div>
    </div></div>}
    {taskRemindersEnabled && reminderTask && <div className="veil" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-label="Set task reminder">
      <div className="eyebrow">TASK REMINDER</div><h2>Choose a time</h2><p>{reminderTask.querySelector<HTMLElement>(':scope > .task-text')?.textContent?.trim() || 'Remind me about this task'}</p>
      <input className="dialog-input" type="datetime-local" value={reminderDate} min={toLocalDateTimeInput(Date.now() + 60000)} onChange={(event) => { setReminderDate(event.target.value); setReminderError(''); }} aria-label="Reminder date and time" />
      {reminderError && <p className="dialog-error">{reminderError}</p>}
      <div className="dialog-actions"><button onClick={() => setReminderTask(null)}>Cancel</button><button className="primary" onClick={() => void saveTaskReminder()}>Set reminder</button></div>
    </div></div>}
    {linkOpen && <div className="veil"><div className="dialog">
      <div className="eyebrow">LINK</div><h2>Add a link</h2><p>Give the link a name and paste its address.</p>
      <input className="dialog-input" value={linkText} onChange={(event) => setLinkText(event.target.value)} placeholder="Link text" aria-label="Link text" />
      <input className="dialog-input" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" aria-label="Link URL" autoCapitalize="none" />
      <div className="dialog-actions"><button onClick={() => setLinkOpen(false)}>Cancel</button><button className="primary" onClick={insertLink} disabled={!/^https?:\/\/\S+$/i.test(linkUrl.trim())}>Insert link</button></div>
    </div></div>}
  </div>;
}
