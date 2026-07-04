import { View, Text, ScrollView, Platform, useWindowDimensions, Linking, TouchableOpacity } from "react-native";
import { Stack, Link } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

const EFFECTIVE_DATE = "2026-05-19";
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

export default function TermsOfServiceScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width > 720;

  return (
    <>
      <Stack.Screen options={{ title: "Terms of Service", headerShown: Platform.OS !== "web" }} />
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
          Terms of Service
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 32 }}>
          Effective date: {EFFECTIVE_DATE}
        </Text>

        <Paragraph colors={colors}>
          These Terms of Service govern your use of Wohnly, a household management
          app for coordinating shared expenses, chores, shopping lists, calendars,
          todos, and subscriptions. By using Wohnly, you agree to these terms.
        </Paragraph>

        <Section title="1. Who May Use Wohnly" colors={colors}>
          <Paragraph colors={colors}>
            You must be at least 16 years old to use Wohnly. You are responsible for
            keeping your account secure and for all activity that happens through
            your account.
          </Paragraph>
        </Section>

        <Section title="2. Household Content" colors={colors}>
          <Paragraph colors={colors}>
            Wohnly lets you create and share household data with other members of
            your household. You keep ownership of the content you add, but you allow
            us to process it so we can provide the service.
          </Paragraph>
          <Bullet colors={colors}>Only add content that you have the right to share.</Bullet>
          <Bullet colors={colors}>Household members may see content shared inside their household.</Bullet>
          <Bullet colors={colors}>If you leave a household, content already seen by other members may remain available to them.</Bullet>
        </Section>

        <Section title="3. Acceptable Use" colors={colors}>
          <Paragraph colors={colors}>
            Please use Wohnly lawfully and respectfully. You may not misuse the app,
            interfere with its operation, attempt unauthorized access, or use it to
            store or distribute harmful, illegal, or abusive content.
          </Paragraph>
        </Section>

        <Section title="4. Privacy and Security" colors={colors}>
          <Paragraph colors={colors}>
            Our Privacy Policy explains how we collect, use, and protect personal
            data. Wohnly uses HTTPS/TLS for communication and supports end-to-end
            encryption for sensitive household data.
          </Paragraph>
          <Link href="/privacy-policy" style={{ color: colors.primary, fontSize: 15 }}>
            Read the Privacy Policy
          </Link>
        </Section>

        <Section title="5. Subscriptions and Payments" colors={colors}>
          <Paragraph colors={colors}>
            Wohnly may offer paid features through Wohnly Pro. Native app purchases
            are handled by Apple App Store or Google Play. Web and desktop purchases
            may be handled by Stripe. Prices, taxes, renewals, refunds, and payment
            management are subject to the payment provider&apos;s terms.
          </Paragraph>
        </Section>

        <Section title="6. Ads" colors={colors}>
          <Paragraph colors={colors}>
            Free versions of Wohnly may show advertising. Paid or premium users may
            receive an ad-free experience depending on the plan and platform.
          </Paragraph>
        </Section>

        <Section title="7. Availability and Changes" colors={colors}>
          <Paragraph colors={colors}>
            We work to keep Wohnly available and reliable, but we cannot guarantee
            uninterrupted service. We may change, suspend, or discontinue features
            when needed to improve the app, maintain security, or comply with law.
          </Paragraph>
        </Section>

        <Section title="8. Limitation of Liability" colors={colors}>
          <Paragraph colors={colors}>
            Wohnly is provided as-is. To the fullest extent permitted by law, we are
            not liable for indirect, incidental, special, consequential, or punitive
            damages arising from your use of the service.
          </Paragraph>
        </Section>

        <Section title="9. Contact" colors={colors}>
          <Paragraph colors={colors}>
            If you have questions about these terms, contact us at:
          </Paragraph>
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            accessibilityRole="link"
            accessibilityLabel={`Email ${SUPPORT_EMAIL}`}
          >
            <Text style={{ fontSize: 16, color: colors.primary, marginBottom: 8 }}>
              {SUPPORT_EMAIL}
            </Text>
          </TouchableOpacity>
        </Section>

        <View style={{ height: 48 }} />
      </ScrollView>
    </>
  );
}
