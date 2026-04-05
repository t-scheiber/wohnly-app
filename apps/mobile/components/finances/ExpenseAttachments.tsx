import { useState } from "react";
import { View, Text, TouchableOpacity, Image, Alert, Platform, TextInput } from "react-native";
import { useExpenseAttachments, useAddAttachment, useDeleteAttachment } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { Camera, FileText, Trash2, Plus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

interface ExpenseAttachmentsProps {
  expenseId: string;
}

export function ExpenseAttachments({ expenseId }: ExpenseAttachmentsProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const { data } = useExpenseAttachments(expenseId);
  const addAttachment = useAddAttachment();
  const deleteAttachment = useDeleteAttachment();
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const attachments = data?.attachments ?? [];
  const photos = attachments.filter((a) => a.type === "photo");
  const notes = attachments.filter((a) => a.type === "note");

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow access to your photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]?.base64) return;

      const asset = result.assets[0];

      // Compress to max 1024px wide
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(asset.width ?? 1024, 1024) } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) return;

      addAttachment.mutate({
        expenseId,
        type: "photo",
        content: manipulated.base64,
        mimeType: "image/jpeg",
        fileName: `receipt-${Date.now()}.jpg`,
      });
    } catch (err) {
      Alert.alert("Error", "Failed to pick photo");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow camera access.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]?.base64) return;

      const asset = result.assets[0];

      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(asset.width ?? 1024, 1024) } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) return;

      addAttachment.mutate({
        expenseId,
        type: "photo",
        content: manipulated.base64,
        mimeType: "image/jpeg",
        fileName: `receipt-${Date.now()}.jpg`,
      });
    } catch (err) {
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addAttachment.mutate({
      expenseId,
      type: "note",
      content: noteText.trim(),
    });
    setNoteText("");
    setShowNoteInput(false);
  };

  const handleDelete = (attachmentId: string) => {
    Alert.alert("Delete attachment?", "This cannot be undone.", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => deleteAttachment.mutate({ expenseId, attachmentId }),
      },
    ]);
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Action buttons */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {Platform.OS !== "web" && (
          <TouchableOpacity
            onPress={handleTakePhoto}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.muted,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
            }}
          >
            <Camera size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>
              Camera
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handlePickPhoto}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.muted,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
          }}
        >
          <Plus size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>
            Photo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowNoteInput(!showNoteInput)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.muted,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
          }}
        >
          <FileText size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>
            Note
          </Text>
        </TouchableOpacity>
      </View>

      {/* Note input */}
      {showNoteInput && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Add a note..."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              color: colors.text,
              fontSize: 14,
              minHeight: 40,
            }}
          />
          <TouchableOpacity
            onPress={handleAddNote}
            disabled={!noteText.trim()}
            style={{
              backgroundColor: noteText.trim() ? colors.primary : colors.muted,
              borderRadius: 8,
              paddingHorizontal: 14,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: noteText.trim() ? colors.primaryForeground : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>
              {t("common.add")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Photos grid */}
      {photos.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {photos.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              onLongPress={() => handleDelete(photo.id)}
              style={{ position: "relative" }}
            >
              <Image
                source={{ uri: `data:${photo.mimeType || "image/jpeg"};base64,${photo.content}` }}
                style={{ width: 80, height: 80, borderRadius: 8 }}
              />
              <TouchableOpacity
                onPress={() => handleDelete(photo.id)}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  backgroundColor: colors.destructive,
                  borderRadius: 10,
                  width: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={10} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Notes list */}
      {notes.map((note) => (
        <View
          key={note.id}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            backgroundColor: colors.muted,
            padding: 10,
            borderRadius: 8,
          }}
        >
          <FileText size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 }}>
            {note.content}
          </Text>
          <TouchableOpacity onPress={() => handleDelete(note.id)}>
            <Trash2 size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
