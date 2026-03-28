import { View, Text, ScrollView } from "react-native";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";

export type CalendarItemType = "event" | "chore" | "subscription" | "device";

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  subtitle?: string;
  time?: string;
  allDay?: boolean;
  color?: string;
  done?: boolean;
}

interface CalendarDayAgendaProps {
  date: Date;
  items: CalendarItem[];
}

const TYPE_LABELS: Record<CalendarItemType, { en: string; de: string }> = {
  event: { en: "Event", de: "Termin" },
  chore: { en: "Chore", de: "Aufgabe" },
  subscription: { en: "Bill", de: "Rechnung" },
  device: { en: "Calendar", de: "Kalender" },
};

export function CalendarDayAgenda({ date, items }: CalendarDayAgendaProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? de : enUS;

  const colorForType = (type: CalendarItemType): string => {
    switch (type) {
      case "event": return colors.calendarEvent;
      case "chore": return colors.calendarChore;
      case "subscription": return colors.calendarSubscription;
      case "device": return colors.calendarDevice;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary, paddingHorizontal: 16, paddingVertical: 10 }}>
        {format(date, "EEEE, d MMMM", { locale })}
      </Text>

      {items.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <Text style={{ fontSize: 15, color: colors.textSecondary }}>{t("events.noEventsOnDay")}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          {items.map((item) => (
            <View
              key={`${item.type}-${item.id}`}
              style={{
                backgroundColor: colors.card,
                borderRadius: 10,
                padding: 14,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderLeftWidth: 4,
                borderLeftColor: item.done ? colors.success : (item.color || colorForType(item.type)),
                opacity: item.done ? 0.7 : 1,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: item.done ? colors.textSecondary : colors.text,
                  flex: 1,
                  textDecorationLine: item.done ? "line-through" : "none",
                }}>
                  {item.done ? "✓ " : ""}{item.title}
                </Text>
                <View style={{
                  backgroundColor: item.done ? colors.success + "20" : colorForType(item.type) + "20",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: item.done ? colors.success : colorForType(item.type) }}>
                    {item.done ? (i18n.language === "de" ? "Erledigt" : "Done") : (TYPE_LABELS[item.type][i18n.language as "en" | "de"] ?? TYPE_LABELS[item.type].en)}
                  </Text>
                </View>
              </View>
              {(item.time || item.subtitle) && (
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  {item.allDay ? (i18n.language === "de" ? "Ganztägig" : "All day") : item.time}
                  {item.subtitle ? (item.time ? ` · ${item.subtitle}` : item.subtitle) : ""}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
