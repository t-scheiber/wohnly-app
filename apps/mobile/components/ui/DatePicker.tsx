import { useState } from "react";
import { View, Text, TouchableOpacity, Platform, Modal, Pressable } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useReducedMotion } from "@/lib/hooks/useA11yPreferences";
import { useTranslation } from "react-i18next";

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  mode?: "date" | "datetime";
  label?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  optional?: boolean;
  onClear?: () => void;
}

export function DatePicker({
  value,
  onChange,
  mode = "date",
  label,
  placeholder,
  minimumDate,
  maximumDate,
  optional,
  onClear,
}: DatePickerProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? de : enUS;
  const reducedMotion = useReducedMotion();

  const [show, setShow] = useState(false);

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShow(false);
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const formatValue = () => {
    if (!value) return placeholder ?? t("common.selectDate", "Select date");
    if (mode === "datetime") {
      return format(value, "PPP p", { locale });
    }
    return format(value, "PPP", { locale });
  };

  const pickerMode = mode === "datetime" ? "datetime" : "date";

  return (
    <View style={{ marginBottom: 12 }}>
      {label && (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 10,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => setShow(true)}
          accessibilityRole="button"
          accessibilityLabel={label ?? t("common.selectDate", "Select date")}
          accessibilityValue={value ? { text: formatValue() } : undefined}
          accessibilityHint={t("common.selectDateHint", "Opens a date picker")}
          style={{
            flex: 1,
            padding: 14,
            minHeight: 44,
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 16, color: value ? colors.text : colors.textSecondary }}>
            {formatValue()}
          </Text>
        </TouchableOpacity>
        {optional && value && onClear && (
          <TouchableOpacity
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.clearDate", "Clear date")}
            style={{ paddingHorizontal: 14, minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              {t("common.clear", "Clear")}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {show && Platform.OS === "android" && (
        <DateTimePicker
          value={value ?? new Date()}
          mode={pickerMode}
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          themeVariant={colorScheme}
        />
      )}

      {show && Platform.OS === "ios" && (
        <Modal
          transparent
          animationType={reducedMotion ? "none" : "fade"}
          onRequestClose={() => setShow(false)}
        >
          <Pressable
            onPress={() => setShow(false)}
            accessibilityRole="button"
            accessibilityLabel={t("common.close", "Close")}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          >
            <Pressable
              onPress={() => {}}
              accessibilityRole="none"
              accessibilityViewIsModal
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 40,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 16 }}>
                <TouchableOpacity
                  onPress={() => setShow(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.done", "Done")}
                  style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>
                    {t("common.done", "Done")}
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={value ?? new Date()}
                mode={pickerMode}
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                themeVariant={colorScheme}
                style={{ height: 200 }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {show && Platform.OS === "web" && (
        <DateTimePicker
          value={value ?? new Date()}
          mode={pickerMode}
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}
