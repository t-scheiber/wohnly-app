import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { TodosWidget } from "./TodosWidget";
import { CalendarWidget } from "./CalendarWidget";
import { ShoppingListWidget } from "./ShoppingListWidget";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WIDGET_TODOS = "widget_todos";
const WIDGET_EVENTS = "widget_events";
const WIDGET_SHOPPING = "widget_shopping";
const WIDGET_STRINGS = "widget_strings";

interface WidgetStrings {
  todosTitle: string;
  todosEmpty: string;
  calendarTitle: string;
  calendarEmpty: string;
  shoppingTitle: string;
  shoppingEmpty: string;
  itemsLeft: string;
  moreItems: string;
}

const DEFAULT_STRINGS: WidgetStrings = {
  todosTitle: "Todos",
  todosEmpty: "All done!",
  calendarTitle: "Today",
  calendarEmpty: "No events today",
  shoppingTitle: "Shopping List",
  shoppingEmpty: "Shopping list is empty",
  itemsLeft: "__COUNT__ left",
  moreItems: "+__COUNT__ more",
};

async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const widgetName = widgetInfo.widgetName;

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const strings = await loadJSON<WidgetStrings>(WIDGET_STRINGS, DEFAULT_STRINGS);

      if (widgetName === "WohnlyTodos") {
        const todos = await loadJSON(WIDGET_TODOS, []);
        props.renderWidget(<TodosWidget todos={todos} strings={strings} />);
      } else if (widgetName === "WohnlyCalendar") {
        const events = await loadJSON(WIDGET_EVENTS, []);
        props.renderWidget(<CalendarWidget events={events} strings={strings} />);
      } else if (widgetName === "WohnlyShoppingList") {
        const items = await loadJSON(WIDGET_SHOPPING, []);
        props.renderWidget(<ShoppingListWidget items={items} strings={strings} />);
      }
      break;
    }
    case "WIDGET_DELETED":
      break;
    case "WIDGET_CLICK":
      // Clicks with ClickAction.OPEN_APP are handled by the OS
      break;
  }
}
