import { ReactNode, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const BLUE = "#1749E8";
const INK = "#101D38";
const MUTED = "#66738B";
const pages = [
  {
    title: "Keep your good ideas close.",
    body: "Pin the notes you reach for. Your recent thoughts stay right behind them.",
    art: "pinned",
  },
  {
    title: "Make a note your own.",
    body: "Use headings, tables, and checklists you can actually complete.",
    art: "editor",
  },
  {
    title: "A little help when you need it.",
    body: "Summarize a note, polish a draft, or find clear next steps with your writing assistant.",
    art: "assistant",
  },
  {
    title: "A reminder, right on time.",
    body: "Set a date and time for any checklist item. Get a reminder on your Lock Screen, even when Noted is closed.",
    art: "reminders",
  },
] as const;

export function OnboardingBrand() {
  return <View style={{ flexDirection: "row", alignItems: "center" }}>
    <View style={{ width: 21, height: 21, borderRadius: 7, borderWidth: 2, borderColor: "#DCE7FF", transform: [{ rotate: "-8deg" }], alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: "#FFD765" }} />
    </View>
    <Text style={{ color: "white", marginLeft: 9, fontSize: 23, fontWeight: "800", letterSpacing: -0.9 }}>noted</Text>
    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#FFD765", marginLeft: 3, marginTop: 11 }} />
  </View>;
}

function PinnedArtwork() {
  return <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
    <View style={{ position: "absolute", width: 258, height: 258, borderRadius: 129, borderWidth: 1, borderColor: "#FFFFFF24" }} />
    <View style={{ position: "absolute", width: 208, height: 208, borderRadius: 104, borderWidth: 1, borderColor: "#FFFFFF20" }} />
    <View style={{ position: "absolute", right: "6%", top: "12%", width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFD765" }} />
    <View style={{ position: "absolute", left: "9%", bottom: "12%", width: 5, height: 5, borderRadius: 3, backgroundColor: "#AFC4FF" }} />
    <View style={{ width: 232, height: 154, backgroundColor: "#EAF2FF", borderRadius: 23, padding: 19, transform: [{ rotate: "7deg" }, { translateX: 20 }, { translateY: 5 }], opacity: 0.96 }}>
      <View style={{ width: 29, height: 29, borderRadius: 15, backgroundColor: "#D8E7FF", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Text style={{ color: BLUE, fontSize: 17, fontWeight: "800" }}>⌖</Text></View>
      <Text style={{ color: INK, fontFamily: "serif", fontSize: 21, fontWeight: "700" }}>Things that help</Text>
      <Text style={{ color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 5 }}>A running list of small things that make life lighter.</Text>
    </View>
    <View style={{ position: "absolute", width: 232, height: 154, backgroundColor: "#FFE88F", borderRadius: 23, padding: 19, transform: [{ rotate: "-5deg" }, { translateX: -16 }, { translateY: -21 }], shadowColor: "#061E72", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
      <View style={{ width: 29, height: 29, borderRadius: 15, backgroundColor: "#FFD765", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Text style={{ color: BLUE, fontSize: 17, fontWeight: "800" }}>⌖</Text></View>
      <Text style={{ color: INK, fontFamily: "serif", fontSize: 21, fontWeight: "700" }}>A slower morning</Text>
      <Text style={{ color: "#53617A", fontSize: 12, lineHeight: 17, marginTop: 5 }}>Make space for clearer thoughts.</Text>
      <View style={{ position: "absolute", right: 17, top: 18, width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
    </View>
  </View>;
}

function EditorArtwork() {
  return <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
    <View style={{ position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#FFFFFF0D" }} />
    <View style={{ width: 264, height: 204, borderRadius: 25, backgroundColor: "white", padding: 20, shadowColor: "#061E72", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 9, transform: [{ rotate: "-2deg" }] }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE, marginRight: 7 }} />
        <Text style={{ color: MUTED, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>YOUR NOTE</Text>
      </View>
      <Text style={{ color: INK, fontFamily: "serif", fontSize: 24, fontWeight: "700", marginBottom: 13 }}>Sunday plans</Text>
      {[[true, "Pick up fresh bread"], [false, "Call Sam about dinner"], [false, "Bring the notebook"]].map(([done, label], index) => <View key={String(label)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 11 }}>
        <View style={{ width: 17, height: 17, borderRadius: 5, borderWidth: 1.5, borderColor: done ? BLUE : "#B9C4D5", backgroundColor: done ? BLUE : "white", marginRight: 10, alignItems: "center", justifyContent: "center" }}>{done && <Text style={{ color: "white", fontSize: 11, lineHeight: 14, fontWeight: "800" }}>✓</Text>}</View>
        <Text style={{ color: done ? "#8B96A9" : "#40506B", fontSize: 13, textDecorationLine: done ? "line-through" : "none" }}>{label}</Text>
      </View>)}
      <View style={{ position: "absolute", left: 17, right: 17, bottom: -21, height: 43, borderRadius: 17, backgroundColor: "#F5F7FC", borderWidth: 1, borderColor: "#E4EAF5", flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", shadowColor: "#152B60", shadowOpacity: 0.12, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}>
        <Text style={{ color: BLUE, fontSize: 18, fontWeight: "800" }}>B</Text><Text style={{ color: "#52617A", fontSize: 17, fontStyle: "italic" }}>i</Text><Text style={{ color: "#52617A", fontSize: 15, fontWeight: "700" }}>H</Text><Text style={{ color: "#52617A", fontSize: 18 }}>☷</Text><View style={{ width: 18, height: 15, borderWidth: 1.5, borderColor: "#52617A", borderRadius: 2 }} />
      </View>
    </View>
  </View>;
}

function AssistantArtwork() {
  return <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
    <View style={{ position: "absolute", width: 248, height: 248, borderRadius: 124, borderWidth: 1, borderColor: "#FFFFFF20" }} />
    <View style={{ position: "absolute", width: 176, height: 176, borderRadius: 88, borderWidth: 1, borderColor: "#FFFFFF1A" }} />
    <View style={{ width: 262, borderRadius: 24, padding: 20, backgroundColor: "white", shadowColor: "#061E72", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 9, transform: [{ rotate: "2deg" }] }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
        <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: "#EAF0FF", alignItems: "center", justifyContent: "center", marginRight: 10 }}><Text style={{ color: BLUE, fontSize: 19 }}>✳</Text></View>
        <View><Text style={{ color: INK, fontSize: 14, fontWeight: "800" }}>Writing assistant</Text><Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>A little help with this note</Text></View>
      </View>
      {["Summarize", "Improve writing", "Extract tasks"].map((label, index) => <View key={label} style={{ height: 37, borderRadius: 11, backgroundColor: index === 0 ? "#F2F5FF" : "white", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 11, marginTop: 5, borderWidth: 1, borderColor: index === 0 ? "#DCE6FF" : "#EFF2F7" }}>
        <Text style={{ color: index === 0 ? BLUE : "#465570", fontSize: 12, fontWeight: "700" }}>{label}</Text><Text style={{ color: index === 0 ? BLUE : "#9AA6B9", fontSize: 16 }}>›</Text>
      </View>)}
      <Text style={{ color: "#8490A4", fontSize: 10, lineHeight: 14, marginTop: 12 }}>Only the note you choose is sent to the assistant.</Text>
    </View>
    <View style={{ position: "absolute", right: "10%", top: "13%", width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFD765", alignItems: "center", justifyContent: "center", shadowColor: "#071E71", shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}><Text style={{ color: BLUE, fontSize: 17 }}>✦</Text></View>
  </View>;
}

function ReminderArtwork() {
  return <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
    <View style={{ position: "absolute", width: 248, height: 248, borderRadius: 124, borderWidth: 1, borderColor: "#FFFFFF20" }} />
    <View style={{ position: "absolute", width: 184, height: 184, borderRadius: 92, borderWidth: 1, borderColor: "#FFFFFF18" }} />
    <View style={{ width: 265, borderRadius: 24, padding: 19, backgroundColor: "white", shadowColor: "#061E72", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 9, transform: [{ rotate: "-2deg" }] }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <View style={{ width: 29, height: 29, borderRadius: 10, backgroundColor: "#EAF0FF", alignItems: "center", justifyContent: "center", marginRight: 9 }}><Text style={{ color: BLUE, fontSize: 16, fontWeight: "800" }}>◷</Text></View>
        <View><Text style={{ color: INK, fontSize: 13, fontWeight: "800" }}>Task reminder</Text><Text style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>Today · 6:30 PM</Text></View>
      </View>
      <View style={{ height: 1, backgroundColor: "#E9EDF5", marginBottom: 13 }} />
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 17, height: 17, borderRadius: 5, borderWidth: 1.5, borderColor: "#AAB6CA", marginRight: 10 }} />
        <Text style={{ color: "#40506B", fontSize: 13, fontWeight: "600" }}>Pick up fresh bread</Text>
      </View>
      <View style={{ alignSelf: "flex-start", marginTop: 15, borderRadius: 10, backgroundColor: "#EAF0FF", paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: BLUE, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>REMINDER SET</Text>
      </View>
    </View>
    <View style={{ position: "absolute", right: "3%", bottom: "11%", flexDirection: "row", alignItems: "center", backgroundColor: "#F5F7FC", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, shadowColor: "#061E72", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 7, transform: [{ rotate: "3deg" }] }}>
      <View style={{ width: 27, height: 27, borderRadius: 9, backgroundColor: BLUE, alignItems: "center", justifyContent: "center", marginRight: 9 }}><Text style={{ color: "white", fontSize: 12, fontWeight: "900" }}>n</Text></View>
      <View><Text style={{ color: INK, fontSize: 10, fontWeight: "800" }}>Noted</Text><Text style={{ color: "#52617A", fontSize: 10, marginTop: 2 }}>Pick up fresh bread</Text></View>
    </View>
  </View>;
}

export default function Onboarding({ renderSignIn }: { renderSignIn: () => ReactNode }) {
  const [page, setPage] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const pageRef = useRef(0);
  const transitioning = useRef(false);
  const { height, width } = useWindowDimensions();
  const staticSectionOffset = translateX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [width, 0, -width],
    extrapolate: "clamp",
  });

  const goTo = (requestedPage: number) => {
    if (transitioning.current) return;
    const nextPage = Math.max(0, Math.min(pages.length, requestedPage));
    const currentPage = pageRef.current;
    if (nextPage === currentPage) {
      Animated.spring(translateX, { toValue: 0, damping: 23, stiffness: 230, useNativeDriver: true }).start();
      return;
    }
    transitioning.current = true;
    const direction = nextPage > currentPage ? -1 : 1;
    Animated.timing(translateX, { toValue: direction * width, duration: 190, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) { transitioning.current = false; return; }
      pageRef.current = nextPage;
      setPage(nextPage);
      translateX.setValue(-direction * width);
      Animated.spring(translateX, { toValue: 0, damping: 23, stiffness: 230, mass: 0.85, useNativeDriver: true }).start(() => {
        transitioning.current = false;
      });
    });
  };

  const pan = Gesture.Pan()
    .enabled(Platform.OS !== "web")
    .activeOffsetX([-12, 12])
    .failOffsetY([-22, 22])
    .onUpdate((event) => {
      if (!transitioning.current) translateX.setValue(Math.max(-width, Math.min(width, event.translationX)));
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > Math.min(84, width * 0.22)) {
        goTo(pageRef.current + (event.translationX < 0 ? 1 : -1));
      } else {
        Animated.spring(translateX, { toValue: 0, damping: 22, stiffness: 240, useNativeDriver: true }).start();
      }
    })
    .onFinalize((_event, success) => {
      if (!success && !transitioning.current) Animated.spring(translateX, { toValue: 0, damping: 22, stiffness: 240, useNativeDriver: true }).start();
    })
    .runOnJS(true);

  return <View style={{ flex: 1, backgroundColor: BLUE }}>
    <StatusBar style="light" />
    <GestureDetector gesture={pan}>
      <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
        <View style={{ flex: 1, display: page < pages.length ? "flex" : "none" }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: BLUE }}>
            <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 8, paddingBottom: 12 }}>
              <Animated.View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", transform: [{ translateX: staticSectionOffset }] }}>
                <OnboardingBrand />
                <Pressable onPress={() => goTo(pages.length)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip onboarding">
                  <Text style={{ color: "#DCE7FF", fontSize: 14, fontWeight: "600", paddingVertical: 8, paddingLeft: 12 }}>Skip</Text>
                </Pressable>
              </Animated.View>

              <View style={{ flex: 1 }}>
                {pages.map((item, index) => <View key={item.art} pointerEvents={page === index ? "auto" : "none"} style={{ flex: 1, display: page === index ? "flex" : "none" }}>
                  <View style={{ height: Math.min(330, Math.max(230, height * 0.39)), marginTop: 2 }}>
                    {item.art === "pinned" ? <PinnedArtwork /> : item.art === "editor" ? <EditorArtwork /> : item.art === "assistant" ? <AssistantArtwork /> : <ReminderArtwork />}
                  </View>
                  <View style={{ paddingTop: 14, paddingBottom: 12 }}>
                    <Text style={{ color: "#BFD0FF", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 12 }}>A LITTLE SPACE FOR EVERYTHING</Text>
                    <Text style={{ maxWidth: 360, color: "white", fontFamily: "serif", fontSize: 36, lineHeight: 41, fontWeight: "700", letterSpacing: -0.8 }}>{item.title}</Text>
                    <Text style={{ maxWidth: 345, color: "#D9E4FF", fontSize: 16, lineHeight: 24, marginTop: 12 }}>{item.body}</Text>
                  </View>
                </View>)}
              </View>

              <Animated.View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, transform: [{ translateX: staticSectionOffset }] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  {Array.from({ length: pages.length + 1 }, (_, index) => <View key={index} style={{ width: index === page ? 23 : 6, height: 6, borderRadius: 4, backgroundColor: index === page ? "#FFD765" : "#FFFFFF55" }} />)}
                </View>
                <Pressable onPress={() => goTo(page + 1)} accessibilityRole="button" accessibilityLabel="Continue" style={({ pressed }) => [{ minWidth: 154, height: 54, borderRadius: 18, backgroundColor: "white", paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", shadowColor: "#071E71", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }, pressed && { opacity: 0.86, transform: [{ scale: 0.98 }] }]}>
                  <Text style={{ color: BLUE, fontSize: 15, fontWeight: "800" }}>Next</Text>
                  <Text style={{ color: BLUE, fontSize: 20, fontWeight: "600", marginLeft: 11 }}>›</Text>
                </Pressable>
              </Animated.View>
            </View>
          </SafeAreaView>
        </View>
        <View style={{ flex: 1, display: page === pages.length ? "flex" : "none" }}>
          {renderSignIn()}
        </View>
      </Animated.View>
    </GestureDetector>
  </View>;
}
