import { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Platform } from "react-native";
import { Button } from "../ui/Button";
import { DatePicker } from "../ui/DatePicker";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api/client";
import { Download } from "lucide-react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

interface ExportSheetProps {
  onClose: () => void;
}

export function ExportSheet({ onClose }: ExportSheetProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  // Default range endpoints, computed once so render stays pure
  const [defaultFromDate] = useState(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const [defaultToDate] = useState(() => new Date());
  const [useRange, setUseRange] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (useRange && fromDate) params.set("from", fromDate.toISOString());
      if (useRange && toDate) params.set("to", toDate.toISOString());

      if (Platform.OS === "web") {
        // Web: fetch as blob and trigger download
        const res = await fetch(`/api/expenses/export?${params}`, { credentials: "include" });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `wohnly-expenses-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Native: download to temp file and share
        const csv = await api<string>(`/api/expenses/export?${params}`);
        const filename = `wohnly-expenses-${new Date().toISOString().split("T")[0]}.csv`;
        const fileUri = `${(FileSystem as any).cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, typeof csv === "string" ? csv : JSON.stringify(csv));

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: t("expenses.exportExpenses", "Export Expenses"),
          });
        }
      }

      onClose();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Download size={22} color={colors.primary} />
        <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
          {t("expenses.exportExpenses", "Export Expenses")}
        </Text>
      </View>

      {/* Date range toggle */}
      <View>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 8 }}>
          {t("expenses.exportDateRange", "Date Range")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setUseRange(false)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: !useRange ? colors.primary : colors.muted,
              alignItems: "center",
            }}
          >
            <Text style={{ color: !useRange ? colors.primaryForeground : colors.text, fontWeight: "600" }}>
              {t("expenses.exportAll", "All Time")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setUseRange(true)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: useRange ? colors.primary : colors.muted,
              alignItems: "center",
            }}
          >
            <Text style={{ color: useRange ? colors.primaryForeground : colors.text, fontWeight: "600" }}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {useRange && (
        <View style={{ gap: 12 }}>
          <DatePicker
            label={t("expenses.exportFrom", "From")}
            value={fromDate ?? defaultFromDate}
            onChange={setFromDate}
            mode="date"
          />
          <DatePicker
            label={t("expenses.exportTo", "To")}
            value={toDate ?? defaultToDate}
            onChange={setToDate}
            mode="date"
          />
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        <Button variant="ghost" onPress={onClose} style={{ flex: 1 }}>
          {t("common.cancel")}
        </Button>
        <Button onPress={handleExport} loading={loading} style={{ flex: 2 }}>
          {t("expenses.export", "Export")} CSV
        </Button>
      </View>
    </View>
  );
}
