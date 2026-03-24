import { useState } from "react";
import { View, Text, TouchableOpacity, Platform, Modal, Pressable } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
  const { i18n } = useTranslation();
  const locale = i18n.language === "de" ? de : enUS;

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
    if (!value) return placeholder ?? "Select date";
    if (mode === "datetime") {
      return format(value, "PPP p", { locale });
    }
    return format(value, "PPP", { locale });
  };

  const pickerMode = mode === "datetime" ? "datetime" : "date";

  return (
    <View style={{ marginBottom: 12 }}>
      {label && (
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => setShow(true)}
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 14,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, color: value ? colors.text : colors.textSecondary }}>
          {formatValue()}
        </Text>
        {optional && value && onClear && (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Clear</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

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
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <Pressable
            onPress={() => setShow(false)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 40,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 16 }}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Done</Text>
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
