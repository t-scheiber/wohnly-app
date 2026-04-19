import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Smartphone, Monitor, Globe } from "lucide-react-native";
import {
  useHouseholdDevicesNew,
  useRemoveHouseholdDevice,
} from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";
import type { AccessMember } from "./AccessPeopleList";

function deviceIcon(name: string | null | undefined, color: string) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("iphone") || n.includes("ios") || n.includes("android") || n.includes("mobile")) {
    return <Smartphone size={18} color={color} />;
  }
  if (n.includes("macos") || n.includes("windows") || n.includes("desktop") || n.includes("linux")) {
    return <Monitor size={18} color={color} />;
  }
  return <Globe size={18} color={color} />;
}

export function AccessDevicesList({
  householdId,
  members,
}: {
  householdId: string;
  members: AccessMember[];
}) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const devices = useHouseholdDevicesNew(householdId);
  const remove = useRemoveHouseholdDevice();

  const ownerByUserId = new Map(
    members.map((m) => [m.userId, m.nickname || m.displayName || m.email || "—"]),
  );

  if (!devices.data || devices.data.devices.length === 0) return null;

  const confirmRemove = (deviceId: string, deviceName: string) => {
    const doRemove = () => remove.mutate({ householdId, deviceId });
    if (Platform.OS === "web") {
      const ok =
        typeof confirm === "function"
          ? confirm(t("access.screen.removeDeviceConfirm") + "\n\n" + deviceName)
          : true;
      if (ok) doRemove();
      return;
    }
    Alert.alert(
      deviceName,
      t("access.screen.removeDeviceConfirm"),
      [
        { text: t("access.screen.cancel"), style: "cancel" },
        { text: t("access.screen.remove"), style: "destructive", onPress: doRemove },
      ],
    );
  };

  return (
    <View>
      <Text style={[styles.section, { color: colors.textSecondary }]}>
        {t("access.screen.devices")}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {devices.data.devices.map((d, i) => {
          const isLast = i === devices.data!.devices.length - 1;
          const label = d.name ?? "—";
          const owner = ownerByUserId.get(d.userId) ?? "—";
          return (
            <Pressable
              key={d.id}
              onLongPress={() => confirmRemove(d.id, label)}
              style={[
                styles.row,
                !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              {deviceIcon(d.name, colors.textSecondary)}
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>{owner}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  name: { fontSize: 15, fontWeight: "500" },
  sub: { fontSize: 12, marginTop: 2 },
});
