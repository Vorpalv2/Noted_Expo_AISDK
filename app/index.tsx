import AsyncStorage from "@react-native-async-storage/async-storage";
import { anyApi } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { StatusBar } from "expo-status-bar";
import { Swipeable } from "react-native-gesture-handler";
import { useEffect, useMemo, useRef, useState } from "react";
import Svg, { Path } from "react-native-svg";
import {
  Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions,
  Text, TextInput, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Note = {
  _id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

const api: any = anyApi;
const STORAGE_KEY = "noted.notes.v1";
const COLORS = {
  blue: "#1749E8", blueDark: "#1038C5", ink: "#101D38", muted: "#75829C",
  line: "#E5EAF3", surface: "#FFFFFF", background: "#F8FAFE", pale: "#EAF0FF", yellow: "#FFD765",
};

const starterNotes: Note[] = [
  { _id: "sample-1", title: "A slower morning", body: "Leave the phone in the other room. Make coffee, open the windows, and give the day a few quiet minutes before it starts asking for things.", pinned: true, createdAt: Date.now() - 7200000, updatedAt: Date.now() - 7200000 },
  { _id: "sample-2", title: "Books for the train", body: "The Creative Act\nSmall Things Like These\nA Field Guide to Getting Lost", pinned: true, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000 },
  { _id: "sample-3", title: "Sunday pasta", body: "Lemon, olive oil, lots of parmesan, and the last of the basil. Pick up fresh bread on the way home.", pinned: false, createdAt: Date.now() - 172800000, updatedAt: Date.now() - 172800000 },
  { _id: "sample-4", title: "An idea for later", body: "A little guide to the places that make a neighbourhood feel like yours. Start with the corner shop and the park bench in the afternoon sun.", pinned: false, createdAt: Date.now() - 259200000, updatedAt: Date.now() - 259200000 },
];

function LocalNotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      setNotes(saved ? JSON.parse(saved) : starterNotes);
      setReady(true);
    }).catch(() => { setNotes(starterNotes); setReady(true); });
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes)).catch(() => undefined);
  }, [notes, ready]);

  return <NotesExperience notes={notes}
    create={async () => ({ _id: `local-${Date.now()}`, title: "", body: "", pinned: false, createdAt: Date.now(), updatedAt: Date.now() })}
    save={(note) => setNotes((old) => {
      const updated = { ...note, updatedAt: Date.now() };
      return old.some((item) => item._id === note._id)
        ? old.map((item) => item._id === note._id ? updated : item)
        : [updated, ...old];
    })}
    togglePin={(id) => setNotes((old) => old.map((item) => item._id === id ? { ...item, pinned: !item.pinned, updatedAt: Date.now() } : item))}
    remove={(id) => setNotes((old) => old.filter((item) => item._id !== id))}
    loading={!ready} />;
}

