import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PostHogProvider } from "posthog-react-native";
// The whole point of this app: the SAME design tokens the web app uses, on native.
// Pure subpath (no DOM / React) so Metro can bundle it. Values must be RN-parseable
// colors (hex/rgb) — React Native cannot parse oklch().
import { tokens } from "@stack/ui/tokens";

// The design system ships light + dark palettes; this screen renders the light theme.
const c = tokens.colors.light;

// Analytics — env-gated exactly like the web (`@stack/analytics`) and server (`posthog-node`):
// no key → PostHog never initializes and the app renders normally. Expo inlines `EXPO_PUBLIC_*`
// into the client bundle, so set EXPO_PUBLIC_POSTHOG_KEY (and optionally _HOST) to turn it on.
// Point it at the SAME PostHog project as apps/web + services/api → analytics parity across
// every surface, one product, no separate mobile silo.
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export default function App() {
  // No key = analytics off (silent no-op), same contract as every other integration in the stack.
  if (!POSTHOG_KEY) return <HomeScreen />;
  return (
    <PostHogProvider apiKey={POSTHOG_KEY} options={{ host: POSTHOG_HOST }} autocapture>
      <HomeScreen />
    </PostHogProvider>
  );
}

function HomeScreen() {
  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.badge, { backgroundColor: c.primary }]}>
          <Text style={{ color: c.primaryForeground, fontSize: 12, fontWeight: "600" }}>
            @stack/ui · tokens
          </Text>
        </View>

        <Text style={[styles.title, { color: c.foreground }]}>One design system, on native.</Text>
        <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
          Every color below is imported from @stack/ui — the exact same tokens apps/web renders. No
          copy-paste, no drift.
        </Text>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.cardForeground }]}>Design tokens</Text>
          <View style={styles.swatchRow}>
            {Object.entries(tokens.colors.light).map(([name, value]) => (
              <View key={name} style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: value, borderColor: c.border }]} />
                <Text style={[styles.swatchLabel, { color: c.mutedForeground }]}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingTop: 72, gap: 16 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  card: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: "600" },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  swatchItem: { alignItems: "center", gap: 6, width: 64 },
  swatch: { width: 48, height: 48, borderRadius: 10, borderWidth: 1 },
  swatchLabel: { fontSize: 10, textAlign: "center" },
});
