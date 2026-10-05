import { Stack } from "expo-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url, { unsavedChangesWarning: false }) : null;

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {convex ? (
          <ConvexProvider client={convex}><Stack screenOptions={{ headerShown: false }} /></ConvexProvider>
        ) : (
          <Stack screenOptions={{ headerShown: false }} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
