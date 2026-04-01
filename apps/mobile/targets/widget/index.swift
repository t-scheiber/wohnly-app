import WidgetKit
import SwiftUI

// MARK: — Shared data helpers

private let appGroup = "group.app.wohnly"

struct TodoItem: Codable, Identifiable {
    let id: String
    let title: String
    let completed: Bool
}

struct CalendarEvent: Codable, Identifiable {
    let id: String
    let title: String
    let time: String
}

struct ShoppingItem: Codable, Identifiable {
    let id: String
    let name: String
    let quantity: String?
    let checked: Bool
}

struct WidgetStrings: Codable {
    let todosTitle: String
    let todosEmpty: String
    let calendarTitle: String
    let calendarEmpty: String
    let shoppingTitle: String
    let shoppingEmpty: String
    let itemsLeft: String   // contains __COUNT__ placeholder
    let moreItems: String   // contains __COUNT__ placeholder

    static let fallback = WidgetStrings(
        todosTitle: "Todos", todosEmpty: "All done!",
        calendarTitle: "Today", calendarEmpty: "No events today",
        shoppingTitle: "Shopping List", shoppingEmpty: "Shopping list is empty",
        itemsLeft: "__COUNT__ left", moreItems: "+__COUNT__ more"
    )

    func itemsLeftText(_ count: Int) -> String {
        itemsLeft.replacingOccurrences(of: "__COUNT__", with: "\(count)")
    }
    func moreItemsText(_ count: Int) -> String {
        moreItems.replacingOccurrences(of: "__COUNT__", with: "\(count)")
    }
}

struct WidgetData {
    static func loadStrings() -> WidgetStrings {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: "widget_strings"),
              let strings = try? JSONDecoder().decode(WidgetStrings.self, from: data) else {
            return .fallback
        }
        return strings
    }

    static func loadTodos() -> [TodoItem] {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: "widget_todos"),
              let items = try? JSONDecoder().decode([TodoItem].self, from: data) else {
            return []
        }
        return items
    }

    static func loadEvents() -> [CalendarEvent] {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: "widget_events"),
              let items = try? JSONDecoder().decode([CalendarEvent].self, from: data) else {
            return []
        }
        return items
    }

    static func loadShoppingItems() -> [ShoppingItem] {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: "widget_shopping"),
              let items = try? JSONDecoder().decode([ShoppingItem].self, from: data) else {
            return []
        }
        return items
    }
}

// MARK: — Todos Widget

struct TodosEntry: TimelineEntry {
    let date: Date
    let todos: [TodoItem]
    let strings: WidgetStrings
}