function ConnectedNotesApp() {
  const notes = useQuery(api.notes.list) as Note[] | undefined;
  const createMutation = useMutation(api.notes.create);
  const updateMutation = useMutation(api.notes.update);
  const pinMutation = useMutation(api.notes.togglePin);
  const removeMutation = useMutation(api.notes.remove);
  return <NotesExperience notes={notes ?? []}
    create={async () => {
      const id = await createMutation({ title: "", body: "" });
      return { _id: String(id), title: "", body: "", pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
    }}
    save={(note) => updateMutation({ id: note._id as any, title: note.title, body: note.body })}
    togglePin={(id) => pinMutation({ id: id as any })}
    remove={(id) => removeMutation({ id: id as any })}
    loading={notes === undefined} />;
}

export default function Index() {
  return process.env.EXPO_PUBLIC_CONVEX_URL ? <ConnectedNotesApp /> : <LocalNotesApp />;
}

function NotesExperience({
  notes, create, save, togglePin, remove, loading,
}: {
  notes: Note[];
  create: () => Promise<Note>;
  save: (note: Note) => void | Promise<unknown>;
  togglePin: (id: string) => void | Promise<unknown>;
  remove: (id: string) => void | Promise<unknown>;
  loading: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = notes.filter((note) => !query || `${note.title} ${note.body}`.toLowerCase().includes(query));
    return {
      pinned: matches.filter((note) => note.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
      recent: matches.filter((note) => !note.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    };
  }, [notes, search]);

  useEffect(() => {
    if (!active) return;
    setSaving(true);
    const timer = setTimeout(() => {
      Promise.resolve(save(active))
        .catch(() => Alert.alert("Couldn’t save this note", "Your changes are still here. Check your connection and try again."))
        .finally(() => setSaving(false));
    }, 550);
    return () => clearTimeout(timer);
  }, [active?.title, active?.body]);

  const updateActive = (part: Partial<Note>) => setActive((note) => note ? { ...note, ...part, updatedAt: Date.now() } : note);
  const createNote = async () => {
    setBusy(true);
    try { setActive(await create()); } catch { Alert.alert("Couldn’t create a note", "Check your connection and try again."); }
    finally { setBusy(false); }
  };
  const closeEditor = async () => {
    if (active) {
      setSaving(true);
      try { await Promise.resolve(save(active)); }
      catch { Alert.alert("Couldn’t save this note", "Your changes are still here. Check your connection and try again."); return; }
    }
    setActive(null);
  };
  const handleTogglePin = (id: string) => {
    Promise.resolve(togglePin(id)).catch(() => Alert.alert("Couldn’t update this note", "Check your connection and try again."));
  };
  const requestDelete = (note: Note) => { setDeleteError(""); setDeleteTarget(note); };
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await Promise.resolve(remove(deleteTarget._id));
      if (active?._id === deleteTarget._id) setActive(null);
      setDeleteTarget(null);
    } catch {
      setDeleteError("We couldn’t delete this note. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  };
  const deleteNote = () => { if (active) requestDelete(active); };

  if (active) return <>
    <StatusBar style="dark" />
    <Editor note={active} saving={saving} onChange={updateActive} onClose={closeEditor} onDelete={deleteNote} />
    <DeleteConfirmation note={deleteTarget} error={deleteError} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />
  </>;

  return (
    <SafeAreaView style={[styles.safe, styles.homeRoot]} edges={["left", "right"]}>
      <StatusBar style="light" />
      <View style={[styles.homeHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandLine}><View style={styles.brandMark}><View style={styles.brandMarkInner} /></View><Text style={styles.brand}>noted</Text><View style={styles.brandDot} /></View>
        <Text style={styles.homeTitle}>Your notes<Text style={styles.titleDot}>.</Text></Text>
        <Text style={styles.homeSubtitle}>A little space for everything on your mind.</Text>
      </View>
      <View style={styles.homeBody}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Find a note" placeholderTextColor="#98A3B6" style={styles.searchInput} returnKeyType="search" />
        {search.length > 0 && <Pressable onPress={() => setSearch("")} hitSlop={12}><Text style={styles.clearSearch}>×</Text></Pressable>}
      </View>
      <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading ? <View style={styles.loadingState}><Text style={styles.loadingText}>Gathering your thoughts…</Text></View> : notes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.paperArt}><View style={styles.paperShadow} /><View style={styles.paper}><View style={styles.paperFold} /><View style={styles.paperLine} /><View style={[styles.paperLine, { width: "65%" }]} /><View style={[styles.paperLine, { width: "78%" }]} /></View><View style={styles.sparkle}>✳</View></View>
            <Text style={styles.emptyTitle}>Make room for{`\n`}your thoughts.</Text>
            <Text style={styles.emptyBody}>Keep the small things, the big ideas, and everything in between.</Text>
            <Pressable style={styles.emptyButton} onPress={createNote}><Text style={styles.emptyButtonText}>Write your first note</Text><Text style={styles.emptyButtonArrow}>↗</Text></Pressable>
          </View>
        ) : filtered.pinned.length + filtered.recent.length === 0 ? (
          <View style={styles.noResults}><Text style={styles.noResultsTitle}>Nothing found</Text><Text style={styles.noResultsBody}>Try another word or phrase.</Text></View>
        ) : <>
          {filtered.pinned.length > 0 && <PinnedSection notes={filtered.pinned} open={setActive} togglePin={handleTogglePin} />}
          {filtered.recent.length > 0 && <RecentSection notes={filtered.recent} open={setActive} togglePin={handleTogglePin} onDelete={requestDelete} divided={filtered.pinned.length > 0} />}
          <Text style={styles.listFootnote}>{notes.length} {notes.length === 1 ? "note" : "notes"} · kept just for you</Text>
        </>}
      </ScrollView>
      {notes.length > 0 && <Pressable style={({ pressed }) => [styles.fab, pressed && styles.pressed]} onPress={createNote} accessibilityLabel="Create a note"><Text style={styles.fabPlus}>+</Text></Pressable>}
      {busy && <View style={styles.busyVeil}><Text style={styles.busyText}>Opening a fresh page…</Text></View>}
      </View>
      <DeleteConfirmation note={deleteTarget} error={deleteError} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />
    </SafeAreaView>
  );
}

const noteCardColors = [
  { background: "#E9F3FE", ink: "#101D38", muted: "#617189" },
  { background: "#FFF0A8", ink: "#101D38", muted: "#6F7783" },
];

function cardColorsFor(id: string) {
  const stableHash = [...id].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
  return noteCardColors[stableHash % noteCardColors.length];
}

function PinnedSection({ notes, open, togglePin }: { notes: Note[]; open: (note: Note) => void; togglePin: (id: string) => void | Promise<unknown> }) {
  const { width } = useWindowDimensions();
  const cardWidth = width > 640 ? Math.min(620, (width - 96) / 2) : Math.max(148, Math.min(174, (width - 60) / 2));
  const cardHeight = Math.min(800, Math.max(230, cardWidth * 1.29));
  const cardScale = Math.min(3, Math.max(1, cardWidth / 164));
  const headingScale = Math.min(2.6, Math.max(1, width / 390));
  const cardGap = 12;
  const carouselRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const scrollNext = () => {
    const viewportWidth = width - 46;
    const maxOffset = Math.max(0, notes.length * (cardWidth + cardGap) + 12 - viewportWidth);
    const nextOffset = scrollOffset.current >= maxOffset - 2 ? 0 : Math.min(maxOffset, scrollOffset.current + cardWidth + cardGap);
    carouselRef.current?.scrollTo({ x: nextOffset, y: 0, animated: true });
  };
  return <View style={styles.section}>
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { fontSize: 22 * headingScale, lineHeight: 27 * headingScale }]}>Pinned</Text>
      <View style={styles.sectionHeadingRight}>
        <Text style={[styles.sectionCount, { fontSize: 18 * headingScale }]}>{notes.length}</Text>
        <Pressable onPress={scrollNext} accessibilityRole="button" accessibilityLabel="Show more pinned notes" hitSlop={10}>
          <Text style={[styles.sectionChevron, { fontSize: 32 * headingScale }]}>›</Text>
        </Pressable>
      </View>
    </View>
    <ScrollView
      ref={carouselRef}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + cardGap}
      snapToAlignment="start"
      contentContainerStyle={styles.pinnedCarousel}
      onMomentumScrollEnd={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.x; }}
    >
      {notes.map((note) => {
        const colors = cardColorsFor(note._id);
        return <View key={note._id} style={[styles.pinnedCard, { width: cardWidth, height: cardHeight, backgroundColor: colors.background, marginRight: cardGap, padding: 16 * cardScale }]}>
          <Pressable onPress={() => togglePin(note._id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Unpin note" style={styles.cardPinMark}>
            <PinIcon color={COLORS.blue} size={25 * cardScale} />
          </Pressable>
          <Pressable onPress={() => open(note)} style={({ pressed }) => [styles.pinnedCardMain, pressed && styles.cardPressed]}>
            <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.ink, fontSize: 22 * cardScale, lineHeight: 27 * cardScale }]}>{note.title.trim() || "Untitled note"}</Text>
            <Text numberOfLines={3} style={[styles.cardPreview, { color: colors.muted, fontSize: 15 * cardScale, lineHeight: 22 * cardScale }]}>{note.body.trim() || "A new page, ready when you are."}</Text>
            <Text style={[styles.cardTime, { color: colors.muted, fontSize: 14 * cardScale }]}>{cardDate(note.updatedAt)}</Text>
          </Pressable>
        </View>;
      })}
    </ScrollView>
  </View>;
}

