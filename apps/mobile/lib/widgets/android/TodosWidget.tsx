import React from "react";
import {
  FlexWidget,
  TextWidget,
  ListWidget,
  ClickAction,
} from "react-native-android-widget";

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

interface WidgetStrings {
  todosTitle: string;
  todosEmpty: string;
  moreItems: string;
}

interface Props {
  todos: TodoItem[];
  strings: WidgetStrings;
}

const TEAL = "#6db5a8";

export function TodosWidget({ todos, strings }: Props) {
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
          marginBottom: 8,
        }}
      >
        <TextWidget
          text={`✓ ${strings.todosTitle}`}
          style={{ fontSize: 16, fontWeight: "bold", color: TEAL }}
        />
      </FlexWidget>

      {todos.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TextWidget
            text={strings.todosEmpty}
            style={{ fontSize: 14, color: "#9ca3af" }}
          />
        </FlexWidget>
      ) : (
        <ListWidget style={{ flex: 1 }}>
          {todos.slice(0, 5).map((todo) => (
            <FlexWidget
              key={todo.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 4,
              }}
              clickAction={ClickAction.OPEN_APP}
            >
              <TextWidget
                text={todo.completed ? "☑" : "☐"}
                style={{
                  fontSize: 16,
                  color: todo.completed ? "#22c55e" : "#9ca3af",
                  marginRight: 8,
                }}
              />
              <TextWidget
                text={todo.title}
                style={{
                  fontSize: 14,
                  color: todo.completed ? "#9ca3af" : "#1f2937",
                }}
                truncate="END"
                maxLines={1}
              />
            </FlexWidget>
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
