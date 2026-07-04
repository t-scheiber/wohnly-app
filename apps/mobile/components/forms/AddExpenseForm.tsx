import { useState, useMemo } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, Pressable, TextInput, FlatList } from "react-native";
import { AppModal } from "@/components/ui/AppModal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DatePicker } from "../ui/DatePicker";
import { useCreateExpense, useUpdateExpense, useHouseholdMembers } from "@/lib/api/queries";
import { authClient } from "@/lib/auth/client";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { EXPENSE_CATEGORIES, CURRENCIES } from "@wohnly/shared";
import * as LucideIcons from "lucide-react-native";
import { Camera, Image as ImageIcon } from "lucide-react-native";
import { ExpenseAttachments } from "../finances/ExpenseAttachments";
import { isScanAvailable, scanReceipt } from "@/lib/ocr/receipt-scanner";
import { ItemizedSplitForm, type LineItem } from "./ItemizedSplitForm";
import type { Expense } from "@wohnly/shared";

// CURRENCIES is now imported from @wohnly/shared

type SplitMode = "equal" | "custom" | "shares" | "itemized";

interface MemberSplit {
  memberId: string;
  name: string;
  amount: string;
}

interface MemberShares {
  memberId: string;
  name: string;
  shares: number;
}

interface AddExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editItem?: Expense;
}