struct TodosProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodosEntry {
        TodosEntry(date: .now, todos: [
            TodoItem(id: "1", title: "Buy groceries", completed: false),
            TodoItem(id: "2", title: "Clean kitchen", completed: true),
        ], strings: .fallback)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodosEntry) -> Void) {
        completion(TodosEntry(date: .now, todos: WidgetData.loadTodos(), strings: WidgetData.loadStrings()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodosEntry>) -> Void) {
        let entry = TodosEntry(date: .now, todos: WidgetData.loadTodos(), strings: WidgetData.loadStrings())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct TodosWidgetView: View {
    var entry: TodosEntry
    @Environment(\.widgetFamily) var family

    private var maxItems: Int {
        switch family {
        case .systemLarge: return 10
        case .systemMedium: return 4
        default: return 4
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "checklist")
                    .foregroundColor(Color(red: 0.427, green: 0.710, blue: 0.659))
                Text(entry.strings.todosTitle)
                    .font(.headline)
                    .foregroundColor(Color(red: 0.427, green: 0.710, blue: 0.659))
                Spacer()
            }

            if entry.todos.isEmpty {
                Spacer()
                Text(entry.strings.todosEmpty)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ForEach(entry.todos.prefix(maxItems)) { todo in
                    HStack(spacing: 6) {
                        Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 14))
                            .foregroundColor(todo.completed ? .green : .secondary)
                        Text(todo.title)
                            .font(.subheadline)
                            .strikethrough(todo.completed)
                            .foregroundColor(todo.completed ? .secondary : .primary)
                            .lineLimit(1)
                    }
                }

                let remaining = entry.todos.count - maxItems
                if remaining > 0 {
                    Text(entry.strings.moreItemsText(remaining))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer(minLength: 0)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: — Calendar Widget

struct CalendarEntry: TimelineEntry {
    let date: Date
    let events: [CalendarEvent]
    let strings: WidgetStrings
}

struct CalendarProvider: TimelineProvider {
    func placeholder(in context: Context) -> CalendarEntry {
        CalendarEntry(date: .now, events: [
            CalendarEvent(id: "1", title: "Team meeting", time: "10:00"),
            CalendarEvent(id: "2", title: "Grocery run", time: "18:00"),
        ], strings: .fallback)
    }

    func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> Void) {
        completion(CalendarEntry(date: .now, events: WidgetData.loadEvents(), strings: WidgetData.loadStrings()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> Void) {
        let entry = CalendarEntry(date: .now, events: WidgetData.loadEvents(), strings: WidgetData.loadStrings())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct CalendarWidgetView: View {
    var entry: CalendarEntry
    @Environment(\.widgetFamily) var family

    private var maxItems: Int {
        switch family {
        case .systemLarge: return 10
        case .systemMedium: return 4
        default: return 4
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "calendar")
                    .foregroundColor(Color(red: 0.427, green: 0.710, blue: 0.659))
                Text(entry.strings.calendarTitle)
                    .font(.headline)
                    .foregroundColor(Color(red: 0.427, green: 0.710, blue: 0.659))
                Spacer()
                Text(entry.date, style: .date)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if entry.events.isEmpty {
                Spacer()
                Text(entry.strings.calendarEmpty)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ForEach(entry.events.prefix(maxItems)) { event in
                    HStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(red: 0.427, green: 0.710, blue: 0.659))
                            .frame(width: 3, height: 18)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(event.title)
                                .font(.subheadline)
                                .lineLimit(1)
                            Text(event.time)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                let remaining = entry.events.count - maxItems
                if remaining > 0 {
                    Text(entry.strings.moreItemsText(remaining))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer(minLength: 0)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: — Shopping List Widget

struct ShoppingEntry: TimelineEntry {
    let date: Date
    let items: [ShoppingItem]
    let strings: WidgetStrings
}

struct ShoppingProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShoppingEntry {
        ShoppingEntry(date: .now, items: [
            ShoppingItem(id: "1", name: "Milk", quantity: "1L", checked: false),
            ShoppingItem(id: "2", name: "Bread", quantity: nil, checked: true),
        ], strings: .fallback)
    }

    func getSnapshot(in context: Context, completion: @escaping (ShoppingEntry) -> Void) {
        completion(ShoppingEntry(date: .now, items: WidgetData.loadShoppingItems(), strings: WidgetData.loadStrings()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShoppingEntry>) -> Void) {
        let entry = ShoppingEntry(date: .now, items: WidgetData.loadShoppingItems(), strings: WidgetData.loadStrings())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct ShoppingWidgetView: View {
    var entry: ShoppingEntry
    @Environment(\.widgetFamily) var family

    private var maxItems: Int {
        switch family {
        case .systemLarge: return 10
        case .systemMedium: return 4
        default: return 4
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "cart")
                    .foregroundColor(Color(red: 0.427, green: 0.710, blue: 0.659))
                Text(entry.strings.shoppingTitle)
                    .font(.headline)
                    .foregroundColor(Color(red: 0.427, green: 0.710, blue: 0.659))
                Spacer()
                let unchecked = entry.items.filter { !$0.checked }.count
                if unchecked > 0 {
                    Text(entry.strings.itemsLeftText(unchecked))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            if entry.items.isEmpty {
                Spacer()
                Text(entry.strings.shoppingEmpty)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ForEach(entry.items.prefix(maxItems)) { item in
                    HStack(spacing: 6) {
                        Image(systemName: item.checked ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 14))
                            .foregroundColor(item.checked ? .green : .secondary)
                        Text(item.name)
                            .font(.subheadline)
                            .strikethrough(item.checked)
                            .foregroundColor(item.checked ? .secondary : .primary)
                            .lineLimit(1)
                        if let qty = item.quantity {
                            Spacer()
                            Text(qty)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                let remaining = entry.items.count - maxItems
                if remaining > 0 {
                    Text(entry.strings.moreItemsText(remaining))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer(minLength: 0)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: — Widget Bundle

struct WohnlyTodosWidget: Widget {
    let kind = "WohnlyTodos"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodosProvider()) { entry in
            TodosWidgetView(entry: entry)
        }
        .configurationDisplayName("Wohnly Todos")
        .description("Your pending household tasks.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct WohnlyCalendarWidget: Widget {
    let kind = "WohnlyCalendar"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CalendarProvider()) { entry in
            CalendarWidgetView(entry: entry)
        }
        .configurationDisplayName("Wohnly Calendar")
        .description("Today's household events at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct WohnlyShoppingListWidget: Widget {
    let kind = "WohnlyShoppingList"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShoppingProvider()) { entry in
            ShoppingWidgetView(entry: entry)
        }
        .configurationDisplayName("Wohnly Shopping List")
        .description("Your household shopping list.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct WohnlyWidgets: WidgetBundle {
    var body: some Widget {
        WohnlyTodosWidget()
        WohnlyCalendarWidget()
        WohnlyShoppingListWidget()
    }
}
