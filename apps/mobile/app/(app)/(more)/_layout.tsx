import { Stack } from "expo-router";

export default function MoreLayout() {
  return (
    <Stack>
      <Stack.Screen name="expenses" options={{ title: "Expenses" }} />
      <Stack.Screen name="subscriptions" options={{ title: "Subscriptions" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
