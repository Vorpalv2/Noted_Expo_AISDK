import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { EnrichedMarkdownTextInput, type EnrichedMarkdownTextInputInstance } from 'react-native-enriched-markdown';
import RichNoteEditorWeb from './RichNoteEditor.web';

type Props = {
  noteId: string;
  markdown: string;
  flushSignal: number;
  onChange: (markdown: string) => Promise<void>;
  onFinish: (markdown: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

const hasAdvancedMarkdown = (markdown: string) =>
  /^\s*```/m.test(markdown) || /^\s*>/m.test(markdown) || /^\s*\|?.*\|.*\n\s*\|?\s*:?-{3,}/m.test(markdown);

type IconName = 'bold' | 'italic' | 'strike' | 'h1' | 'h2' | 'bullets' | 'numbered' | 'link' | 'more';

function ToolIcon({ name, color }: { name: IconName; color: string }) {
  const common = { fill: 'none' as const, stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let shape;
  switch (name) {
    case 'bold': shape = <Path {...common} d="M7 4.5h5.7a3.2 3.2 0 0 1 0 6.4H7zm0 6.4h6.4a3.3 3.3 0 0 1 0 6.6H7z" />; break;
    case 'italic': shape = <Path {...common} d="M14.8 4.5h-5m4.4 0L9.8 17.5m4.4 0h-5" />; break;
    case 'strike': shape = <><Path {...common} d="M7 7.2c.7-1.8 2.2-2.7 4.4-2.7 2.3 0 3.8 1.1 3.8 2.8 0 1.2-.7 2-1.8 2.7M7 16.8c.8.8 2.1 1.2 3.8 1.2 2.6 0 4.2-1 4.2-2.8 0-1.1-.7-1.9-1.9-2.5" /><Path {...common} d="M4 12h16" /></>; break;
    case 'h1': shape = <><Path {...common} d="M5 5v14M12 5v14M5 12h7M16 7h4M18 7v12" /></>; break;
    case 'h2': shape = <><Path {...common} d="M5 5v14M12 5v14M5 12h7M16 9c0-2 4-2 4 0 0 2-4 4-4 7h4" /></>; break;
    case 'bullets': shape = <><Path {...common} d="M10 6h9M10 12h9M10 18h9" /><Path {...common} d="M4.5 6h.1M4.5 12h.1M4.5 18h.1" strokeWidth={3} /></>; break;
    case 'numbered': shape = <><Path {...common} d="M10 6h9M10 12h9M10 18h9M4 5h2v3M4 11h2l-2 2h2M4 17c0-1 2-1 2 0s-2 1-2 2h2" /></>; break;
    case 'link': shape = <><Path {...common} d="M9.5 14.5 14.5 9.5" /><Path {...common} d="M7.8 16.2 6.4 17.6a3.4 3.4 0 0 1-4.8-4.8l4-4a3.4 3.4 0 0 1 4.8 0M16.2 7.8l1.4-1.4a3.4 3.4 0 1 1 4.8 4.8l-4 4a3.4 3.4 0 0 1-4.8 0" /></>; break;
    case 'more': shape = <><Path {...common} d="M5 7h14M5 12h14M5 17h14" /><Path {...common} d="M3 7h.1M3 12h.1M3 17h.1" strokeWidth={3} /></>; break;
  }
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">{shape}</Svg>;
}

export default function RichNoteEditor({ noteId, markdown, flushSignal, onChange, onFinish, dom }: Props) {
  const inputRef = useRef<EnrichedMarkdownTextInputInstance>(null);
  const lastFlushSignal = useRef(flushSignal);
  const [advanced, setAdvanced] = useState(() => hasAdvancedMarkdown(markdown));
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

  useEffect(() => {
    if (flushSignal <= lastFlushSignal.current) return;
    lastFlushSignal.current = flushSignal;
    if (advanced) return;
    void inputRef.current?.getMarkdown().then((body) => onFinish(body)).catch(() => onFinish(markdown));
  }, [flushSignal, advanced, markdown, onFinish]);

  if (advanced) {
    return <RichNoteEditorWeb noteId={noteId} markdown={markdown} flushSignal={flushSignal} onChange={onChange} onFinish={onFinish} dom={dom} />;
  }

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return;
    Keyboard.dismiss();
    inputRef.current?.setLink(url);
    setLinkOpen(false);
    setLinkUrl('https://');
  };

  return <View style={styles.root}>
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
      <EnrichedMarkdownTextInput
        key={noteId}
        ref={inputRef}
        defaultValue={markdown}
        onChangeMarkdown={(body) => { void onChange(body); }}
        placeholder="Start anywhere…"
        placeholderTextColor="#A3AEC2"
        markdownShortcuts={{ heading: true, unorderedList: true, orderedList: true }}
        multiline
        scrollEnabled={false}
        cursorColor="#1749E8"
        selectionColor="#C9D7FF"
        style={styles.input}
        markdownStyle={{ strong: { color: '#101D38' }, em: { color: '#34415B' }, link: { color: '#1749E8', underline: true }, h1: { fontSize: 29, fontWeight: '700', color: '#101D38' }, h2: { fontSize: 24, fontWeight: '700', color: '#101D38' }, h3: { fontSize: 20, fontWeight: '600', color: '#101D38' }, list: { itemSpacing: 6 } }}
      />
    </ScrollView>
    <View style={styles.toolbarRail}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbar} keyboardShouldPersistTaps="always">
        <Tool name="bold" label="Bold" onPress={() => inputRef.current?.toggleBold()} />
        <Tool name="italic" label="Italic" onPress={() => inputRef.current?.toggleItalic()} />
        <Tool name="strike" label="Strikethrough" onPress={() => inputRef.current?.toggleStrikethrough()} />
        <Tool name="h1" label="Large heading" onPress={() => inputRef.current?.toggleHeading(1)} />
        <Tool name="h2" label="Heading" onPress={() => inputRef.current?.toggleHeading(2)} />
        <Tool name="bullets" label="Bullet list" onPress={() => inputRef.current?.toggleUnorderedList()} />
        <Tool name="numbered" label="Numbered list" onPress={() => inputRef.current?.toggleOrderedList()} />
        <Tool name="link" label="Add link" onPress={() => setLinkOpen(true)} />
        <Tool name="more" label="Tables, quotes, and code" onPress={() => setAdvanced(true)} />
      </ScrollView>
    </View>
    <Modal visible={linkOpen} transparent animationType="fade" onRequestClose={() => setLinkOpen(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.dialog}>
          <Text style={styles.eyebrow}>LINK</Text>
          <Text style={styles.dialogTitle}>Add a link</Text>
          <Text style={styles.dialogHint}>Select text in your note first, then add its address.</Text>
          <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="https://example.com" placeholderTextColor="#A3AEC2" autoCapitalize="none" keyboardType="url" style={styles.linkInput} />
          <View style={styles.dialogActions}>
            <Pressable onPress={() => setLinkOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <Pressable onPress={applyLink} style={styles.applyButton}><Text style={styles.applyText}>Add link</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

function Tool({ name, label, onPress }: { name: IconName; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}><ToolIcon name={name} color="#53617A" /></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', minHeight: 0, backgroundColor: '#F8FAFE' },
  body: { flex: 1, minHeight: 0 },
  bodyContent: { flexGrow: 1, paddingHorizontal: 25, paddingTop: 16, paddingBottom: 108 },
  input: { flexGrow: 1, minHeight: 160, width: '100%', color: '#34415B', fontSize: 17, lineHeight: 27, padding: 0, textAlignVertical: 'top', backgroundColor: 'transparent' },
  toolbarRail: { position: 'absolute', left: 16, right: 16, bottom: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: '#E0E6F0', shadowColor: '#122753', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  toolbar: { alignItems: 'center', gap: 8, padding: 8 },
  tool: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  toolPressed: { backgroundColor: '#EAF0FF' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(10,20,44,0.4)' },
  dialog: { padding: 24, borderRadius: 24, backgroundColor: '#fff', shadowColor: '#0A1633', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  eyebrow: { color: '#1749E8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  dialogTitle: { marginTop: 8, color: '#101D38', fontSize: 25, fontWeight: '600' },
  dialogHint: { marginTop: 5, marginBottom: 12, color: '#75829C', fontSize: 14, lineHeight: 20 },
  linkInput: { height: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: '#D9E0EC', borderRadius: 12, color: '#101D38', fontSize: 15 },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, height: 47, borderWidth: 1, borderColor: '#E5EAF3', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#101D38', fontSize: 14, fontWeight: '700' },
  applyButton: { flex: 1, height: 47, borderRadius: 13, backgroundColor: '#1749E8', alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
