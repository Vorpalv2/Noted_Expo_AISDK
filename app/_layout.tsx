import { Stack } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useEffect } from "react";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url, { unsavedChangesWarning: false }) : null;
const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (Platform.OS === "ios") {
      void ScreenCapture.enableAppSwitcherProtectionAsync(0.7).catch(() => undefined);
      return () => { void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined); };
    }

    const key = "noted-app-switcher-protection";
    void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => { void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined); };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {convex ? (
          <ConvexAuthProvider client={convex} storage={Platform.OS === "web" ? undefined : secureStorage}>
            <Stack screenOptions={{ headerShown: false }} />
          </ConvexAuthProvider>
        ) : (
          <Stack screenOptions={{ headerShown: false }} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
