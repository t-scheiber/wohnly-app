import { View, Text, TouchableOpacity, ScrollView, Share, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Calendar, Settings, HelpCircle, ChevronRight, Users, UserPlus } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useHouseholdMembers } from "@/lib/api/queries";

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  colors: (typeof Colors)["light"];
}

function MenuItem({ icon, label, sublabel, onPress, colors }: MenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{label}</Text>
        {sublabel && <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{sublabel}</Text>}
      </View>
      <ChevronRight size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { data: household } = useHousehold();
  const { data: membersData } = useHouseholdMembers();

  const handleShareInvite = async () => {
    if (!household?.inviteCode) return;
    const message = `${t("household.shareCode")} ${household.inviteCode}\n\nhttps://wohnly.app/join?code=${household.inviteCode}`;
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ text: message });
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          alert(t("common.copied") || "Invite link copied to clipboard!");
        }
      } else {
        await Share.share({ message });
      }
    } catch (_) {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView>
        {/* Header */}
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>{t("more.title")}</Text>
        </View>

        {/* Household Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, paddingHorizontal: 20, paddingBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("settings.household")}
          </Text>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 12, marginHorizontal: 16, overflow: "hidden" }}>
            <MenuItem
              icon={<Users size={20} color={colors.primary} />}
              label={t("household.members")}
              sublabel={membersData?.members ? `${membersData.members.length} ${t("household.members").toLowerCase()}` : undefined}
              onPress={() => router.push("/(app)/(more)/settings")}
              colors={colors}
            />
            <MenuItem
              icon={<UserPlus size={20} color={colors.success} />}
              label={t("household.inviteMembers")}
              onPress={handleShareInvite}
              colors={colors}
            />
          </View>
        </View>

        {/* Schedule section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, paddingHorizontal: 20, paddingBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("more.schedule")}
          </Text>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 12, marginHorizontal: 16, overflow: "hidden" }}>
            <MenuItem
              icon={<Calendar size={20} color={colors.primary} />}
              label={t("more.calendar")}
              sublabel={t("more.calendarSubtitle")}
              onPress={() => router.push("/(app)/(events)")}
              colors={colors}
            />
          </View>
        </View>

        {/* Settings section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, paddingHorizontal: 20, paddingBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("more.settings")}
          </Text>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 12, marginHorizontal: 16, overflow: "hidden" }}>
            <MenuItem
              icon={<Settings size={20} color={colors.textSecondary} />}
              label={t("more.settings")}
              sublabel={t("more.settingsSubtitle")}
              onPress={() => router.push("/(app)/(more)/settings")}
              colors={colors}
            />
            <MenuItem
              icon={<HelpCircle size={20} color={colors.primary} />}
              label={t("help.helpAndTips")}
              sublabel={t("help.helpSubtitle")}
              onPress={() => router.push("/(app)/(more)/help" as any)}
              colors={colors}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

