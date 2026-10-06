'use dom';

import { useEffect, useRef, useState } from 'react';

type Props = {
  noteId: string;
  markdown: string;
  flushSignal: number;
  safeBottom?: number;
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

export default function RichNoteEditor({ noteId, markdown, flushSignal, safeBottom = 0, onChange, onFinish, onReady }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const loadedNote = useRef<string | null>(null);
  const lastFlushSignal = useRef(0);
  const [tableOpen, setTableOpen] = useState(false);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('https://');

  useEffect(() => {
    if (loadedNote.current === noteId || !editor.current) return;
    loadedNote.current = noteId;
    editor.current.innerHTML = markdownToHtml(markdown);
    onReady();
  }, [noteId, markdown, onReady]);

  useEffect(() => {
    if (flushSignal <= lastFlushSignal.current) return;
    lastFlushSignal.current = flushSignal;
    void onFinish(editor.current ? markdownFromNode(editor.current).trimEnd() : markdown);
  }, [flushSignal, markdown, onFinish]);

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
  const tools: { icon: ToolIconName; title: string; action: () => void }[] = [
    { icon: 'bold', title: 'Bold', action: () => command('bold') },
    { icon: 'italic', title: 'Italic', action: () => command('italic') },
    { icon: 'strike', title: 'Strikethrough', action: () => command('strikeThrough') },
    { icon: 'body', title: 'Body text', action: () => command('formatBlock', 'p') },
    { icon: 'title', title: 'Large heading', action: () => command('formatBlock', 'h1') },
    { icon: 'heading', title: 'Heading', action: () => command('formatBlock', 'h2') },
    { icon: 'bullets', title: 'Bullet list', action: () => command('insertUnorderedList') },
    { icon: 'numbered', title: 'Numbered list', action: () => command('insertOrderedList') },
    { icon: 'checklist', title: 'Checklist', action: () => command('insertHTML', '<ul><li>☐ &nbsp;</li></ul><p><br></p>') },
    { icon: 'quote', title: 'Quote', action: () => command('formatBlock', 'blockquote') },
    { icon: 'code', title: 'Code', action: () => command('insertHTML', '<code>code</code>') },
    { icon: 'link', title: 'Insert link', action: () => { rememberSelection(); setLinkText(window.getSelection()?.toString() ?? ''); setLinkOpen(true); } },
    { icon: 'divider', title: 'Divider', action: () => command('insertHorizontalRule') },
    { icon: 'table', title: 'Insert table', action: () => { rememberSelection(); setTableOpen(true); } },
  ];

  return <div className="rich-shell">
    <style>{`
      html, body, #root { margin: 0; width: 100%; max-width: 100%; min-width: 0; height: 100%; overflow-x: hidden; background: #f8fafe; }
      * { box-sizing: border-box; }
      .rich-shell { position: relative; width: 100%; max-width: 100%; min-width: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #34415b; }
      .toolbar-rail { position: absolute; z-index: 10; left: 16px; right: 16px; bottom: ${safeBottom + 12}px; min-width: 0; overflow: hidden; border: 1px solid #e0e6f0; border-radius: 22px; background: rgba(255, 255, 255, .96); box-shadow: 0 8px 25px rgba(18, 39, 83, .14), 0 2px 5px rgba(18, 39, 83, .08); backdrop-filter: blur(16px); }
      .tools { display: flex; width: 100%; min-width: 0; gap: 8px; padding: 8px; overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: none; -webkit-overflow-scrolling: touch; touch-action: pan-x; }
      .tools::-webkit-scrollbar { display: none; }
      button { font: inherit; cursor: pointer; }
      .tool { flex: none; display: grid; place-items: center; width: 46px; height: 46px; padding: 0; border: 0; border-radius: 16px; background: transparent; color: #53617a; -webkit-tap-highlight-color: transparent; }
      .tool:active { background: #eaf0ff; color: #1749e8; }
      .tool:focus-visible { outline: 2px solid #1749e8; outline-offset: -2px; }
      .body-scroll { flex: 1; min-width: 0; min-height: 0; width: 100%; overflow-x: hidden; overflow-y: auto; padding: 16px 25px ${safeBottom + 78}px; }
      .editor { width: 100%; min-width: 0; max-width: 100%; min-height: 100%; outline: none; font-size: 17px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
      .editor:empty:before { content: 'Start anywhere…'; color: #a3aec2; }
      .editor p { margin: 0 0 12px; }
      .editor h1, .editor h2, .editor h3 { color: #101d38; margin: 12px 0 10px; line-height: 1.25; }
      .editor h1 { font-size: 29px; } .editor h2 { font-size: 24px; } .editor h3 { font-size: 20px; }
      .editor blockquote { margin: 12px 0; padding-left: 15px; border-left: 3px solid #1749e8; color: #75829c; }
      .editor ul, .editor ol { padding-left: 24px; margin: 8px 0 13px; }
      .editor a { color: #1749e8; }
      .editor code { background: #eaf0ff; border-radius: 4px; padding: 1px 3px; }
      .editor pre { max-width: 100%; background: #101d38; color: white; border-radius: 12px; padding: 14px; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
      .editor pre code { background: none; }
      .editor hr { border: 0; border-top: 1px solid #d9e0ec; margin: 17px 0; }
      .editor table { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; margin: 12px 0; }
      .editor th, .editor td { min-width: 0; border: 1px solid #cbd5e5; padding: 8px 10px; overflow-wrap: anywhere; word-break: break-word; }
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
    <div className="body-scroll"><div ref={editor} className="editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Note body" aria-multiline="true" onInput={emitChange} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onTouchEnd={rememberSelection} /></div>
    <div className="toolbar-rail">
      <div className="tools" role="toolbar" aria-label="Note formatting">
        {tools.map((tool) => <button key={tool.title} type="button" className="tool" title={tool.title} aria-label={tool.title} onMouseDown={(event) => event.preventDefault()} onClick={tool.action}><ToolIcon name={tool.icon} /></button>)}
      </div>
    </div>
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
