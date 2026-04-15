import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Pressable,
  TextInput,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Smartphone,
  Monitor,
  Globe,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react-native";
import { useMyDevices, useRenameDevice, useRemoveDevice } from "@/lib/api/queries";
import { useTheme } from "@/lib/hooks/useTheme";
import { Colors } from "@/constants/Colors";

function deviceIcon(name: string | null, color: string) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("ios") || n.includes("iphone") || n.includes("ipad") || n.includes("android"))
    return <Smartphone size={20} color={color} />;
  if (n.includes("web")) return <Globe size={20} color={color} />;
  return <Monitor size={20} color={color} />;
}

function statusBadge(
  status: string,
  colors: (typeof Colors)["light"],
  t: (key: string) => string
) {
  switch (status) {
    case "approved":
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <ShieldCheck size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>
            {t("devices.approved")}
          </Text>
        </View>
      );
    case "pending":
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Shield size={14} color="#f59e0b" />
          <Text style={{ fontSize: 12, color: "#f59e0b", fontWeight: "600" }}>
            {t("devices.pending")}
          </Text>
        </View>
      );
    case "rejected":
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <ShieldAlert size={14} color={colors.destructive} />
          <Text style={{ fontSize: 12, color: colors.destructive, fontWeight: "600" }}>
            {t("devices.rejected")}
          </Text>
        </View>
      );
    default:
      return null;
  }
}

export default function DevicesScreen() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { data, isLoading } = useMyDevices();
  const renameDevice = useRenameDevice();
  const removeDevice = useRemoveDevice();

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameDeviceId, setRenameDeviceId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const handleRename = (deviceId: string, currentName: string) => {
    setRenameDeviceId(deviceId);
    setRenameValue(currentName);
    setRenameModalOpen(true);
  };

  const handleSaveRename = () => {
    if (!renameValue.trim()) return;
    renameDevice.mutate(
      { deviceId: renameDeviceId, name: renameValue.trim() },
      { onSuccess: () => setRenameModalOpen(false) }
    );
  };

  const handleRemove = (deviceId: string, deviceName: string) => {
    const message = t("devices.removeConfirm", { name: deviceName });
    if (Platform.OS === "web") {
      if (confirm(message)) {
        removeDevice.mutate(deviceId);
      }
      return;
    }
    Alert.alert(t("devices.removeDevice"), message, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => removeDevice.mutate(deviceId),
      },
    ]);
  };

  const devices = data?.devices ?? [];

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        <Text
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 16,
            lineHeight: 20,
          }}
        >
          {t("devices.description")}
        </Text>

        {isLoading ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary }}>{t("common.loading")}</Text>
          </View>
        ) : devices.length === 0 ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary }}>{t("devices.noDevices")}</Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {devices.map((device, i) => (
              <View
                key={device.id}
                style={{
                  padding: 16,
                  borderBottomWidth: i < devices.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                    }}
                  >
                    {deviceIcon(device.name, colors.primary)}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: colors.text,
                        }}
                      >
                        {device.name || t("devices.unnamed")}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                        {statusBadge(device.status, colors, t)}
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                          {new Date(device.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleRename(device.id, device.name ?? "")}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: colors.background,
                      }}
                    >
                      <Pencil size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemove(device.id, device.name ?? t("devices.unnamed"))}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: colors.background,
                      }}
                    >
                      <Trash2 size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 24, padding: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <ShieldCheck size={16} color={colors.primary} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
              {t("devices.e2eeInfo")}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
            {t("devices.e2eeDescription")}
          </Text>
        </View>
      </ScrollView>

      {/* Rename Modal */}
      <Modal
        visible={renameModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalOpen(false)}
      >
        <Pressable
          onPress={() => setRenameModalOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              width: "85%",
              maxWidth: 360,
              padding: 20,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 16,
              }}
            >
              {t("devices.renameDevice")}
            </Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder={t("devices.deviceNamePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoFocus
              style={{
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 14,
                fontSize: 16,
                color: colors.text,
                marginBottom: 16,
              }}
              onSubmitEditing={handleSaveRename}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setRenameModalOpen(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center" as const,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveRename}
                disabled={renameDevice.isPending || !renameValue.trim()}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: "center" as const,
                  opacity:
                    renameDevice.isPending || !renameValue.trim() ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {t("common.save")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
