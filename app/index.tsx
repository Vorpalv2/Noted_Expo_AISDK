import AsyncStorage from "@react-native-async-storage/async-storage";
import { anyApi } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { StatusBar } from "expo-status-bar";
import { Gesture, GestureDetector, Swipeable } from "react-native-gesture-handler";
import { useEffect, useMemo, useRef, useState } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import RichNoteEditor from "../components/RichNoteEditor";
import {
  ActivityIndicator, Alert, Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions,
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
const DARK_COLORS = {
  ...COLORS,
  ink: "#F4F6FB", muted: "#B0BACB", line: "#2A3140", surface: "#141821",
  background: "#080A0F", pale: "#1B2C50",
};
type NoteActionMenu = { note: Note; x: number; y: number };

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [darkMode, setDarkMode] = useState(false);
  const palette = darkMode ? DARK_COLORS : COLORS;
  const [themeReveal, setThemeReveal] = useState<{ visible: boolean; dark: boolean; x: number; y: number }>({ visible: false, dark: false, x: 0, y: 0 });
  const themeRevealProgress = useRef(new Animated.Value(0)).current;
  const themeRevealRunning = useRef(false);
  const themeRevealDiameter = Math.ceil(Math.hypot(screenWidth, screenHeight) * 2);
  const themeRevealScale = themeRevealProgress;
  const editorTranslateX = useRef(new Animated.Value(screenWidth)).current;
  const headerProgress = useRef(new Animated.Value(0)).current;
  const nativeHeaderCollapsedRef = useRef(false);
  const lastNativeScrollOffsetRef = useRef(0);
  const headerHeight = headerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [insets.top + 162, insets.top + 43],
    extrapolate: "clamp",
  });
  const headerCollapse = headerProgress;
  const heroHeight = headerProgress.interpolate({ inputRange: [0, 1], outputRange: [70, 0], extrapolate: "clamp" });
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Note | null>(null);
  const [actionMenu, setActionMenu] = useState<NoteActionMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = notes.filter((note) => !query || `${note.title} ${note.body}`.toLowerCase().includes(query));
    return {
      pinned: matches.filter((note) => note.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
      recent: matches.filter((note) => !note.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    };
  }, [notes, search]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, []);

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
  const closeEditor = async (latestBody?: string) => {
    if (active) {
      setSaving(true);
      try { await Promise.resolve(save({ ...active, body: latestBody ?? active.body })); }
      catch { Alert.alert("Couldn’t save this note", "Your changes are still here. Check your connection and try again."); return; }
    }
    setActive(null);
  };
  useEffect(() => {
    if (active) {
      Animated.spring(editorTranslateX, {
        toValue: 0,
        damping: 28,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    } else {
      editorTranslateX.setValue(screenWidth);
    }
  }, [active?._id, editorTranslateX, screenWidth]);
  const backSwipe = useMemo(() => Gesture.Pan()
    .hitSlop({ left: 0, width: 28 })
    .activeOffsetX(8)
    .failOffsetY([-18, 18])
    .onUpdate((event) => {
      editorTranslateX.setValue(Math.max(0, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX > 90) {
        Animated.timing(editorTranslateX, {
          toValue: screenWidth,
          duration: 190,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) void closeEditor();
        });
      } else {
        Animated.spring(editorTranslateX, {
          toValue: 0,
          damping: 26,
          stiffness: 280,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      }
    })
    .onFinalize((_event, success) => {
      if (!success) {
        Animated.spring(editorTranslateX, {
          toValue: 0,
          damping: 26,
          stiffness: 280,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      }
    })
    .runOnJS(true), [closeEditor, editorTranslateX, screenWidth]);
  const handleTogglePin = (id: string) => {
    Promise.resolve(togglePin(id)).catch(() => Alert.alert("Couldn’t update this note", "Check your connection and try again."));
  };
  const showNoteActions = (note: Note, x: number, y: number) => setActionMenu({ note, x, y });
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

  const toggleTheme = (event: any) => {
    if (themeRevealRunning.current) return;
    const nextDark = !darkMode;
    const { pageX, pageY } = event.nativeEvent;
    const x = typeof pageX === "number" ? pageX : screenWidth - 46;
    const y = typeof pageY === "number" ? pageY : insets.top + 20;
    themeRevealRunning.current = true;
    themeRevealProgress.setValue(0);
    setThemeReveal({ visible: true, dark: nextDark, x, y });
    Animated.timing(themeRevealProgress, { toValue: 1, duration: 520, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setDarkMode(nextDark);
      themeRevealProgress.setValue(0);
      setThemeReveal((current) => ({ ...current, visible: false }));
      themeRevealRunning.current = false;
    });
  };

  const onHomeScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (Platform.OS === "web") {
      headerProgress.setValue(Math.max(0, Math.min(1, offsetY / 90)));
      return;
    }

    if (nativeHeaderCollapsedRef.current) {
      if (offsetY < lastNativeScrollOffsetRef.current - 0.5 && offsetY <= 2) {
        nativeHeaderCollapsedRef.current = false;
        Animated.timing(headerProgress, { toValue: 0, duration: 220, useNativeDriver: false }).start();
      }
    } else {
      const progress = Math.max(0, Math.min(1, (offsetY - 24) / 110));
      headerProgress.setValue(progress);
      if (progress >= 1) {
        nativeHeaderCollapsedRef.current = true;
      }
    }

    lastNativeScrollOffsetRef.current = offsetY;
  };

  const onHomeScrollBeginDrag = (event: any) => {
    if (Platform.OS === "web") return;
    const offsetY = event.nativeEvent.contentOffset.y;
    lastNativeScrollOffsetRef.current = offsetY;
    if (nativeHeaderCollapsedRef.current && offsetY <= 2) {
      nativeHeaderCollapsedRef.current = false;
      Animated.timing(headerProgress, { toValue: 0, duration: 220, useNativeDriver: false }).start();
    }
  };

  const homeScreen = (
    <SafeAreaView style={[styles.safe, styles.homeRoot, { backgroundColor: palette.background }]} edges={["left", "right"]}>
      <StatusBar style="light" />
      <Animated.View style={[styles.homeHeader, {
        paddingTop: insets.top + 8,
        paddingBottom: headerCollapse.interpolate({ inputRange: [0, 1], outputRange: [35, 12] }),
        height: headerHeight,
      }]}>
        <Animated.View style={[styles.brandLine, { marginBottom: headerCollapse.interpolate({ inputRange: [0, 1], outputRange: [31, 0] }) }]}>
          <View style={styles.brandMark}><View style={styles.brandMarkInner} /></View><Text style={styles.brand}>noted</Text><View style={styles.brandDot} />
        </Animated.View>
        <Animated.View style={{
          height: heroHeight,
          opacity: headerCollapse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] }),
          overflow: "hidden",
        }}>
          <Animated.Text style={[styles.homeTitle, {
            fontSize: headerCollapse.interpolate({ inputRange: [0, 1], outputRange: [37, 24] }),
            lineHeight: headerCollapse.interpolate({ inputRange: [0, 1], outputRange: [43, 30] }),
            letterSpacing: headerCollapse.interpolate({ inputRange: [0, 1], outputRange: [-1.25, -0.5] }),
          }]}>Your notes<Text style={styles.titleDot}>.</Text></Animated.Text>
          <Text style={styles.homeSubtitle}>A little space for everything on your mind.</Text>
        </Animated.View>
      </Animated.View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.homeBody, { backgroundColor: palette.background }]}>
      <Animated.ScrollView
        style={[styles.notesScroll, { backgroundColor: palette.background }]}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 162 + 25 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onHomeScroll}
        onScrollBeginDrag={onHomeScrollBeginDrag}
      >
        {loading ? <View style={styles.loadingState}><Text style={[styles.loadingText, { color: palette.muted }]}>Gathering your thoughts…</Text></View> : notes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.paperArt}><View style={styles.paperShadow} /><View style={styles.paper}><View style={styles.paperFold} /><View style={styles.paperLine} /><View style={[styles.paperLine, { width: "65%" }]} /><View style={[styles.paperLine, { width: "78%" }]} /></View><View style={styles.sparkle}>✳</View></View>
            <Text style={styles.emptyTitle}>Make room for{`\n`}your thoughts.</Text>
            <Text style={styles.emptyBody}>Keep the small things, the big ideas, and everything in between.</Text>
            <Pressable style={styles.emptyButton} onPress={createNote}><Text style={styles.emptyButtonText}>Write your first note</Text><Text style={styles.emptyButtonArrow}>↗</Text></Pressable>
          </View>
        ) : filtered.pinned.length + filtered.recent.length === 0 ? (
          <View style={styles.noResults}><Text style={[styles.noResultsTitle, { color: palette.ink }]}>Nothing found</Text><Text style={[styles.noResultsBody, { color: palette.muted }]}>Try another word or phrase.</Text></View>
        ) : <>
          {filtered.pinned.length > 0 && <PinnedSection notes={filtered.pinned} open={setActive} togglePin={handleTogglePin} showActions={showNoteActions} darkMode={darkMode} />}
          {filtered.recent.length > 0 && <RecentSection notes={filtered.recent} open={setActive} togglePin={handleTogglePin} onDelete={requestDelete} showActions={showNoteActions} divided={filtered.pinned.length > 0} darkMode={darkMode} />}
          <Text style={[styles.listFootnote, { color: darkMode ? "#758096" : "#A5B0C1" }]}>{notes.length} {notes.length === 1 ? "note" : "notes"} · kept just for you</Text>
        </>}
      </Animated.ScrollView>
      {notes.length > 0 && <View style={[styles.bottomSearchCreate, { bottom: keyboardVisible ? 12 : insets.bottom + 14 }]}>
        <View style={[styles.bottomSearchWrap, darkMode && styles.darkSurface, darkMode && styles.darkBorder]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.bottomSearchIcon}>
            <Circle cx={10.8} cy={10.8} r={6.8} stroke={COLORS.blue} strokeWidth={2} />
            <Path d="m16 16 4.5 4.5" stroke={COLORS.blue} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <TextInput value={search} onChangeText={setSearch} placeholder="Find a note" placeholderTextColor={darkMode ? "#929DB2" : "#98A3B6"} style={[styles.searchInput, { color: palette.ink }]} returnKeyType="search" />
          {search.length > 0 && <Pressable onPress={() => setSearch("")} hitSlop={12} accessibilityLabel="Clear search"><Text style={[styles.clearSearch, darkMode && { color: palette.muted }]}>×</Text></Pressable>}
        </View>
        <Pressable style={({ pressed }) => [styles.bottomCreateButton, pressed && styles.pressed]} onPress={createNote} accessibilityRole="button" accessibilityLabel="Create a note">
          <Svg width={25} height={25} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke="white" strokeWidth={2} strokeLinecap="round" /></Svg>
        </Pressable>
      </View>}
      {busy && <View style={[styles.busyVeil, darkMode && styles.darkSurface]}><Text style={styles.busyText}>Opening a fresh page…</Text></View>}
      </View>
      </KeyboardAvoidingView>
      <NoteActions menu={actionMenu} onCancel={() => setActionMenu(null)} onEdit={() => { if (actionMenu) setActive(actionMenu.note); setActionMenu(null); }} onPin={() => { if (actionMenu) handleTogglePin(actionMenu.note._id); setActionMenu(null); }} onDelete={() => { if (actionMenu) requestDelete(actionMenu.note); setActionMenu(null); }} darkMode={darkMode} />
      <DeleteConfirmation note={deleteTarget} error={deleteError} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} darkMode={darkMode} />
      {themeReveal.visible && <Animated.View pointerEvents="none" style={{ position: "absolute", zIndex: 1, width: themeRevealDiameter, height: themeRevealDiameter, left: themeReveal.x - themeRevealDiameter / 2, top: themeReveal.y - themeRevealDiameter / 2, borderRadius: themeRevealDiameter / 2, backgroundColor: themeReveal.dark ? DARK_COLORS.background : COLORS.background, transform: [{ scale: themeRevealScale }] }} />}
      <Pressable onPress={toggleTheme} accessibilityRole="button" accessibilityLabel={darkMode ? "Switch to light mode" : "Switch to dark mode"} style={[styles.themeToggle, themeReveal.visible && styles.themeToggleRevealing, { top: insets.top + 8 }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          {darkMode
            ? <Path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" stroke="white" strokeWidth={1.8} strokeLinecap="round" />
            : <Path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.6 8.6 0 1 0 20.2 15.2Z" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
        </Svg>
      </Pressable>
    </SafeAreaView>
  );
  if (!active) return homeScreen;

  const editorScreen = <>
    <StatusBar style={darkMode ? "light" : "dark"} />
    <Editor note={active} saving={saving} onChange={updateActive} onClose={closeEditor} onDelete={deleteNote} darkMode={darkMode} />
    <DeleteConfirmation note={deleteTarget} error={deleteError} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} darkMode={darkMode} />
  </>;
  const translatedEditor = (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.background, transform: [{ translateX: editorTranslateX }] }]}>
      {editorScreen}
    </Animated.View>
  );
  return (
    <View style={{ flex: 1 }}>
      <Animated.View
        pointerEvents="none"
        style={[{ flex: 1 }, Platform.OS !== "web" && {
          transform: [{ translateX: editorTranslateX.interpolate({
            inputRange: [0, screenWidth],
            outputRange: [-24, 0],
            extrapolate: "clamp",
          }) }],
        }]}
      >
        {homeScreen}
      </Animated.View>
      {Platform.OS === "web" ? translatedEditor : (
        <GestureDetector gesture={backSwipe}>{translatedEditor}</GestureDetector>
      )}
    </View>
  );
}

