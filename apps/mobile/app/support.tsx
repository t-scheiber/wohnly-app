import { View, Text, ScrollView, Platform, useWindowDimensions, Linking, TouchableOpacity } from "react-native";
import { Stack, Link } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

const SUPPORT_EMAIL = "support@wohnly.app";

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: typeof Colors.light }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children, colors }: { children: React.ReactNode; colors: typeof Colors.light }) {
  return (
    <Text style={{ fontSize: 15, lineHeight: 24, color: colors.textSecondary, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

function Bullet({ children, colors }: { children: string; colors: typeof Colors.light }) {
  return (
    <View style={{ flexDirection: "row", paddingLeft: 12, marginBottom: 4 }}>
      <Text style={{ fontSize: 15, color: colors.textSecondary, marginRight: 8 }}>{"\u2022"}</Text>
      <Text style={{ fontSize: 15, lineHeight: 24, color: colors.textSecondary, flex: 1 }}>{children}</Text>
    </View>
  );
}

export default function SupportScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width > 720;

  return (
    <>
      <Stack.Screen options={{ title: "Support", headerShown: Platform.OS !== "web" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 24,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
          ...(isWide ? { paddingVertical: 48 } : {}),
        }}
      >
        {Platform.OS === "web" && (
          <Link href="/" style={{ color: colors.primary, fontSize: 15, marginBottom: 24 }}>
            &larr; Back to Wohnly
          </Link>
        )}

        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: 4 }}>
          Support
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 32 }}>
          We&apos;re here to help
        </Text>

        <Section title="Getting Started" colors={colors}>
          <Paragraph colors={colors}>
            Wohnly is a household management app that helps roommates and families coordinate
            shared expenses, chores, shopping lists, calendars, and tasks. Create or join a
            household, invite your members, and start collaborating.
          </Paragraph>
        </Section>

        <Section title="Frequently Asked Questions" colors={colors}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 8 }}>
            How do I create a household?
          </Text>
          <Paragraph colors={colors}>
            After signing in, tap &ldquo;Create Household&rdquo; on the dashboard. Give your household a
            name and invite members by sharing the invite link from Settings.
          </Paragraph>

          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 16 }}>
            How do I invite members?
          </Text>
          <Paragraph colors={colors}>
            Go to Settings and tap &ldquo;Invite Members&rdquo;. Share the generated invite link with your
            household members via any messaging app.
          </Paragraph>

          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 16 }}>
            Is my data secure?
          </Text>
          <Paragraph colors={colors}>
            Yes. Wohnly uses end-to-end encryption (E2EE) for sensitive household data. Your
            encrypted data cannot be read by our servers. All communication uses HTTPS/TLS encryption.
          </Paragraph>

          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 16 }}>
            How do I manage subscriptions?
          </Text>
          <Paragraph colors={colors}>
            You can manage your Wohnly Pro subscription from Settings. On iOS, subscriptions are
            managed through the App Store. On Android, through Google Play.
          </Paragraph>

          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 16 }}>
            How do I delete my account?
          </Text>
          <Paragraph colors={colors}>
            Go to Settings and scroll to the bottom to find &ldquo;Delete Account&rdquo;. This will
            permanently remove your account and all personal data from our systems.
          </Paragraph>
        </Section>

        <Section title="Troubleshooting" colors={colors}>
          <Bullet colors={colors}>If the app is not loading, check your internet connection and try restarting the app.</Bullet>
          <Bullet colors={colors}>If you cannot sign in, try resetting your password or using a different sign-in method (Google or Apple).</Bullet>
          <Bullet colors={colors}>If notifications are not working, check that notifications are enabled in your device settings.</Bullet>
          <Bullet colors={colors}>If expense calculations seem incorrect, make sure all members have the correct currency set in Settings.</Bullet>
        </Section>

        <Section title="Contact Us" colors={colors}>
          <Paragraph colors={colors}>
            If you need further assistance, please reach out to us:
          </Paragraph>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Text style={{ fontSize: 16, color: colors.primary, marginBottom: 8 }}>
              {SUPPORT_EMAIL}
            </Text>
          </TouchableOpacity>
          <Paragraph colors={colors}>
            We aim to respond to all inquiries within 48 hours.
          </Paragraph>
        </Section>

        <Section title="App Information" colors={colors}>
          <Paragraph colors={colors}>
            Wohnly is available on iOS, Android, Windows, macOS, and the web.
          </Paragraph>
          <Paragraph colors={colors}>
            Developer: Thomas Scheiber
          </Paragraph>
        </Section>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 48 }}>
          <Link href="/privacy-policy" style={{ color: colors.primary, fontSize: 15 }}>
            Privacy Policy
          </Link>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
            {"\u2022"}
          </Text>
          <Link href={"/terms-of-service" as any} style={{ color: colors.primary, fontSize: 15 }}>
            Terms of Service
          </Link>
        </View>
      </ScrollView>
    </>
  );
}
