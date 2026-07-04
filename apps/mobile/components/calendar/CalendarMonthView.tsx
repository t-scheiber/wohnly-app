import React, { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
  type Locale,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";

export interface DayMarkers {
  events?: boolean;
  chores?: boolean;
  subscriptions?: boolean;
  device?: boolean;
}

interface CalendarMonthViewProps {
  currentMonth: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onChangeMonth: (date: Date) => void;
  markedDates: Record<string, DayMarkers>;
}

const DayCell = memo(function DayCell({
  date,
  isCurrentMonth,
  isSelected,
  isCurrentDay,
  markers,
  onPress,
  colors,
  locale,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isCurrentDay: boolean;
  markers?: DayMarkers;
  onPress: () => void;
  colors: (typeof Colors)["light"];
  locale: Locale;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={format(date, "PPPP", { locale })}
      accessibilityState={{ selected: isSelected }}
      style={{
        flex: 1,
        aspectRatio: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        backgroundColor: isSelected ? colors.primary : "transparent",
        borderWidth: isCurrentDay && !isSelected ? 1.5 : 0,
        borderColor: colors.primary,
        margin: 2,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: isCurrentDay || isSelected ? "700" : "400",
          color: isSelected
            ? colors.primaryForeground
            : isCurrentMonth
              ? colors.text
              : colors.textSecondary + "40",
        }}
      >
        {format(date, "d")}
      </Text>
      {/* Dot indicators */}
      {markers && (
        <View style={{ flexDirection: "row", gap: 3, marginTop: 2, height: 5 }}>
          {markers.events && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.calendarEvent }} />}
          {markers.chores && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.calendarChore }} />}
          {markers.subscriptions && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.calendarSubscription }} />}
          {markers.device && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.calendarDevice }} />}
        </View>
      )}
    </TouchableOpacity>
  );
});

export function CalendarMonthView({
  currentMonth,
  selectedDate,
  onSelectDate,
  onChangeMonth,
  markedDates,
}: CalendarMonthViewProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? de : enUS;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build rows of 7 days
  const rows: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    rows.push(week);
  }

  // Day of week headers
  const dayHeaders: string[] = [];
  for (let i = 0; i < 7; i++) {
    dayHeaders.push(format(addDays(calStart, i), "EEE", { locale }).slice(0, 2));
  }

  return (
    <View style={{ paddingHorizontal: 12 }}>
      {/* Month header with navigation */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 }}>
        <TouchableOpacity
          onPress={() => onChangeMonth(subMonths(currentMonth, 1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("calendar.previousMonth", "Previous month")}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 18, fontWeight: "700", color: colors.text }}
        >
          {format(currentMonth, "MMMM yyyy", { locale })}
        </Text>
        <TouchableOpacity
          onPress={() => onChangeMonth(addMonths(currentMonth, 1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("calendar.nextMonth", "Next month")}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronRight size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {dayHeaders.map((h, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase" }}>
              {h}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {rows.map((week, wi) => (
        <View key={wi} style={{ flexDirection: "row" }}>
          {week.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            return (
              <DayCell
                key={key}
                date={d}
                isCurrentMonth={isSameMonth(d, currentMonth)}
                isSelected={isSameDay(d, selectedDate)}
                isCurrentDay={isToday(d)}
                markers={markedDates[key]}
                onPress={() => onSelectDate(d)}
                colors={colors}
                locale={locale}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