function RecentSection({ notes, open, togglePin, onDelete, divided }: { notes: Note[]; open: (note: Note) => void; togglePin: (id: string) => void | Promise<unknown>; onDelete: (note: Note) => void; divided: boolean }) {
  return <View style={[styles.section, divided && styles.recentSection]}>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recent</Text><Text style={styles.sectionCount}>{String(notes.length).padStart(2, "0")}</Text></View>
    {notes.map((note) => <RecentNoteRow key={note._id} note={note} open={open} togglePin={togglePin} onDelete={onDelete} />)}
  </View>;
}

function RecentNoteRow({ note, open, togglePin, onDelete }: { note: Note; open: (note: Note) => void; togglePin: (id: string) => void | Promise<unknown>; onDelete: (note: Note) => void }) {
  const { width } = useWindowDimensions();
  const actionWidth = Math.max(120, (width - 46) * 0.5);
  const [swiped, setSwiped] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const swipeVisualProgress = useRef(new Animated.Value(0)).current;
  const fadeActionsAndRowBack = () => {
    swipeVisualProgress.stopAnimation();
    Animated.timing(swipeVisualProgress, { toValue: 0, duration: 170, useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        setActionsVisible(false);
        setSwiped(false);
      }
    });
  };
  return <Swipeable
    friction={1}
    leftThreshold={actionWidth * 0.55}
    rightThreshold={actionWidth * 0.55}
    overshootLeft={false}
    overshootRight={false}
    onSwipeableWillOpen={() => setSwiped(true)}
    onSwipeableOpen={() => {
      setActionsVisible(true);
      swipeVisualProgress.stopAnimation();
      Animated.spring(swipeVisualProgress, { toValue: 1, damping: 19, stiffness: 230, mass: 0.8, useNativeDriver: true }).start();
    }}
    onSwipeableWillClose={fadeActionsAndRowBack}
    renderLeftActions={(_, __, swipeable) => <SwipeAction width={actionWidth} visible={actionsVisible} progress={swipeVisualProgress} label="Pin" kind="pin" onPress={() => { swipeable.close(); togglePin(note._id); }} />}
    renderRightActions={(_, __, swipeable) => <SwipeAction width={actionWidth} visible={actionsVisible} progress={swipeVisualProgress} label="Delete" kind="delete" onPress={() => { swipeable.close(); onDelete(note); }} />}
  >
    <Animated.View style={[styles.noteRow, swiped && styles.noteRowSwiped, {
      opacity: swipeVisualProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.84] }),
      transform: [{ scale: swipeVisualProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) }],
    }]}>
      <Pressable onPress={() => open(note)} style={({ pressed }) => [styles.noteCopy, pressed && styles.rowPressed]}>
        <Text numberOfLines={1} style={styles.noteTitle}>{note.title.trim() || "Untitled note"}</Text>
        <Text numberOfLines={1} style={styles.notePreview}>{note.body.trim() || "A new page, ready when you are."}</Text>
      </Pressable>
      <View style={styles.noteMeta}><Text style={styles.noteTime}>{relativeTime(note.updatedAt)}</Text><Pressable onPress={() => togglePin(note._id)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Pin note" style={styles.pinButton}><PinIcon color={COLORS.blue} /></Pressable></View>
    </Animated.View>
  </Swipeable>;
}

