/**
 * Hook for select mode with bulk actions (web/desktop only).
 * On native, returns inactive state.
 */
import { useState, useCallback } from "react";
import { Platform } from "react-native";
import { confirmAction } from "@/lib/utils/confirm";

export function useSelectMode() {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isWeb = Platform.OS === "web";

  const toggleSelectMode = useCallback(() => {
    if (!isWeb) return;
    setIsSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, [isWeb]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, []);

  const deleteSelected = useCallback(
    (deleteFn: (id: string) => void) => {
      if (selectedIds.size === 0) return;
      confirmAction(
        "Delete Selected",
        `Delete ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""}?`,
        () => {
          selectedIds.forEach((id) => deleteFn(id));
          clearSelection();
        }
      );
    },
    [selectedIds, clearSelection]
  );

  return {
    isSelectMode: isWeb ? isSelectMode : false,
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelectMode: isWeb ? toggleSelectMode : () => {},
    toggleItem: isWeb ? toggleItem : () => {},
    selectAll: isWeb ? selectAll : () => {},
    clearSelection: isWeb ? clearSelection : () => {},
    deleteSelected: isWeb ? deleteSelected : () => {},
    isWeb,
  };
}