const noteCardColors = [
  { background: "#E9F3FE", ink: "#101D38", muted: "#617189" },
  { background: "#FFF0A8", ink: "#101D38", muted: "#6F7783" },
];

function cardColorsFor(id: string, darkMode = false) {
  const stableHash = [...id].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
  return darkMode
    ? [{ background: "#17243B", ink: "#F4F6FB", muted: "#C2CCDC" }, { background: "#292416", ink: "#F4F6FB", muted: "#D5CBAF" }][stableHash % 2]
    : noteCardColors[stableHash % noteCardColors.length];
}

function PinnedSection({ notes, open, togglePin, showActions, darkMode }: { notes: Note[]; open: (note: Note) => void; togglePin: (id: string) => void | Promise<unknown>; showActions: (note: Note, x: number, y: number) => void; darkMode: boolean }) {
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
      <Text style={[styles.sectionTitle, darkMode && { color: DARK_COLORS.ink }, { fontSize: 22 * headingScale, lineHeight: 27 * headingScale }]}>Pinned</Text>
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
        const colors = cardColorsFor(note._id, darkMode);
        return <View key={note._id} style={[styles.pinnedCard, darkMode && { borderColor: DARK_COLORS.ink }, { width: cardWidth, height: cardHeight, backgroundColor: colors.background, marginRight: cardGap, padding: 16 * cardScale }]}>
          <Pressable onPress={() => togglePin(note._id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Unpin note" style={styles.cardPinMark}>
            <PinIcon color={COLORS.blue} size={25 * cardScale} />
          </Pressable>
          <Pressable onPress={() => open(note)} onLongPress={(event) => showActions(note, event.nativeEvent.pageX, event.nativeEvent.pageY)} delayLongPress={1000} style={({ pressed }) => [styles.pinnedCardMain, pressed && styles.cardPressed]}>
            <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.ink, fontSize: 22 * cardScale, lineHeight: 27 * cardScale }]}>{note.title.trim() || "Untitled note"}</Text>
            <Text numberOfLines={3} style={[styles.cardPreview, { color: colors.muted, fontSize: 15 * cardScale, lineHeight: 22 * cardScale }]}>{markdownExcerpt(note.body) || "A new page, ready when you are."}</Text>
            <Text style={[styles.cardTime, { color: colors.muted, fontSize: 14 * cardScale }]}>{cardDate(note.updatedAt)}</Text>
          </Pressable>
        </View>;
      })}
    </ScrollView>
  </View>;
}