export function AddExpenseForm({ onSuccess, onCancel, editItem }: AddExpenseFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const isEditing = !!editItem;

  const [title, setTitle] = useState(editItem?.title ?? "");
  const [amount, setAmount] = useState(editItem ? String(editItem.amount) : "");
  const [currency, setCurrency] = useState(editItem?.currency ?? "EUR");
  const [category, setCategory] = useState(editItem?.category ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [date, setDate] = useState<Date>(editItem?.date ? new Date(editItem.date) : new Date());
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(editItem?.paidById ?? null);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>(
    editItem?.splitType === "shares" ? "shares" : editItem?.splitType && editItem.splitType !== "equal" ? "custom" : "equal"
  );
  const [memberSplits, setMemberSplits] = useState<MemberSplit[]>([]);
  const [memberShares, setMemberShares] = useState<MemberShares[]>([]);
  const [showItemizedForm, setShowItemizedForm] = useState(false);
  const [itemizedLineItems, setItemizedLineItems] = useState<LineItem[]>([]);
  const [scannedLineItems, setScannedLineItems] = useState<{ name: string; amount: number }[]>([]);

  const [fieldErrors, setFieldErrors] = useState<{ title?: string; amount?: string }>({});

  const [scanning, setScanning] = useState(false);
  const scanAvailable = !isEditing && isScanAvailable();

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const { data: membersData } = useHouseholdMembers();

  const handleScan = async (source: "camera" | "gallery") => {
    setScanning(true);
    try {
      const result = await scanReceipt(source);
      if (!result) return;

      const { receipt } = result;
      if (receipt.total) setAmount(String(receipt.total));
      if (receipt.merchant) setTitle(receipt.merchant);
      if (receipt.currency) setCurrency(receipt.currency);
      if (receipt.date) setDate(new Date(receipt.date));
      if (receipt.lineItems.length > 0) {
        setScannedLineItems(receipt.lineItems);
      }
    } catch {
      Alert.alert("Error", "Failed to scan receipt");
    } finally {
      setScanning(false);
    }
  };

  const currentMember = membersData?.members?.find((m) => m.isCurrentUser);
  const selectedPaidBy = paidByMemberId ?? currentMember?.id;
  const selectedCurrency = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];

  const filteredCurrencies = currencySearch
    ? CURRENCIES.filter((c) =>
        c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.name.toLowerCase().includes(currencySearch.toLowerCase())
      )
    : CURRENCIES;

  // Initialize member splits when switching to custom
  const initCustomSplits = () => {
    if (membersData?.members) {
      const total = parseFloat(amount.replace(",", ".")) || 0;
      const perPerson = total > 0 ? (total / membersData.members.length).toFixed(2) : "";
      setMemberSplits(
        membersData.members.map((m) => ({
          memberId: m.id,
          name: m.nickname || m.displayName || (m as any).email || "Member",
          amount: perPerson,
        }))
      );
    }
  };

  // Initialize member shares when switching to shares mode
  const initShares = () => {
    if (membersData?.members) {
      setMemberShares(
        membersData.members.map((m) => ({
          memberId: m.id,
          name: m.nickname || m.displayName || (m as any).email || "Member",
          shares: 1,
        }))
      );
    }
  };

  // Calculate per-person amounts for shares mode
  const sharesTotal = useMemo(() => memberShares.reduce((s, m) => s + m.shares, 0), [memberShares]);
  const sharesPerPerson = useMemo(() => {
    const total = parseFloat(amount.replace(",", ".")) || 0;
    if (sharesTotal === 0 || total === 0) return new Map<string, number>();
    const map = new Map<string, number>();
    memberShares.forEach((m) => map.set(m.memberId, Math.round((total * m.shares / sharesTotal) * 100) / 100));
    return map;
  }, [amount, memberShares, sharesTotal]);

  // Calculate remaining amount for custom splits
  const totalSplit = useMemo(() => {
    return memberSplits.reduce((sum, s) => sum + (parseFloat(s.amount.replace(",", ".")) || 0), 0);
  }, [memberSplits]);

  const totalAmount = parseFloat(amount.replace(",", ".")) || 0;
  const remaining = Math.round((totalAmount - totalSplit) * 100) / 100;

  const updateMemberSplit = (memberId: string, value: string) => {
    setMemberSplits((prev) =>
      prev.map((s) => (s.memberId === memberId ? { ...s, amount: value } : s))
    );
  };

  // Auto-fill remaining to last empty or auto member
  const autoFillRemaining = (memberId: string) => {
    const total = parseFloat(amount.replace(",", ".")) || 0;
    const othersTotal = memberSplits
      .filter((s) => s.memberId !== memberId)
      .reduce((sum, s) => sum + (parseFloat(s.amount.replace(",", ".")) || 0), 0);
    const rest = Math.round((total - othersTotal) * 100) / 100;
    if (rest >= 0) {
      updateMemberSplit(memberId, rest.toFixed(2));
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !amount) {
      setFieldErrors({
        title: !title.trim() ? t("expenses.enterTitle", "Please enter a title") : undefined,
        amount: !amount ? t("expenses.enterAmount", "Please enter an amount") : undefined,
      });
      return;
    }

    const numAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      setFieldErrors({ amount: t("expenses.invalidAmount", "Please enter a valid amount") });
      return;
    }

    if (splitMode === "custom" && Math.abs(remaining) > 0.01) {
      Alert.alert("Error", `Split amounts don't add up. ${remaining > 0 ? `${remaining.toFixed(2)} remaining` : `${Math.abs(remaining).toFixed(2)} over budget`}`);
      return;
    }

    const paidByUserId = membersData?.members?.find((m) => m.id === selectedPaidBy)?.userId ?? session?.user?.id;

    try {
      const payload = {
        title: title.trim(),
        amount: numAmount,
        currency,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        date: date.toISOString(),
        paidById: paidByUserId,
        splitType: splitMode === "itemized" ? "itemized" : splitMode === "shares" ? "shares" : splitMode === "custom" ? "custom" : "equal",
        ...(splitMode === "custom" && {
          splits: memberSplits
            .filter((s) => parseFloat(s.amount.replace(",", ".")) > 0)
            .map((s) => ({
              memberId: s.memberId,
              amount: parseFloat(s.amount.replace(",", ".")),
            })),
        }),
        ...(splitMode === "shares" && {
          splits: memberShares
            .filter((s) => s.shares > 0)
            .map((s) => ({
              memberId: s.memberId,
              shares: s.shares,
            })),
        }),
        ...(splitMode === "itemized" && {
          lineItems: itemizedLineItems.map((item) => ({
            name: item.name.trim(),
            amount: parseFloat(item.amount.replace(",", ".")),
            assigneeIds: item.assigneeIds,
          })),
        }),
      };
      if (isEditing) {
        await updateExpense.mutateAsync({ id: editItem.id, ...payload });
      } else {
        await createExpense.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} expense`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {isEditing ? t("expenses.editExpense", "Edit Expense") : t("expenses.addExpense")}
      </Text>

      {/* Scan Receipt */}
      {scanAvailable && (
        <View style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 12,
          padding: 12,
          backgroundColor: colors.primary + "08",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.primary + "30",
          borderStyle: "dashed",
        }}>
          <TouchableOpacity
            onPress={() => handleScan("camera")}
            disabled={scanning}
            accessibilityRole="button"
            accessibilityLabel={t("expenses.scanReceipt", "Scan Receipt")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: colors.primary,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Camera size={18} color={colors.primaryForeground} />
            <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 14 }}>
              {scanning ? "Scanning..." : "Scan Receipt"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleScan("gallery")}
            disabled={scanning}
            accessibilityRole="button"
            accessibilityLabel={t("expenses.scanFromGallery", "Scan receipt from gallery")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: colors.muted,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 8,
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <ImageIcon size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Amount + Currency */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t("expenses.amount")}
            placeholder="0.00"
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              if (fieldErrors.amount) setFieldErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            keyboardType="decimal-pad"
            error={fieldErrors.amount}
            style={{ fontSize: 24, fontWeight: "600" }}
          />
        </View>
        <TouchableOpacity
          onPress={() => setCurrencyPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t("expenses.selectCurrency", "Select currency")}, ${selectedCurrency.code}`}
          style={{
            backgroundColor: colors.muted,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 13,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
            {selectedCurrency.symbol} {selectedCurrency.code}
          </Text>
        </TouchableOpacity>
      </View>

      <Input
        label={t("expenses.title") || "Title"}
        placeholder="e.g., Groceries"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
        }}
        error={fieldErrors.title}
      />

      {/* Category Chips */}
      <View style={{ marginBottom: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
          {t("expenses.category")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {EXPENSE_CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            const IconComponent = (LucideIcons as Record<string, any>)[cat.icon];
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setCategory(isSelected ? "" : cat.id)}
                accessibilityRole="button"
                accessibilityLabel={t(`expenses.categories.${cat.id}`, cat.id)}
                accessibilityState={{ selected: isSelected }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 20,
                  backgroundColor: isSelected ? cat.color + "20" : colors.muted,
                  borderWidth: 1.5,
                  borderColor: isSelected ? cat.color : colors.border,
                }}
              >
                {IconComponent && <IconComponent size={16} color={isSelected ? cat.color : colors.textSecondary} />}
                <Text style={{ fontSize: 13, fontWeight: "600", color: isSelected ? cat.color : colors.textSecondary }}>
                  {t(`expenses.categories.${cat.id}`, cat.id)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <DatePicker
        label={t("expenses.date")}
        value={date}
        onChange={setDate}
        mode="date"
      />

      {/* Paid By selector */}
      {membersData?.members && membersData.members.length > 1 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
            {t("expenses.paidBy")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {membersData.members.map((member) => (
              <TouchableOpacity
                key={member.id}
                onPress={() => setPaidByMemberId(member.id)}
                accessibilityRole="button"
                accessibilityLabel={member.nickname || member.displayName || (member as any).email}
                accessibilityState={{ selected: selectedPaidBy === member.id }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  backgroundColor: selectedPaidBy === member.id ? colors.primary : colors.muted,
                }}
              >
                <Text style={{
                  color: selectedPaidBy === member.id ? colors.primaryForeground : colors.text,
                  fontWeight: "600",
                  fontSize: 14,
                }}>
                  {member.nickname || member.displayName || (member as any).email}
                  {member.isCurrentUser ? ` (${t("settings.you")})` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Split Type */}
      {membersData?.members && membersData.members.length > 1 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
            {t("expenses.splitType")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["equal", "custom", "shares", "itemized"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => {
                  if (mode === "itemized") {
                    setShowItemizedForm(true);
                    return;
                  }
                  setSplitMode(mode);
                  if (mode === "custom") initCustomSplits();
                  if (mode === "shares") initShares();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  mode === "equal" ? t("expenses.equal")
                    : mode === "shares" ? t("expenses.shares", "Shares")
                    : mode === "itemized" ? "Items"
                    : "Custom"
                }
                accessibilityState={{ selected: splitMode === mode }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: splitMode === mode ? colors.primary : colors.muted,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: splitMode === mode ? colors.primaryForeground : colors.text, fontWeight: "600", fontSize: 12 }}>
                  {mode === "equal" ? t("expenses.equal")
                    : mode === "shares" ? t("expenses.shares", "Shares")
                    : mode === "itemized" ? "Items"
                    : "Custom"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Custom Split Amounts */}
      {splitMode === "custom" && memberSplits.length > 0 && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 12,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Split per person</Text>
            <Text style={{
              fontSize: 14,
              fontWeight: "600",
              color: Math.abs(remaining) < 0.01 ? colors.success : remaining > 0 ? colors.warning : colors.destructive,
            }}>
              {Math.abs(remaining) < 0.01 ? "Balanced" : remaining > 0 ? `${remaining.toFixed(2)} left` : `${Math.abs(remaining).toFixed(2)} over`}
            </Text>
          </View>

          {memberSplits.map((split) => (
            <View key={split.memberId} style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
              gap: 10,
            }}>
              <Text style={{ flex: 1, fontSize: 15, color: colors.text }} numberOfLines={1}>
                {split.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <TextInput
                  value={split.amount}
                  onChangeText={(v: string) => updateMemberSplit(split.memberId, v)}
                  keyboardType="decimal-pad"
                  accessibilityLabel={t("expenses.amountFor", {
                    defaultValue: "Amount for {{name}}",
                    name: split.name,
                  })}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.text,
                    width: 90,
                    textAlign: "right",
                  }}
                />
                <TouchableOpacity
                  onPress={() => autoFillRemaining(split.memberId)}
                  accessibilityRole="button"
                  accessibilityLabel={t("expenses.fillRemainingFor", {
                    defaultValue: "Fill remaining amount for {{name}}",
                    name: split.name,
                  })}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  style={{
                    backgroundColor: colors.muted,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "700" }}>Rest</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Shares Split */}
      {splitMode === "shares" && memberShares.length > 0 && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 12,
        }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 10 }}>
            {t("expenses.shares", "Shares")}
          </Text>
          {memberShares.map((ms) => {
            const perPerson = sharesPerPerson.get(ms.memberId) ?? 0;
            return (
              <View key={ms.memberId} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 }}>
                <Text style={{ flex: 1, fontSize: 15, color: colors.text }} numberOfLines={1}>
                  {ms.name}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setMemberShares((prev) => prev.map((s) => s.memberId === ms.memberId ? { ...s, shares: Math.max(0, s.shares - 1) } : s))}
                    accessibilityRole="button"
                    accessibilityLabel={t("expenses.decreaseSharesFor", {
                      defaultValue: "Decrease shares for {{name}}",
                      name: ms.name,
                    })}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, minWidth: 24, textAlign: "center" }}>
                    {ms.shares}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setMemberShares((prev) => prev.map((s) => s.memberId === ms.memberId ? { ...s, shares: s.shares + 1 } : s))}
                    accessibilityRole="button"
                    accessibilityLabel={t("expenses.increaseSharesFor", {
                      defaultValue: "Increase shares for {{name}}",
                      name: ms.name,
                    })}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>+</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, minWidth: 60, textAlign: "right" }}>
                    {selectedCurrency.symbol}{perPerson.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Input
        label="Description (optional)"
        placeholder="Add a note..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={2}
      />

      {/* Attachments (only when editing an existing expense) */}
      {isEditing && editItem?.id && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 8 }}>
            Attachments
          </Text>
          <ExpenseAttachments expenseId={editItem.id} />
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>
            {t("common.cancel")}
          </Button>
        )}
        <Button
          onPress={handleSubmit}
          loading={isEditing ? updateExpense.isPending : createExpense.isPending}
          disabled={!title.trim() || !amount}
          style={{ flex: 2 }}
        >
          {isEditing ? t("common.save", "Save") : t("expenses.addExpense")}
        </Button>
      </View>

      {/* Currency Picker Modal */}
      <AppModal visible={currencyPickerOpen} transparent animationType="fade" onRequestClose={() => setCurrencyPickerOpen(false)}>
        <Pressable
          onPress={() => setCurrencyPickerOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t("common.close", "Close")}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
        >
          <Pressable onPress={() => {}} accessible={false} style={{ backgroundColor: colors.card, borderRadius: 16, width: "85%", maxWidth: 360, maxHeight: "70%", overflow: "hidden" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, padding: 20, paddingBottom: 8 }}>
              Currency
            </Text>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <TextInput
                placeholder="Search..."
                accessibilityLabel={t("common.search", "Search")}
                placeholderTextColor={colors.textSecondary}
                value={currencySearch}
                onChangeText={setCurrencySearch}
                autoFocus
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 15,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </View>
            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item: { code: string; name: string; symbol: string }) => item.code}
              renderItem={({ item }: { item: { code: string; name: string; symbol: string } }) => (
                <TouchableOpacity
                  onPress={() => { setCurrency(item.code); setCurrencyPickerOpen(false); setCurrencySearch(""); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.code}`}
                  accessibilityState={{ selected: item.code === currency }}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 16,
                    paddingHorizontal: 20,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: item.code === currency ? colors.muted : undefined,
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.text }}>
                    {item.symbol}  {item.name}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </AppModal>

      {/* Itemized Split Modal */}
      <AppModal visible={showItemizedForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowItemizedForm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <ItemizedSplitForm
            currency={currency}
            initialItems={scannedLineItems.length > 0 ? scannedLineItems : undefined}
            onConfirm={(items, total) => {
              setItemizedLineItems(items);
              setAmount(String(total));
              setSplitMode("itemized");
              setShowItemizedForm(false);
              setScannedLineItems([]);
            }}
            onCancel={() => {
              setShowItemizedForm(false);
            }}
          />
        </View>
      </AppModal>
    </ScrollView>
  );
}
