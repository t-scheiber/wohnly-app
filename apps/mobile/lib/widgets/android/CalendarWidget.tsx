import React from "react";
import {
  FlexWidget,
  TextWidget,
  ListWidget,
} from "react-native-android-widget";

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
}

interface WidgetStrings {
  calendarTitle: string;
  calendarEmpty: string;
}

interface Props {
  events: CalendarEvent[];
  strings: WidgetStrings;
}

const TEAL = "#6db5a8";

export function CalendarWidget({ events, strings }: Props) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        padding: 16,
        backgroundColor: "#ffffff",
        borderRadius: 16,
      }}
    >
      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          width: "match_parent",
        }}
      >
        <TextWidget
          text={`📅 ${strings.calendarTitle}`}
          style={{ fontSize: 16, fontWeight: "bold", color: TEAL }}
        />
        <TextWidget
          text={today}
          style={{ fontSize: 11, color: "#9ca3af" }}
        />
      </FlexWidget>

      {events.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TextWidget
            text={strings.calendarEmpty}
            style={{ fontSize: 14, color: "#9ca3af" }}
          />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: "match_parent" } as any}>
          {events.slice(0, 5).map((event) => (
            <FlexWidget
              key={event.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 4,
              }}
              clickAction="OPEN_APP"
            >
              <FlexWidget
                style={{
                  width: 3,
                  height: 24,
                  backgroundColor: TEAL,
                  borderRadius: 2,
                  marginRight: 8,
                }}
              />
              <FlexWidget style={{ flexDirection: "column", flex: 1 }}>
                <TextWidget
                  text={event.title}
                  style={{ fontSize: 14, color: "#1f2937" }}
                  truncate="END"
                  maxLines={1}
                />
                <TextWidget
                  text={event.time}
                  style={{ fontSize: 11, color: "#9ca3af" }}
                />
              </FlexWidget>
            </FlexWidget>
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
