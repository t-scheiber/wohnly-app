import React from "react";
import {
  FlexWidget,
  TextWidget,
  ListWidget,
} from "react-native-android-widget";

interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  checked: boolean;
}

interface WidgetStrings {
  shoppingTitle: string;
  shoppingEmpty: string;
  itemsLeft: string;
}

interface Props {
  items: ShoppingItem[];
  strings: WidgetStrings;
}

const TEAL = "#6db5a8";

function replaceCount(template: string, count: number): string {
  return template.replace("__COUNT__", String(count));
}

export function ShoppingListWidget({ items, strings }: Props) {
  const unchecked = items.filter((i) => !i.checked).length;

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
          text={`🛒 ${strings.shoppingTitle}`}
          style={{ fontSize: 16, fontWeight: "bold", color: TEAL }}
        />
        {unchecked > 0 && (
          <TextWidget
            text={replaceCount(strings.itemsLeft, unchecked)}
            style={{ fontSize: 11, color: "#9ca3af" }}
          />
        )}
      </FlexWidget>

      {items.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TextWidget
            text={strings.shoppingEmpty}
            style={{ fontSize: 14, color: "#9ca3af" }}
          />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: "match_parent" } as any}>
          {items.slice(0, 5).map((item) => (
            <FlexWidget
              key={item.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 4,
                width: "match_parent",
              }}
              clickAction="OPEN_APP"
            >
              <TextWidget
                text={item.checked ? "☑" : "☐"}
                style={{
                  fontSize: 16,
                  color: item.checked ? "#22c55e" : "#9ca3af",
                  marginRight: 8,
                }}
              />
              <TextWidget
                text={item.name}
                style={{
                  fontSize: 14,
                  color: item.checked ? "#9ca3af" : "#1f2937",
                } as any}
                truncate="END"
                maxLines={1}
              />
              {item.quantity ? (
                <TextWidget
                  text={item.quantity}
                  style={{ fontSize: 11, color: "#9ca3af" }}
                />
              ) : null}
            </FlexWidget>
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