function SwipeAction({ width, visible, progress, label, kind, onPress }: { width: number; visible: boolean; progress: Animated.Value; label: string; kind: "pin" | "delete"; onPress: () => void }) {
  const actionStyle = kind === "pin" ? styles.swipePin : styles.swipeDelete;
  const edgeGap = 10;
  return <View style={[styles.swipeActionSlot, { width }]}>
    <Animated.View style={[styles.swipeAction, { width: width - edgeGap, marginLeft: kind === "delete" ? edgeGap : 0, marginRight: kind === "pin" ? edgeGap : 0 }, visible ? actionStyle : styles.swipeHidden, {
      opacity: progress,
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
    }]}>
      {visible && <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} note`} style={styles.swipeActionButton}>
        {kind === "pin" ? <PinIcon color="white" size={21} /> : <Text style={styles.swipeDeleteGlyph}>×</Text>}
        <Text style={styles.swipeActionLabel}>{label}</Text>
      </Pressable>}
    </Animated.View>
  </View>;
}

function DeleteConfirmation({ note, error, deleting, onCancel, onConfirm }: { note: Note | null; error: string; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal visible={!!note} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
    <View style={styles.deleteOverlay}>
      <View style={styles.deleteCard}>
        <View style={styles.deleteMark}><Text style={styles.deleteMarkGlyph}>×</Text></View>
        <Text style={styles.deleteTitle}>Delete this note?</Text>
        <Text style={styles.deleteBody}>
          “{note?.title.trim() || "Untitled note"}” will be removed from your notes. This can’t be undone.
        </Text>
        {!!error && <Text style={styles.deleteError}>{error}</Text>}
        <View style={styles.deleteButtons}>
          <Pressable onPress={onCancel} disabled={deleting} style={({ pressed }) => [styles.deleteCancel, pressed && styles.rowPressed]}>
            <Text style={styles.deleteCancelText}>Keep note</Text>
          </Pressable>
          <Pressable onPress={onConfirm} disabled={deleting} style={({ pressed }) => [styles.deleteConfirm, pressed && styles.deletePressed, deleting && styles.deleteDisabled]}>
            <Text style={styles.deleteConfirmText}>{deleting ? "Deleting…" : "Delete note"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

function PinIcon({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="m14.9 2.9 6.2 6.2-3.5 1.1-2.7 5.8-3.8 3.8-3.9-3.9 3.8-3.8 1.1-3.5 2.8-5.7Z" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="m11.1 16.1-7.6 6.1" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
  </Svg>;
}

function Editor({ note, saving, onChange, onClose, onDelete }: { note: Note; saving: boolean; onChange: (part: Partial<Note>) => void; onClose: () => void; onDelete: () => void }) {
  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    <KeyboardAvoidingView style={styles.editor} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.editorNav}>
        <Pressable onPress={onClose} style={styles.backButton} hitSlop={8}><Text style={styles.backArrow}>‹</Text><Text style={styles.backLabel}>All notes</Text></Pressable>
        <View style={styles.saveStatus}><View style={[styles.saveDot, saving && styles.saveDotBusy]} /><Text style={styles.saveLabel}>{saving ? "Saving" : "Saved"}</Text></View>
        <Pressable onPress={onDelete} hitSlop={12} style={styles.moreButton}><Text style={styles.moreGlyph}>···</Text></Pressable>
      </View>
      <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
        <TextInput value={note.title} onChangeText={(title) => onChange({ title })} placeholder="Give this note a name" placeholderTextColor="#A3AEC2" style={styles.titleInput} multiline returnKeyType="next" blurOnSubmit={false} />
        <View style={styles.editorRule}><View style={styles.editorRuleAccent} /></View>
        <TextInput value={note.body} onChangeText={(body) => onChange({ body })} placeholder="Start anywhere…" placeholderTextColor="#A3AEC2" style={styles.bodyInput} multiline textAlignVertical="top" />
        <Text style={styles.editorFooter}>JUST FOR YOU  ·  {new Date(note.updatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function relativeTime(time: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function cardDate(time: number) {
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  homeRoot: { backgroundColor: COLORS.blue },
  homeBody: { flex: 1, backgroundColor: COLORS.background },
  homeHeader: { backgroundColor: COLORS.blue, paddingHorizontal: 25, paddingTop: 8, paddingBottom: 35, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  brandLine: { flexDirection: "row", alignItems: "center", marginBottom: 31 },
  brandMark: { width: 23, height: 23, borderRadius: 8, backgroundColor: "white", justifyContent: "center", alignItems: "center", transform: [{ rotate: "-8deg" }] },
  brandMarkInner: { width: 11, height: 13, borderWidth: 1.5, borderColor: COLORS.blue, borderRadius: 3, borderTopWidth: 3 },
  brand: { color: "white", fontSize: 17, fontWeight: "800", letterSpacing: -0.5, marginLeft: 9 }, brandDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.yellow, marginLeft: 3, marginTop: 9 },
  homeTitle: { color: "white", fontSize: 37, fontWeight: "800", letterSpacing: -1.25, lineHeight: 43 }, titleDot: { color: COLORS.yellow },
  homeSubtitle: { color: "#D9E4FF", fontSize: 14, marginTop: 5, letterSpacing: 0.05 },
  searchWrap: { height: 51, marginHorizontal: 22, marginTop: -18, backgroundColor: "white", borderRadius: 15, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, shadowColor: "#0C2D88", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4, zIndex: 2 },
  searchIcon: { color: COLORS.blue, fontSize: 25, transform: [{ rotate: "-18deg" }], marginRight: 8, marginTop: -4 }, searchInput: { flex: 1, fontSize: 15, color: COLORS.ink, paddingVertical: 0 }, clearSearch: { color: COLORS.muted, fontSize: 23, paddingLeft: 8 },
  listContent: { flexGrow: 1, paddingHorizontal: 23, paddingTop: 25, paddingBottom: 38 },
  section: { marginBottom: 27 }, sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }, sectionTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "700", letterSpacing: -0.4 }, sectionCount: { color: "#8995A8", fontWeight: "500", marginRight: 14 }, sectionHeadingRight: { flexDirection: "row", alignItems: "center" }, sectionChevron: { color: "#8B97AA", lineHeight: 36, fontWeight: "300", paddingHorizontal: 4, marginTop: -3 },
  pinnedCarousel: { paddingRight: 12 },
  pinnedCard: { borderRadius: 24, borderWidth: 2, borderColor: COLORS.ink, padding: 16, shadowColor: "#173B91", shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 }, pinnedCardMain: { flex: 1 }, cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  cardPinMark: { width: 30, height: 30, marginBottom: 12, alignItems: "flex-start", justifyContent: "center" },
  pinButton: { width: 27, height: 27, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.pale },
  cardTitle: { fontFamily: "serif", fontSize: 22, fontWeight: "600", lineHeight: 27, letterSpacing: -0.4 }, cardPreview: { fontSize: 15, lineHeight: 22, marginTop: 9 }, cardTime: { marginTop: "auto", paddingTop: 12, fontSize: 14, fontWeight: "500" },
  recentSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingTop: 21, marginTop: 0 },
  noteRow: { minHeight: 82, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, paddingVertical: 14 }, noteRowSwiped: { opacity: 0.82, filter: [{ blur: 1.2 }] }, rowPressed: { opacity: 0.65 }, noteCopy: { flex: 1, paddingRight: 10 }, noteTitle: { color: COLORS.ink, fontSize: 16.5, fontWeight: "600", letterSpacing: -0.25 }, notePreview: { color: COLORS.muted, fontSize: 13.5, lineHeight: 18, marginTop: 5 }, noteMeta: { width: 77, alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, noteTime: { color: "#9AA5B7", fontSize: 11, marginBottom: 2 },
  swipeActionSlot: { flex: 1, paddingVertical: 8 }, swipeAction: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 2, borderColor: COLORS.ink, shadowColor: COLORS.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 0 }, swipeActionButton: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", gap: 5 }, swipePin: { backgroundColor: COLORS.blue }, swipeDelete: { backgroundColor: "#D64A55" }, swipeHidden: { backgroundColor: "transparent", borderColor: "transparent", shadowOpacity: 0 }, swipeActionLabel: { color: "white", fontSize: 11, fontWeight: "800", letterSpacing: 0.15 }, swipeDeleteGlyph: { color: "white", fontSize: 26, lineHeight: 26, fontWeight: "700" },
  deleteOverlay: { flex: 1, backgroundColor: "rgba(10, 20, 44, 0.38)", alignItems: "center", justifyContent: "center", paddingHorizontal: 26 },
  deleteCard: { width: "100%", maxWidth: 390, backgroundColor: "white", borderRadius: 25, paddingHorizontal: 24, paddingTop: 25, paddingBottom: 22, shadowColor: "#0A1633", shadowOpacity: 0.2, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  deleteMark: { width: 43, height: 43, borderRadius: 15, backgroundColor: "#FFF0F1", alignItems: "center", justifyContent: "center", marginBottom: 17 }, deleteMarkGlyph: { color: "#D64A55", fontSize: 27, lineHeight: 30, fontWeight: "300", marginTop: -2 },
  deleteTitle: { color: COLORS.ink, fontFamily: "serif", fontSize: 25, lineHeight: 31, fontWeight: "600", letterSpacing: -0.45 }, deleteBody: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginTop: 8 }, deleteError: { color: "#B92E3A", fontSize: 13, lineHeight: 18, marginTop: 12 },
  deleteButtons: { flexDirection: "row", gap: 10, marginTop: 23 }, deleteCancel: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" }, deleteCancelText: { color: COLORS.ink, fontSize: 14, fontWeight: "600" }, deleteConfirm: { flex: 1, height: 48, borderRadius: 14, backgroundColor: "#D64A55", alignItems: "center", justifyContent: "center" }, deleteConfirmText: { color: "white", fontSize: 14, fontWeight: "700" }, deletePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] }, deleteDisabled: { opacity: 0.6 },
  listFootnote: { textAlign: "center", color: "#A5B0C1", fontSize: 11, marginTop: 0 },
  fab: { position: "absolute", right: 23, bottom: 26, width: 59, height: 59, borderRadius: 21, backgroundColor: COLORS.blue, justifyContent: "center", alignItems: "center", shadowColor: COLORS.blue, shadowOpacity: 0.28, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 6 }, pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] }, fabPlus: { fontSize: 34, fontWeight: "300", color: "white", marginTop: -3 },
  emptyWrap: { flex: 1, minHeight: 510, borderRadius: 24, backgroundColor: COLORS.blue, marginTop: 8, marginHorizontal: -23, paddingHorizontal: 31, paddingTop: 44, paddingBottom: 35, alignItems: "flex-start", justifyContent: "center" },
  paperArt: { width: 104, height: 94, marginBottom: 32, alignSelf: "center", marginTop: 4 }, paperShadow: { position: "absolute", width: 58, height: 74, left: 30, top: 9, borderRadius: 11, backgroundColor: "#0D36C8", transform: [{ rotate: "9deg" }] }, paper: { width: 61, height: 77, left: 20, top: 4, borderRadius: 10, backgroundColor: "white", paddingTop: 26, paddingHorizontal: 12, transform: [{ rotate: "-8deg" }] }, paperFold: { position: "absolute", top: 0, right: 0, width: 19, height: 19, borderBottomLeftRadius: 8, backgroundColor: "#DDE6FF" }, paperLine: { height: 3, borderRadius: 2, width: "100%", backgroundColor: "#D7E0F2", marginBottom: 7 }, sparkle: { position: "absolute", color: COLORS.yellow, fontSize: 30, right: 3, top: 0 },
  emptyTitle: { color: "white", fontSize: 32, lineHeight: 36, fontWeight: "800", letterSpacing: -1, alignSelf: "center", textAlign: "center" }, emptyBody: { color: "#D8E3FF", textAlign: "center", fontSize: 13.5, lineHeight: 20, marginTop: 12, marginHorizontal: 13 }, emptyButton: { height: 51, borderRadius: 15, backgroundColor: "white", alignSelf: "stretch", marginTop: 25, alignItems: "center", justifyContent: "center", flexDirection: "row" }, emptyButtonText: { color: COLORS.blue, fontSize: 14, fontWeight: "700" }, emptyButtonArrow: { color: COLORS.blue, fontSize: 16, marginLeft: 10, marginTop: -2 },
  noResults: { alignItems: "center", paddingTop: 78 }, noResultsTitle: { color: COLORS.ink, fontWeight: "700", fontSize: 19 }, noResultsBody: { color: COLORS.muted, fontSize: 13, marginTop: 7 },
  loadingState: { alignItems: "center", paddingTop: 90 }, loadingText: { color: COLORS.muted, fontSize: 14 }, busyVeil: { position: "absolute", bottom: 94, alignSelf: "center", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.ink }, busyText: { color: "white", fontSize: 12 },
  editor: { flex: 1 }, editorNav: { height: 59, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line }, backButton: { flexDirection: "row", alignItems: "center", minWidth: 95 }, backArrow: { color: COLORS.blue, fontSize: 32, lineHeight: 34, marginRight: 4, fontWeight: "300", marginTop: -3 }, backLabel: { color: COLORS.blue, fontSize: 14, fontWeight: "600" }, saveStatus: { flexDirection: "row", alignItems: "center" }, saveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#63C9A1", marginRight: 6 }, saveDotBusy: { backgroundColor: COLORS.yellow }, saveLabel: { color: COLORS.muted, fontSize: 11 }, moreButton: { minWidth: 40, alignItems: "flex-end" }, moreGlyph: { fontSize: 23, color: COLORS.muted, letterSpacing: 1, marginTop: -12 }, editorScroll: { flex: 1 }, editorContent: { paddingTop: 31, paddingHorizontal: 25, paddingBottom: 50, minHeight: "100%" }, titleInput: { color: COLORS.ink, fontSize: 30, lineHeight: 37, fontWeight: "700", letterSpacing: -0.9, padding: 0, minHeight: 46 }, editorRule: { height: 1, backgroundColor: COLORS.line, marginTop: 23, marginBottom: 21 }, editorRuleAccent: { width: 35, height: 2, backgroundColor: COLORS.blue, marginTop: -1 }, bodyInput: { flex: 1, color: "#34415B", fontSize: 18, lineHeight: 29, padding: 0, minHeight: 250 }, editorFooter: { color: "#A0AABD", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginTop: 50 },
});