function RecentSection({ notes, open, togglePin, onDelete, showActions, divided, darkMode }: { notes: Note[]; open: (note: Note) => void; togglePin: (id: string) => void | Promise<unknown>; onDelete: (note: Note) => void; showActions: (note: Note, x: number, y: number) => void; divided: boolean; darkMode: boolean }) {
  return <View style={[styles.section, divided && styles.recentSection]}>
    <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, darkMode && { color: DARK_COLORS.ink }]}>Recent</Text><Text style={styles.sectionCount}>{String(notes.length).padStart(2, "0")}</Text></View>
    {notes.map((note) => <RecentNoteRow key={note._id} note={note} open={open} togglePin={togglePin} onDelete={onDelete} showActions={showActions} darkMode={darkMode} />)}
  </View>;
}

function RecentNoteRow({ note, open, togglePin, onDelete, showActions, darkMode }: { note: Note; open: (note: Note) => void; togglePin: (id: string) => void | Promise<unknown>; onDelete: (note: Note) => void; showActions: (note: Note, x: number, y: number) => void; darkMode: boolean }) {
  const { width } = useWindowDimensions();
  const actionWidth = Math.max(120, (width - 46) * 0.5);
  const [swiped, setSwiped] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  return <Swipeable
    friction={1}
    leftThreshold={actionWidth * 0.55}
    rightThreshold={actionWidth * 0.55}
    overshootLeft={false}
    overshootRight={false}
    onSwipeableWillOpen={() => setSwiped(true)}
    onSwipeableOpen={() => setActionsVisible(true)}
    onSwipeableWillClose={() => { setActionsVisible(false); setSwiped(false); }}
    renderLeftActions={(actionProgress, __, swipeable) => <SwipeAction width={actionWidth} visible={actionsVisible} actionProgress={actionProgress} label="Pin" kind="pin" onPress={() => { swipeable.close(); togglePin(note._id); }} />}
    renderRightActions={(actionProgress, __, swipeable) => <SwipeAction width={actionWidth} visible={actionsVisible} actionProgress={actionProgress} label="Delete" kind="delete" onPress={() => { swipeable.close(); onDelete(note); }} />}
  >
    <View style={[styles.noteRow, darkMode && { borderBottomColor: DARK_COLORS.line }, swiped && styles.noteRowSwiped]}>
      <Pressable onPress={() => open(note)} onLongPress={(event) => showActions(note, event.nativeEvent.pageX, event.nativeEvent.pageY)} delayLongPress={1000} style={({ pressed }) => [styles.noteCopy, pressed && styles.rowPressed]}>
        <Text numberOfLines={1} style={[styles.noteTitle, darkMode && { color: DARK_COLORS.ink }]}>{note.title.trim() || "Untitled note"}</Text>
        <Text numberOfLines={1} style={[styles.notePreview, darkMode && { color: DARK_COLORS.muted }]}>{markdownExcerpt(note.body) || "A new page, ready when you are."}</Text>
      </Pressable>
      <View style={styles.noteMeta}><Text style={[styles.noteTime, darkMode && { color: "#8793A7" }]}>{relativeTime(note.updatedAt)}</Text><Pressable onPress={() => togglePin(note._id)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Pin note" style={[styles.pinButton, darkMode && { backgroundColor: DARK_COLORS.pale }]}><PinIcon color={COLORS.blue} /></Pressable></View>
    </View>
  </Swipeable>;
}

function SwipeAction({ width, visible, actionProgress, label, kind, onPress }: { width: number; visible: boolean; actionProgress: Animated.AnimatedInterpolation<number>; label: string; kind: "pin" | "delete"; onPress: () => void }) {
  const actionStyle = kind === "pin" ? styles.swipePin : styles.swipeDelete;
  const edgeGap = 10;
  const fullyOpen = actionProgress.interpolate({ inputRange: [0, 0.999, 1], outputRange: [0, 0, 1], extrapolate: "clamp" });
  return <View style={[styles.swipeActionSlot, { width }]}>
    <Animated.View style={[styles.swipeAction, { width: width - edgeGap, marginLeft: kind === "delete" ? edgeGap : 0, marginRight: kind === "pin" ? edgeGap : 0, opacity: fullyOpen }, visible ? actionStyle : styles.swipeHidden]}>
      {visible && <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} note`} style={styles.swipeActionButton}>
        {kind === "pin" ? <PinIcon color="white" size={21} /> : <Text style={styles.swipeDeleteGlyph}>×</Text>}
        <Text style={styles.swipeActionLabel}>{label}</Text>
      </Pressable>}
    </Animated.View>
  </View>;
}

function NoteActions({ menu, onCancel, onEdit, onPin, onDelete, darkMode }: { menu: NoteActionMenu | null; onCancel: () => void; onEdit: () => void; onPin: () => void; onDelete: () => void; darkMode: boolean }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const menuWidth = 198;
  const menuHeight = 72;
  const lastMenu = useRef<NoteActionMenu | null>(null);
  if (menu) lastMenu.current = menu;
  const anchor = menu ?? lastMenu.current;
  const position = anchor ? {
    left: Math.min(Math.max(8, anchor.x - menuWidth / 2), Math.max(8, width - menuWidth - 8)),
    top: Math.min(Math.max(insets.top + 8, anchor.y - menuHeight / 2), Math.max(insets.top + 8, height - insets.bottom - menuHeight - 8)),
  } : { left: 8, top: 8 };
  return <Modal visible={!!menu} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
    <View style={styles.noteActionsOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close note actions" />
      <View style={[styles.noteActionBar, darkMode && { backgroundColor: DARK_COLORS.surface, borderColor: DARK_COLORS.ink }, position]}>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit note" style={({ pressed }) => [styles.noteActionCircle, styles.noteActionEdit, pressed && styles.noteActionPressed]}>
          <Svg width={23} height={23} viewBox="0 0 24 24" fill="none"><Path d="m4 16.8-.9 4.1 4.1-.9L19 8.2 15.8 5 4 16.8Z" stroke={COLORS.blue} strokeWidth={1.8} strokeLinejoin="round" /><Path d="m13.9 6.9 3.2 3.2" stroke={COLORS.blue} strokeWidth={1.8} strokeLinecap="round" /></Svg>
        </Pressable>
        <Pressable onPress={onPin} accessibilityRole="button" accessibilityLabel={menu?.note.pinned ? "Unpin note" : "Pin note"} style={({ pressed }) => [styles.noteActionCircle, styles.noteActionPin, pressed && styles.noteActionPressed]}>
          <PinIcon color={COLORS.blue} size={23} />
        </Pressable>
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete note" style={({ pressed }) => [styles.noteActionCircle, styles.noteActionDelete, pressed && styles.noteActionPressed]}>
          <Svg width={23} height={23} viewBox="0 0 24 24" fill="none"><Path d="M4.5 7h15M9 7V4.5h6V7m2.5 0-.8 13h-9L7 7m3 3v7m4-7v7" stroke="#D64A55" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

function DeleteConfirmation({ note, error, deleting, onCancel, onConfirm, darkMode }: { note: Note | null; error: string; deleting: boolean; onCancel: () => void; onConfirm: () => void; darkMode: boolean }) {
  return <Modal visible={!!note} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
    <View style={styles.deleteOverlay}>
      <View style={[styles.deleteCard, darkMode && { backgroundColor: DARK_COLORS.surface }]}>
        <View style={styles.deleteMark}><Text style={styles.deleteMarkGlyph}>×</Text></View>
        <Text style={[styles.deleteTitle, darkMode && { color: DARK_COLORS.ink }]}>Delete this note?</Text>
        <Text style={[styles.deleteBody, darkMode && { color: DARK_COLORS.muted }]}>
          “{note?.title.trim() || "Untitled note"}” will be removed from your notes. This can’t be undone.
        </Text>
        {!!error && <Text style={styles.deleteError}>{error}</Text>}
        <View style={styles.deleteButtons}>
          <Pressable onPress={onCancel} disabled={deleting} style={({ pressed }) => [styles.deleteCancel, darkMode && { borderColor: DARK_COLORS.line, backgroundColor: DARK_COLORS.background }, pressed && styles.rowPressed]}>
            <Text style={[styles.deleteCancelText, darkMode && { color: DARK_COLORS.ink }]}>Keep note</Text>
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

function Editor({ note, saving, onChange, onClose, onDelete, darkMode }: { note: Note; saving: boolean; onChange: (part: Partial<Note>) => void; onClose: (latestBody?: string) => void; onDelete: () => void; darkMode: boolean }) {
  const insets = useSafeAreaInsets();
  const palette = darkMode ? DARK_COLORS : COLORS;
  const [flushSignal, setFlushSignal] = useState(0);
  const [editorLoaded, setEditorLoaded] = useState(Platform.OS === "web");
  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
    <KeyboardAvoidingView style={styles.editor} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.editorNav, darkMode && { borderBottomColor: palette.line }]}>
        <Pressable onPress={() => setFlushSignal((current) => current + 1)} style={styles.backButton} hitSlop={8}><Text style={styles.backArrow}>‹</Text><Text style={styles.backLabel}>All notes</Text></Pressable>
        <View style={styles.saveStatus}><View style={[styles.saveDot, saving && styles.saveDotBusy]} /><Text style={[styles.saveLabel, darkMode && { color: palette.muted }]}>{saving ? "Saving" : "Saved"}</Text></View>
        <Pressable onPress={onDelete} hitSlop={12} style={styles.moreButton}><Text style={[styles.moreGlyph, darkMode && { color: palette.muted }]}>···</Text></Pressable>
      </View>
      <View style={{ paddingHorizontal: 25, paddingTop: 18 }}>
        <TextInput value={note.title} onChangeText={(title) => onChange({ title })} placeholder="Give this note a name" placeholderTextColor={darkMode ? "#7F8BA0" : "#A3AEC2"} style={[styles.titleInput, { color: palette.ink }]} multiline returnKeyType="next" blurOnSubmit={false} />
        <View style={[styles.editorRule, darkMode && { backgroundColor: palette.line }]}><View style={styles.editorRuleAccent} /></View>
      </View>
      <View style={{ flex: 1, minHeight: 0, width: "100%", backgroundColor: palette.background }}>
        <RichNoteEditor noteId={note._id} markdown={note.body} flushSignal={flushSignal} safeBottom={insets.bottom} darkMode={darkMode} onChange={async (body) => onChange({ body })} onFinish={async (body) => onClose(body)} onReady={() => setEditorLoaded(true)} dom={{ style: { flex: 1, width: "100%", backgroundColor: palette.background } }} />
        {!editorLoaded && <View pointerEvents="none" style={[styles.editorLoading, { backgroundColor: palette.background }]}><ActivityIndicator size="large" color={COLORS.blue} /></View>}
      </View>
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

function markdownExcerpt(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " Code ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, "")
    .replace(/[|*_~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  homeRoot: { backgroundColor: COLORS.background },
  homeBody: { flex: 1, minHeight: 0, backgroundColor: COLORS.background },
  notesScroll: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", zIndex: 0 },
  homeHeader: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: COLORS.blue, paddingHorizontal: 25, paddingTop: 8, paddingBottom: 35, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, zIndex: 2, elevation: 2 },
  themeToggle: { position: "absolute", right: 22, width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", zIndex: 101, elevation: 101 },
  themeToggleRevealing: { backgroundColor: COLORS.blue, borderColor: "rgba(255,255,255,0.48)" },
  darkSurface: { backgroundColor: DARK_COLORS.surface }, darkBorder: { borderColor: "#303849" },
  brandLine: { flexDirection: "row", alignItems: "center", marginBottom: 31 },
  brandMark: { width: 23, height: 23, borderRadius: 8, backgroundColor: "white", justifyContent: "center", alignItems: "center", transform: [{ rotate: "-8deg" }] },
  brandMarkInner: { width: 11, height: 13, borderWidth: 1.5, borderColor: COLORS.blue, borderRadius: 3, borderTopWidth: 3 },
  brand: { color: "white", fontSize: 17, fontWeight: "800", letterSpacing: -0.5, marginLeft: 9 }, brandDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.yellow, marginLeft: 3, marginTop: 9 },
  homeTitle: { color: "white", fontSize: 37, fontWeight: "800", letterSpacing: -1.25, lineHeight: 43 }, titleDot: { color: COLORS.yellow },
  homeSubtitle: { color: "#D9E4FF", fontSize: 14, marginTop: 5, letterSpacing: 0.05 },
  bottomSearchCreate: { position: "absolute", left: 22, right: 22, flexDirection: "row", alignItems: "center", gap: 11, zIndex: 5 },
  bottomSearchWrap: { flex: 1, height: 58, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 20, borderWidth: 1, borderColor: "#E4EAF4", flexDirection: "row", alignItems: "center", paddingHorizontal: 17, shadowColor: "#0C2D88", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  bottomSearchIcon: { marginRight: 10 }, searchInput: { flex: 1, minWidth: 0, height: 58, fontSize: 15, lineHeight: 20, color: COLORS.ink, paddingTop: 0, paddingBottom: 0, includeFontPadding: false, textAlignVertical: "center" }, clearSearch: { color: COLORS.muted, fontSize: 23, paddingLeft: 8 },
  bottomCreateButton: { width: 58, height: 58, borderRadius: 20, backgroundColor: COLORS.blue, alignItems: "center", justifyContent: "center", shadowColor: COLORS.blue, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  listContent: { flexGrow: 1, paddingHorizontal: 23, paddingTop: 25, paddingBottom: 132 },
  section: { marginBottom: 27 }, sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }, sectionTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "700", letterSpacing: -0.4 }, sectionCount: { color: "#8995A8", fontWeight: "500", marginRight: 14 }, sectionHeadingRight: { flexDirection: "row", alignItems: "center" }, sectionChevron: { color: "#8B97AA", lineHeight: 36, fontWeight: "300", paddingHorizontal: 4, marginTop: -3 },
  pinnedCarousel: { paddingRight: 12 },
  pinnedCard: { borderRadius: 24, borderWidth: 2, borderColor: COLORS.ink, padding: 16, shadowColor: "#173B91", shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 }, pinnedCardMain: { flex: 1 }, cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  cardPinMark: { width: 30, height: 30, marginBottom: 12, alignItems: "flex-start", justifyContent: "center" },
  pinButton: { width: 27, height: 27, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.pale },
  cardTitle: { fontFamily: "serif", fontSize: 22, fontWeight: "600", lineHeight: 27, letterSpacing: -0.4 }, cardPreview: { fontSize: 15, lineHeight: 22, marginTop: 9 }, cardTime: { marginTop: "auto", paddingTop: 12, fontSize: 14, fontWeight: "500" },
  recentSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingTop: 21, marginTop: 0 },
  noteRow: { minHeight: 82, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, paddingVertical: 14 }, noteRowSwiped: { opacity: 0.82, filter: [{ blur: 1.2 }] }, rowPressed: { opacity: 0.65 }, noteCopy: { flex: 1, paddingRight: 10 }, noteTitle: { color: COLORS.ink, fontSize: 16.5, fontWeight: "600", letterSpacing: -0.25 }, notePreview: { color: COLORS.muted, fontSize: 13.5, lineHeight: 18, marginTop: 5 }, noteMeta: { width: 77, alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, noteTime: { color: "#9AA5B7", fontSize: 11, marginBottom: 2 },
  swipeActionSlot: { paddingVertical: 8 }, swipeAction: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 2, borderColor: COLORS.ink, shadowColor: COLORS.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 0 }, swipeActionButton: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", gap: 5 }, swipePin: { backgroundColor: COLORS.blue }, swipeDelete: { backgroundColor: "#D64A55" }, swipeHidden: { backgroundColor: "transparent", borderColor: "transparent", shadowOpacity: 0 }, swipeActionLabel: { color: "white", fontSize: 11, fontWeight: "800", letterSpacing: 0.15 }, swipeDeleteGlyph: { color: "white", fontSize: 26, lineHeight: 26, fontWeight: "700" },
  deleteOverlay: { flex: 1, backgroundColor: "rgba(10, 20, 44, 0.38)", alignItems: "center", justifyContent: "center", paddingHorizontal: 26 },
  deleteCard: { width: "100%", maxWidth: 390, backgroundColor: "white", borderRadius: 25, paddingHorizontal: 24, paddingTop: 25, paddingBottom: 22, shadowColor: "#0A1633", shadowOpacity: 0.2, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  deleteMark: { width: 43, height: 43, borderRadius: 15, backgroundColor: "#FFF0F1", alignItems: "center", justifyContent: "center", marginBottom: 17 }, deleteMarkGlyph: { color: "#D64A55", fontSize: 27, lineHeight: 30, fontWeight: "300", marginTop: -2 },
  deleteTitle: { color: COLORS.ink, fontFamily: "serif", fontSize: 25, lineHeight: 31, fontWeight: "600", letterSpacing: -0.45 }, deleteBody: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginTop: 8 }, deleteError: { color: "#B92E3A", fontSize: 13, lineHeight: 18, marginTop: 12 },
  deleteButtons: { flexDirection: "row", gap: 10, marginTop: 23 }, deleteCancel: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" }, deleteCancelText: { color: COLORS.ink, fontSize: 14, fontWeight: "600" }, deleteConfirm: { flex: 1, height: 48, borderRadius: 14, backgroundColor: "#D64A55", alignItems: "center", justifyContent: "center" }, deleteConfirmText: { color: "white", fontSize: 14, fontWeight: "700" }, deletePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] }, deleteDisabled: { opacity: 0.6 },
  listFootnote: { textAlign: "center", color: "#A5B0C1", fontSize: 11, marginTop: 0 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  emptyWrap: { flex: 1, minHeight: 510, borderRadius: 24, backgroundColor: COLORS.blue, marginTop: 8, marginHorizontal: -23, paddingHorizontal: 31, paddingTop: 44, paddingBottom: 35, alignItems: "flex-start", justifyContent: "center" },
  paperArt: { width: 104, height: 94, marginBottom: 32, alignSelf: "center", marginTop: 4 }, paperShadow: { position: "absolute", width: 58, height: 74, left: 30, top: 9, borderRadius: 11, backgroundColor: "#0D36C8", transform: [{ rotate: "9deg" }] }, paper: { width: 61, height: 77, left: 20, top: 4, borderRadius: 10, backgroundColor: "white", paddingTop: 26, paddingHorizontal: 12, transform: [{ rotate: "-8deg" }] }, paperFold: { position: "absolute", top: 0, right: 0, width: 19, height: 19, borderBottomLeftRadius: 8, backgroundColor: "#DDE6FF" }, paperLine: { height: 3, borderRadius: 2, width: "100%", backgroundColor: "#D7E0F2", marginBottom: 7 }, sparkle: { position: "absolute", color: COLORS.yellow, fontSize: 30, right: 3, top: 0 },
  emptyTitle: { color: "white", fontSize: 32, lineHeight: 36, fontWeight: "800", letterSpacing: -1, alignSelf: "center", textAlign: "center" }, emptyBody: { color: "#D8E3FF", textAlign: "center", fontSize: 13.5, lineHeight: 20, marginTop: 12, marginHorizontal: 13 }, emptyButton: { height: 51, borderRadius: 15, backgroundColor: "white", alignSelf: "stretch", marginTop: 25, alignItems: "center", justifyContent: "center", flexDirection: "row" }, emptyButtonText: { color: COLORS.blue, fontSize: 14, fontWeight: "700" }, emptyButtonArrow: { color: COLORS.blue, fontSize: 16, marginLeft: 10, marginTop: -2 },
  noResults: { alignItems: "center", paddingTop: 78 }, noResultsTitle: { color: COLORS.ink, fontWeight: "700", fontSize: 19 }, noResultsBody: { color: COLORS.muted, fontSize: 13, marginTop: 7 },
  loadingState: { alignItems: "center", paddingTop: 90 }, loadingText: { color: COLORS.muted, fontSize: 14 }, busyVeil: { position: "absolute", bottom: 94, alignSelf: "center", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.ink }, busyText: { color: "white", fontSize: 12 },
  editor: { flex: 1 }, editorLoading: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background, zIndex: 2 }, editorNav: { height: 59, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line }, backButton: { flexDirection: "row", alignItems: "center", minWidth: 95 }, backArrow: { color: COLORS.blue, fontSize: 32, lineHeight: 34, marginRight: 4, fontWeight: "300", marginTop: -3 }, backLabel: { color: COLORS.blue, fontSize: 14, fontWeight: "600" }, saveStatus: { flexDirection: "row", alignItems: "center" }, saveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#63C9A1", marginRight: 6 }, saveDotBusy: { backgroundColor: COLORS.yellow }, saveLabel: { color: COLORS.muted, fontSize: 11 }, moreButton: { minWidth: 40, alignItems: "flex-end" }, moreGlyph: { fontSize: 23, color: COLORS.muted, letterSpacing: 1, marginTop: -12 },
  titleInput: { color: COLORS.ink, fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.7, padding: 0, minHeight: 38 },
  editorRule: { height: 1, backgroundColor: COLORS.line, marginTop: 14, marginBottom: 13 }, editorRuleAccent: { width: 35, height: 2, backgroundColor: COLORS.blue, marginTop: -1 },

  noteActionsOverlay: { flex: 1, backgroundColor: "transparent" },
  noteActionBar: { position: "absolute", width: 198, height: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 9, borderRadius: 24, borderWidth: 2, borderColor: COLORS.ink, backgroundColor: "white", shadowColor: COLORS.ink, shadowOpacity: 0.2, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 7 },
  noteActionCircle: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 25, borderWidth: 2, borderColor: COLORS.ink, shadowColor: COLORS.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 2, height: 2 }, elevation: 2 },
  noteActionEdit: { backgroundColor: "#EAF0FF" }, noteActionPin: { backgroundColor: "#FFF0A8" }, noteActionDelete: { backgroundColor: "#FFF0F1" },
  noteActionPressed: { opacity: 0.7, transform: [{ scale: 0.93 }] },

});
