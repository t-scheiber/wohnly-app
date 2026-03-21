import { Stack } from "expo-router";

export default function ListsLayout() {
  return (
    <Stack>
      <Stack.Screen name="todos" options={{ title: "Todos" }} />
      <Stack.Screen name="shopping" options={{ title: "Shopping List" }} />
    </Stack>
  );
}
