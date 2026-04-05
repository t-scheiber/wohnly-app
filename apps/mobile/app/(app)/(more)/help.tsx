import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Linking, Platform, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Home,
  ListTodo,
  ShoppingCart,
  CheckSquare,
  CalendarDays,
  Wallet,
  Users,
  Lock,
  Mail,
  Repeat,
} from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

// ── Accordion Section ──

function AccordionSection({
  icon,
  title,
  children,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  colors: (typeof Colors)["light"];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.6}
        style={styles.sectionHeader}
      >
        <View style={[styles.iconWrapper, { backgroundColor: colors.muted }]}>
          {icon}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {expanded ? (
          <ChevronDown size={20} color={colors.textSecondary} />
        ) : (
          <ChevronRight size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
      {expanded && (
        <View style={[styles.sectionBody, { borderTopColor: colors.border }]}>
          {children}
        </View>
      )}
    </View>
  );
}

function HelpText({ text, colors }: { text: string; colors: (typeof Colors)["light"] }) {
  return <Text style={[styles.helpText, { color: colors.textSecondary }]}>{text}</Text>;
}

function HelpBullet({ text, colors }: { text: string; colors: (typeof Colors)["light"] }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bullet, { color: colors.primary }]}>{"\u2022"}</Text>
      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

// ── Help Screen ──

export default function HelpScreen() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const isMobile = Platform.OS !== "web";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Getting Started */}
      <AccordionSection
        icon={<Home size={18} color={colors.primary} />}
        title={t("help.gettingStarted")}
        colors={colors}
      >
        <HelpText text={t("help.gettingStartedDesc")} colors={colors} />
        <HelpBullet text={t("help.createHousehold")} colors={colors} />
        <HelpBullet text={t("help.joinHousehold")} colors={colors} />
        <HelpBullet text={t("help.inviteAfterCreate")} colors={colors} />
      </AccordionSection>

      {/* Managing Lists */}
      <AccordionSection
        icon={<ListTodo size={18} color={colors.primary} />}
        title={t("help.managingLists")}
        colors={colors}
      >
        <HelpText text={t("help.managingListsDesc")} colors={colors} />
        <HelpBullet text={t("help.addItems")} colors={colors} />
        <HelpBullet
          text={isMobile ? t("help.editItemsMobile") : t("help.editItemsWeb")}
          colors={colors}
        />
        <HelpBullet
          text={isMobile ? t("help.deleteItemsMobile") : t("help.deleteItemsWeb")}
          colors={colors}
        />
        <HelpBullet text={t("help.realTimeSync")} colors={colors} />
      </AccordionSection>

      {/* Shopping List */}
      <AccordionSection
        icon={<ShoppingCart size={18} color={colors.primary} />}
        title={t("help.shoppingList")}
        colors={colors}
      >
        <HelpText text={t("help.shoppingListDesc")} colors={colors} />
        <HelpBullet text={t("help.checkOff")} colors={colors} />
        <HelpBullet text={t("help.clearCompleted")} colors={colors} />
        <HelpBullet text={t("help.shoppingCategories")} colors={colors} />
      </AccordionSection>

      {/* Todos */}
      <AccordionSection
        icon={<CheckSquare size={18} color={colors.primary} />}
        title={t("help.todos")}
        colors={colors}
      >
        <HelpText text={t("help.todosDesc")} colors={colors} />
        <HelpBullet text={t("help.todoDueDates")} colors={colors} />
        <HelpBullet text={t("help.todoPersonal")} colors={colors} />
        <HelpBullet text={t("help.todoComplete")} colors={colors} />
      </AccordionSection>

      {/* Chores */}
      <AccordionSection
        icon={<Repeat size={18} color={colors.primary} />}
        title={t("help.chores")}
        colors={colors}
      >
        <HelpText text={t("help.choresDesc")} colors={colors} />
        <HelpBullet text={t("help.choreSchedule")} colors={colors} />
        <HelpBullet text={t("help.choreRotation")} colors={colors} />
        <HelpBullet text={t("help.choreDone")} colors={colors} />
      </AccordionSection>

      {/* Calendar */}
      <AccordionSection
        icon={<CalendarDays size={18} color={colors.primary} />}
        title={t("help.calendar")}
        colors={colors}
      >
        <HelpText text={t("help.calendarDesc")} colors={colors} />
        <HelpBullet text={t("help.calendarEvents")} colors={colors} />
        <HelpBullet text={t("help.calendarFilters")} colors={colors} />
      </AccordionSection>

      {/* Finances */}
      <AccordionSection
        icon={<Wallet size={18} color={colors.primary} />}
        title={t("help.finances")}
        colors={colors}
      >
        <HelpText text={t("help.financesDesc")} colors={colors} />
        <HelpBullet text={t("help.expenses")} colors={colors} />
        <HelpBullet text={t("help.subscriptions")} colors={colors} />
        <HelpBullet text={t("help.splits")} colors={colors} />
      </AccordionSection>

      {/* Inviting Members */}
      <AccordionSection
        icon={<Users size={18} color={colors.primary} />}
        title={t("help.invitingMembers")}
        colors={colors}
      >
        <HelpText text={t("help.invitingMembersDesc")} colors={colors} />
        <HelpBullet text={t("help.shareCode")} colors={colors} />
        <HelpBullet text={t("help.shareLink")} colors={colors} />
      </AccordionSection>

      {/* Encryption */}
      <AccordionSection
        icon={<Lock size={18} color={colors.primary} />}
        title={t("help.encryption")}
        colors={colors}
      >
        <HelpText text={t("help.encryptionDesc")} colors={colors} />
        <HelpBullet text={t("help.e2ee")} colors={colors} />
        <HelpBullet text={t("help.deviceApproval")} colors={colors} />
      </AccordionSection>

      {/* Contact Support */}
      <TouchableOpacity
        onPress={() => Linking.openURL("mailto:support@wohnly.app")}
        activeOpacity={0.6}
        style={[styles.supportButton, { backgroundColor: colors.primary }]}
      >
        <Mail size={18} color={colors.primaryForeground} />
        <Text style={[styles.supportText, { color: colors.primaryForeground }]}>
          {t("help.contactSupport")}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingHorizontal: 16,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 14,
    marginRight: 8,
    lineHeight: 21,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  supportText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
