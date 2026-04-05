/**
 * Receipt scanner — orchestrates image capture + OCR + parsing.
 *
 * Uses on-device OCR:
 * - iOS: Apple Vision via expo-text-extractor
 * - Android: Google ML Kit via expo-text-extractor
 * - Web: Tesseract.js (optional, not included by default)
 *
 * Required dependencies (install with `npx expo install`):
 * - expo-image-picker
 * - expo-text-extractor
 */

import { Platform, Alert } from "react-native";
import { parseReceipt, type ParsedReceipt } from "./receipt-parser";

// Dynamic imports to handle missing packages gracefully
let ImagePicker: typeof import("expo-image-picker") | null = null;
let TextExtractor: { extractText: (uri: string) => Promise<string> } | null = null;

try {
  ImagePicker = require("expo-image-picker");
} catch {
  // expo-image-picker not installed
}

try {
  TextExtractor = require("expo-text-extractor");
} catch {
  // expo-text-extractor not installed — OCR will not be available
}

export interface ScanResult {
  receipt: ParsedReceipt;
  rawText: string;
  imageUri: string;
}

/**
 * Check if OCR scanning is available on this platform.
 */
export function isScanAvailable(): boolean {
  if (Platform.OS === "web") return false; // Web OCR not included by default
  return ImagePicker !== null && TextExtractor !== null;
}

/**
 * Launch the camera to capture a receipt photo.
 */
async function capturePhoto(): Promise<string | null> {
  if (!ImagePicker) {
    Alert.alert("Not available", "Image picker is not installed.");
    return null;
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission needed", "Please allow camera access to scan receipts.");
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

/**
 * Pick a photo from the gallery.
 */
async function pickPhoto(): Promise<string | null> {
  if (!ImagePicker) {
    Alert.alert("Not available", "Image picker is not installed.");
    return null;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission needed", "Please allow access to your photos.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

/**
 * Run OCR on an image URI and return extracted text.
 */
async function runOCR(imageUri: string): Promise<string> {
  if (!TextExtractor) {
    throw new Error("OCR is not available. Install expo-text-extractor.");
  }

  const text = await TextExtractor.extractText(imageUri);
  return text;
}

/**
 * Scan a receipt: capture/pick photo → OCR → parse.
 * Returns null if the user cancels.
 */
export async function scanReceipt(source: "camera" | "gallery"): Promise<ScanResult | null> {
  const imageUri = source === "camera" ? await capturePhoto() : await pickPhoto();
  if (!imageUri) return null;

  try {
    const rawText = await runOCR(imageUri);
    const receipt = parseReceipt(rawText);

    return { receipt, rawText, imageUri };
  } catch (err) {
    Alert.alert(
      "Scan failed",
      "Could not read text from the image. Try taking a clearer photo with good lighting."
    );
    return null;
  }
}
