import { View, Text, ScrollView, Platform, useWindowDimensions } from "react-native";
import { Stack, Link } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

const EFFECTIVE_DATE = "2026-03-23";
const CONTACT_EMAIL = "privacy@wohnly.app";

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

export default function PrivacyPolicyScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width > 720;

  return (
    <>
      <Stack.Screen options={{ title: "Privacy Policy", headerShown: Platform.OS !== "web" }} />
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
          Privacy Policy
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 32 }}>
          Effective date: {EFFECTIVE_DATE}
        </Text>

        <Paragraph colors={colors}>
          Wohnly (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a household management application that helps
          roommates and families coordinate shared expenses, chores, events, and tasks.
          This Privacy Policy explains how we collect, use, and protect your personal
          information when you use the Wohnly mobile app and website (collectively, the &ldquo;Service&rdquo;).
        </Paragraph>

        <Section title="1. Information We Collect" colors={colors}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 8 }}>
            Account Information
          </Text>
          <Bullet colors={colors}>Name and email address</Bullet>
          <Bullet colors={colors}>Profile picture (optional)</Bullet>
          <Bullet colors={colors}>Language and theme preferences</Bullet>
          <Bullet colors={colors}>Authentication data (password hash, or OAuth tokens from Google/Apple Sign-In)</Bullet>

          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 16 }}>
            Household Data
          </Text>
          <Bullet colors={colors}>Household name and membership information</Bullet>
          <Bullet colors={colors}>Todos, shopping lists, and chore assignments</Bullet>
          <Bullet colors={colors}>Shared expenses, subscription tracking, and balance calculations</Bullet>
          <Bullet colors={colors}>Calendar events (titles, dates, locations, attendees)</Bullet>

          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 16 }}>
            Device & Technical Data
          </Text>
          <Bullet colors={colors}>Device identifiers and push notification tokens</Bullet>
          <Bullet colors={colors}>IP address and user agent (stored with sessions for security)</Bullet>
          <Bullet colors={colors}>Platform information (iOS, Android, or web)</Bullet>
        </Section>

        <Section title="2. How We Use Your Information" colors={colors}>
          <Paragraph colors={colors}>We use your information to:</Paragraph>
          <Bullet colors={colors}>Provide and operate the Service (syncing household data across members)</Bullet>
          <Bullet colors={colors}>Authenticate your identity and secure your account</Bullet>
          <Bullet colors={colors}>Send push notifications for chore reminders, expense alerts, and event updates</Bullet>
          <Bullet colors={colors}>Calculate and display expense balances between household members</Bullet>
          <Bullet colors={colors}>Sync events with your device calendar (when you grant permission)</Bullet>
          <Bullet colors={colors}>Process in-app purchases and manage your subscription status</Bullet>
        </Section>

        <Section title="3. Data Sharing" colors={colors}>
          <Paragraph colors={colors}>
            Your household data is shared with other members of your household — this is
            core to how Wohnly works. Outside of your household, we do not sell, rent, or
            share your personal data with third parties, except:
          </Paragraph>
          <Bullet colors={colors}>RevenueCat — processes in-app subscription purchases (receives your anonymous user ID only)</Bullet>
          <Bullet colors={colors}>Apple / Google — process payments for subscriptions through their respective app stores</Bullet>
          <Bullet colors={colors}>Expo (Push Notifications) — delivers push notifications to your device using your device token</Bullet>
          <Bullet colors={colors}>When required by law or to protect the safety of our users</Bullet>
        </Section>

        <Section title="4. Data Security" colors={colors}>
          <Paragraph colors={colors}>
            We take the security of your data seriously. All communication between the app
            and our servers uses HTTPS/TLS encryption. Passwords are securely hashed and never
            stored in plain text. Session tokens are used for authentication and expire automatically.
          </Paragraph>
          <Paragraph colors={colors}>
            Wohnly supports end-to-end encryption (E2EE) for sensitive household data using
            X25519 key exchange and sealed cryptographic envelopes. When E2EE is enabled, your
            encrypted data cannot be read by our servers.
          </Paragraph>
          <Paragraph colors={colors}>
            New devices are approved by another of your own devices using a 6-digit code that
            you compare between screens. New household members are approved by a household
            owner (also with a 6-digit code), unless they sign in with a pre-authorised email
            from the invitation, in which case they join immediately. When a member leaves or
            is removed, Wohnly rotates the household&apos;s encryption key so any new content
            is protected from them. Content they already viewed on their device cannot be
            revoked — that&apos;s a limit of end-to-end encryption, not a choice we made.
          </Paragraph>
        </Section>

        <Section title="5. Calendar & Device Permissions" colors={colors}>
          <Paragraph colors={colors}>
            Wohnly requests access to your device calendar only when you choose to sync
            household events. This permission is optional. We read and write calendar events
            solely for the purpose of keeping your household schedule in sync. We do not
            access other calendar data unrelated to Wohnly.
          </Paragraph>
        </Section>

        <Section title="6. Data Retention" colors={colors}>
          <Paragraph colors={colors}>
            We retain your account data for as long as your account is active. When you leave a
            household, your membership data for that household is deleted. If you delete your
            account, all personal data is permanently removed from our systems. Household data
            you contributed (e.g. shared expenses) may be retained in anonymized form for the
            remaining household members.
          </Paragraph>
        </Section>

        <Section title="7. Your Rights" colors={colors}>
          <Paragraph colors={colors}>You have the right to:</Paragraph>
          <Bullet colors={colors}>Access the personal data we hold about you</Bullet>
          <Bullet colors={colors}>Correct inaccurate personal data</Bullet>
          <Bullet colors={colors}>Request deletion of your account and personal data</Bullet>
          <Bullet colors={colors}>Export your data in a portable format</Bullet>
          <Bullet colors={colors}>Withdraw consent for optional data processing (e.g. push notifications, calendar sync)</Bullet>
          <Paragraph colors={colors}>
            If you are located in the European Economic Area (EEA), you have additional rights
            under the General Data Protection Regulation (GDPR), including the right to lodge a
            complaint with your local data protection authority.
          </Paragraph>
        </Section>

        <Section title="8. Children's Privacy" colors={colors}>
          <Paragraph colors={colors}>
            Wohnly is not directed at children under the age of 16. We do not knowingly collect
            personal information from children. If you believe a child has provided us with
            personal data, please contact us and we will promptly delete it.
          </Paragraph>
        </Section>

        <Section title="9. Changes to This Policy" colors={colors}>
          <Paragraph colors={colors}>
            We may update this Privacy Policy from time to time. We will notify you of
            significant changes through the app or by email. Continued use of the Service
            after changes constitutes acceptance of the updated policy.
          </Paragraph>
        </Section>

        <Section title="10. Contact Us" colors={colors}>
          <Paragraph colors={colors}>
            If you have questions about this Privacy Policy or your personal data, contact us at:{"\n"}
            {CONTACT_EMAIL}
          </Paragraph>
        </Section>

        <View style={{ height: 48 }} />
      </ScrollView>
    </>
  );
}
