import { Platform } from "react-native";
import SharedGroupPreferences from "react-native-shared-group-preferences";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../../i18n";

const APP_GROUP = "group.app.wohnly";

interface TodoWidgetItem {
  id: string;
  title: string;
  completed: boolean;
}

interface CalendarWidgetEvent {
  id: string;
  title: string;
  time: string;
}

interface ShoppingWidgetItem {
  id: string;
  name: string;
  quantity?: string;
  checked: boolean;
}

/** Localized strings the native widgets need to display UI chrome. */
function getWidgetStrings() {
  return {
    todosTitle: i18n.t("widgets.todosTitle"),
    todosEmpty: i18n.t("widgets.todosEmpty"),
    calendarTitle: i18n.t("widgets.calendarTitle"),
    calendarEmpty: i18n.t("widgets.calendarEmpty"),
    shoppingTitle: i18n.t("widgets.shoppingTitle"),
    shoppingEmpty: i18n.t("widgets.shoppingEmpty"),
    itemsLeft: i18n.t("widgets.itemsLeft", { count: "__COUNT__" }),
    moreItems: i18n.t("widgets.moreItems", { count: "__COUNT__" }),
  };
}

/**
 * Write todo data to shared storage so native widgets can display it.
 * iOS: App Group UserDefaults. Android: AsyncStorage (read by widget task handler).
 * Call this whenever todos change.
 */
export async function syncTodosToWidget(
  todos: TodoWidgetItem[]
): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      await SharedGroupPreferences.setItem("widget_todos", todos, APP_GROUP);
    } else if (Platform.OS === "android") {
      await AsyncStorage.setItem("widget_todos", JSON.stringify(todos));
      requestAndroidWidgetUpdate("WohnlyTodos");
    }
  } catch {
    // Widget sync is best-effort
  }
}

/**
 * Write calendar event data to shared storage so native widgets can display it.
 * Call this whenever today's events change.
 */
export async function syncEventsToWidget(
  events: CalendarWidgetEvent[]
): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      await SharedGroupPreferences.setItem("widget_events", events, APP_GROUP);
    } else if (Platform.OS === "android") {
      await AsyncStorage.setItem("widget_events", JSON.stringify(events));
      requestAndroidWidgetUpdate("WohnlyCalendar");
    }
  } catch {
    // Widget sync is best-effort
  }
}

/**
 * Write shopping list data to shared storage so native widgets can display it.
 * Call this whenever the shopping list changes.
 */
export async function syncShoppingToWidget(
  items: ShoppingWidgetItem[]
): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      await SharedGroupPreferences.setItem("widget_shopping", items, APP_GROUP);
    } else if (Platform.OS === "android") {
      await AsyncStorage.setItem("widget_shopping", JSON.stringify(items));
      requestAndroidWidgetUpdate("WohnlyShoppingList");
    }
  } catch {
    // Widget sync is best-effort
  }
}

/**
 * Write localized UI strings to shared storage so native widgets can
 * display headings and empty-state messages in the user's language.
 * Call this when the language changes or at app startup.
 */
export async function syncWidgetStrings(): Promise<void> {
  try {
    const strings = getWidgetStrings();
    if (Platform.OS === "ios") {
      await SharedGroupPreferences.setItem("widget_strings", strings, APP_GROUP);
    } else if (Platform.OS === "android") {
      await AsyncStorage.setItem("widget_strings", JSON.stringify(strings));
    }
  } catch {
    // Widget sync is best-effort
  }
}

/**
 * Request the OS to reload all Wohnly widgets.
 * Call after syncing data so widgets pick up changes promptly.
 */
export async function reloadWidgets(): Promise<void> {
  try {
    await syncWidgetStrings();

    if (Platform.OS === "ios") {
      const { WidgetModule } =
        require("@bacons/apple-targets/widget") ?? {};
      WidgetModule?.reloadAllTimelines?.();
    } else if (Platform.OS === "android") {
      requestAndroidWidgetUpdate("WohnlyTodos");
      requestAndroidWidgetUpdate("WohnlyCalendar");
      requestAndroidWidgetUpdate("WohnlyShoppingList");
    }
  } catch {
    // Widget reload is best-effort
  }
}

function requestAndroidWidgetUpdate(widgetName: string) {
  try {
    const { requestWidgetUpdate } = require("react-native-android-widget");
    requestWidgetUpdate({ widgetName });
  } catch {
    // Android widget module not available
  }
}
