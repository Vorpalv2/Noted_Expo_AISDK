'use dom';

import { useEffect, useRef, useState, type Ref } from 'react';
import { useDOMImperativeHandle, type DOMImperativeFactory } from 'expo/dom';

export interface RichNoteEditorRef extends DOMImperativeFactory {
  flush: () => void;
}

type Props = {
  noteId: string;
  markdown: string;
  onChange: (markdown: string) => Promise<void>;
  onFinish: (markdown: string) => Promise<void>;
  ref: Ref<RichNoteEditorRef>;
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
        items.push(`<li>${task ? `${task[1].toLowerCase() === 'x' ? '☑' : '☐'} ${inline(task[2])}` : inline(match[3])}</li>`);
        index++;
      }
      output.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
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
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
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
    const value = markdownFromNode(child).trim();
    const task = value.match(/^([☐☑])\s*(.*)$/);
    return task ? `- [${task[1] === '☑' ? 'x' : ' '}] ${task[2]}` : `${tag === 'ol' ? `${index + 1}.` : '-'} ${value}`;
  }).join('\n') + '\n\n';
  if (tag === 'li') return children();
  if (tag === 'p' || tag === 'div') return `${children().trimEnd()}\n\n`;
  return children();
}

export default function RichNoteEditor({ noteId, markdown, onChange, onFinish, ref }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const loadedNote = useRef<string | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('https://');

  useDOMImperativeHandle(ref, () => ({
    flush: () => { void onFinish(editor.current ? markdownFromNode(editor.current).trimEnd() : markdown); },
  }), [onFinish, markdown]);

  useEffect(() => {
    if (loadedNote.current === noteId || !editor.current) return;
    loadedNote.current = noteId;
    editor.current.innerHTML = markdownToHtml(markdown);
  }, [noteId, markdown]);

  const emitChange = () => {
    if (editor.current) void onChange(markdownFromNode(editor.current).trimEnd());
  };
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    editor.current?.focus();
    const selection = window.getSelection();
    if (selection && savedRange.current) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
  };
  const command = (name: string, value?: string) => {
    restoreSelection();
    document.execCommand(name, false, value);
    rememberSelection();
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
    emitChange();
  };
  const tools: { label: string; title: string; action: () => void }[] = [
    { label: 'B', title: 'Bold', action: () => command('bold') },
    { label: 'I', title: 'Italic', action: () => command('italic') },
    { label: 'S̶', title: 'Strikethrough', action: () => command('strikeThrough') },
    { label: 'Aa', title: 'Body text', action: () => command('formatBlock', 'p') },
    { label: 'H1', title: 'Large heading', action: () => command('formatBlock', 'h1') },
    { label: 'H2', title: 'Heading', action: () => command('formatBlock', 'h2') },
    { label: '•', title: 'Bullet list', action: () => command('insertUnorderedList') },
    { label: '1.', title: 'Numbered list', action: () => command('insertOrderedList') },
    { label: '☐', title: 'Checklist', action: () => command('insertHTML', '<ul><li>☐ &nbsp;</li></ul><p><br></p>') },
    { label: '❞', title: 'Quote', action: () => command('formatBlock', 'blockquote') },
    { label: '</>', title: 'Code', action: () => command('insertHTML', '<code>code</code>') },
    { label: 'Link', title: 'Insert link', action: () => { rememberSelection(); setLinkText(window.getSelection()?.toString() ?? ''); setLinkOpen(true); } },
    { label: '—', title: 'Divider', action: () => command('insertHorizontalRule') },
    { label: 'Table', title: 'Insert table', action: () => { rememberSelection(); setTableOpen(true); } },
  ];

  return <div className="rich-shell">
    <style>{`
      html, body, #root { margin: 0; height: 100%; background: #f8fafe; }
      * { box-sizing: border-box; }
      .rich-shell { height: 100%; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #34415b; }
      .tools { display: flex; flex: none; gap: 7px; padding: 8px 22px; overflow-x: auto; border-bottom: 1px solid #e5eaf3; scrollbar-width: none; }
      .tools::-webkit-scrollbar { display: none; }
      button { font: inherit; cursor: pointer; }
      .tool { flex: none; min-width: 37px; height: 34px; padding: 0 10px; border-radius: 9px; border: 1px solid #d9e0ec; background: white; color: #101d38; font-size: 13px; font-weight: 700; }
      .tool:active { background: #eaf0ff; }
      .body-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 25px 30px; }
      .editor { min-height: 100%; outline: none; font-size: 17px; line-height: 1.55; overflow-wrap: anywhere; }
      .editor:empty:before { content: 'Start anywhere…'; color: #a3aec2; }
      .editor p { margin: 0 0 12px; }
      .editor h1, .editor h2, .editor h3 { color: #101d38; margin: 12px 0 10px; line-height: 1.25; }
      .editor h1 { font-size: 29px; } .editor h2 { font-size: 24px; } .editor h3 { font-size: 20px; }
      .editor blockquote { margin: 12px 0; padding-left: 15px; border-left: 3px solid #1749e8; color: #75829c; }
      .editor ul, .editor ol { padding-left: 24px; margin: 8px 0 13px; }
      .editor a { color: #1749e8; }
      .editor code { background: #eaf0ff; border-radius: 4px; padding: 1px 3px; }
      .editor pre { background: #101d38; color: white; border-radius: 12px; padding: 14px; overflow-x: auto; }
      .editor pre code { background: none; }
      .editor hr { border: 0; border-top: 1px solid #d9e0ec; margin: 17px 0; }
      .editor table { border-collapse: collapse; margin: 12px 0; min-width: 100%; }
      .editor th, .editor td { border: 1px solid #cbd5e5; padding: 8px 10px; min-width: 80px; }
      .editor th { background: #eaf0ff; color: #101d38; }
      .editor img { max-width: 100%; border-radius: 12px; }
      .veil { position: fixed; inset: 0; background: #0a142c66; display: grid; place-items: center; padding: 24px; }
      .dialog { width: min(100%, 390px); padding: 24px; border-radius: 24px; background: white; box-shadow: 0 12px 26px #0a163333; }
      .eyebrow { color: #1749e8; font-size: 10px; font-weight: 800; letter-spacing: 1.4px; }
      .dialog h2 { margin: 8px 0 5px; color: #101d38; font: 600 25px Georgia, serif; }
      .dialog p { margin: 0 0 16px; color: #75829c; font-size: 14px; }
      .dimension { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid #e5eaf3; }
      .dialog-input { display: block; width: 100%; height: 44px; margin: 8px 0; padding: 0 12px; border: 1px solid #d9e0ec; border-radius: 10px; color: #101d38; background: white; font: inherit; font-size: 14px; }
      .stepper, .dialog-actions { display: flex; align-items: center; gap: 12px; }
      .stepper button { width: 34px; height: 34px; border: 0; border-radius: 10px; color: #1749e8; background: #eaf0ff; font-size: 20px; }
      .dialog-actions { margin-top: 19px; gap: 10px; }
      .dialog-actions button { flex: 1; height: 47px; border-radius: 13px; border: 1px solid #e5eaf3; background: white; color: #101d38; font-weight: 700; }
      .dialog-actions .primary { background: #1749e8; color: white; border-color: #1749e8; }
    `}</style>
    <div className="tools" role="toolbar" aria-label="Note formatting">
      {tools.map((tool) => <button key={tool.title} type="button" className="tool" title={tool.title} aria-label={tool.title} onMouseDown={(event) => event.preventDefault()} onClick={tool.action}>{tool.label}</button>)}
    </div>
    <div className="body-scroll"><div ref={editor} className="editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Note body" aria-multiline="true" onInput={emitChange} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onTouchEnd={rememberSelection} /></div>
    {tableOpen && <div className="veil"><div className="dialog">
      <div className="eyebrow">TABLE</div><h2>Set up your table</h2><p>Choose its size. The first row is the header.</p>
      <div className="dimension"><span>Rows</span><div className="stepper"><button onClick={() => setRows(Math.max(2, rows - 1))}>−</button><b>{rows}</b><button onClick={() => setRows(Math.min(12, rows + 1))}>+</button></div></div>
      <div className="dimension"><span>Columns</span><div className="stepper"><button onClick={() => setColumns(Math.max(1, columns - 1))}>−</button><b>{columns}</b><button onClick={() => setColumns(Math.min(8, columns + 1))}>+</button></div></div>
      <div className="dialog-actions"><button onClick={() => setTableOpen(false)}>Cancel</button><button className="primary" onClick={insertTable}>Insert table</button></div>
    </div></div>}
    {linkOpen && <div className="veil"><div className="dialog">
      <div className="eyebrow">LINK</div><h2>Add a link</h2><p>Give the link a name and paste its address.</p>
      <input className="dialog-input" value={linkText} onChange={(event) => setLinkText(event.target.value)} placeholder="Link text" aria-label="Link text" />
      <input className="dialog-input" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" aria-label="Link URL" autoCapitalize="none" />
      <div className="dialog-actions"><button onClick={() => setLinkOpen(false)}>Cancel</button><button className="primary" onClick={insertLink} disabled={!/^https?:\/\/\S+$/i.test(linkUrl.trim())}>Insert link</button></div>
    </div></div>}
  </div>;
}
