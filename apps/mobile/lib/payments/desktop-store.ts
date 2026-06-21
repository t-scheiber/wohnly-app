import { isTauri, tauriInvoke } from "@/lib/auth/tauri";

export const DESKTOP_PRO_PRODUCT_ID =
  process.env.EXPO_PUBLIC_DESKTOP_PRO_PRODUCT_ID ?? "wohnly_pro_lifetime";
export const DESKTOP_PRO_CHANGED_EVENT = "wohnly:desktop-pro-changed";

interface DesktopProduct {
  productId: string;
  formattedPrice?: string;
}

interface ProductsResponse {
  products: DesktopProduct[];
}

interface Purchase {
  productId: string;
  purchaseState: number;
}

interface RestoreResponse {
  purchases: Purchase[];
}

interface ProductStatus {
  isOwned: boolean;
  purchaseState?: number;
}

function requireDesktopStore() {
  if (!isTauri()) throw new Error("Desktop store purchases require the desktop app.");
}

export async function getDesktopStorePrice(): Promise<string | null> {
  requireDesktopStore();
  const result = await tauriInvoke<ProductsResponse>("plugin:iap|get_products", {
    payload: {
      productIds: [DESKTOP_PRO_PRODUCT_ID],
      productType: "inapp",
    },
  });
  return result.products.find((item) => item.productId === DESKTOP_PRO_PRODUCT_ID)
    ?.formattedPrice ?? null;
}

export async function purchaseDesktopPro(): Promise<boolean> {
  requireDesktopStore();
  const purchase = await tauriInvoke<Purchase>("plugin:iap|purchase", {
    payload: {
      productId: DESKTOP_PRO_PRODUCT_ID,
      productType: "inapp",
    },
  });
  const purchased =
    purchase.productId === DESKTOP_PRO_PRODUCT_ID && purchase.purchaseState === 0;
  if (purchased) window.dispatchEvent(new Event(DESKTOP_PRO_CHANGED_EVENT));
  return purchased;
}

export async function restoreDesktopPro(): Promise<boolean> {
  requireDesktopStore();
  const result = await tauriInvoke<RestoreResponse>("plugin:iap|restore_purchases", {
    payload: { productType: "inapp" },
  });
  const restored = result.purchases.some(
    (purchase) =>
      purchase.productId === DESKTOP_PRO_PRODUCT_ID && purchase.purchaseState === 0,
  );
  if (restored) window.dispatchEvent(new Event(DESKTOP_PRO_CHANGED_EVENT));
  return restored;
}

export async function checkDesktopPro(): Promise<boolean> {
  if (!isTauri()) return false;
  const status = await tauriInvoke<ProductStatus>("plugin:iap|get_product_status", {
    payload: {
      productId: DESKTOP_PRO_PRODUCT_ID,
      productType: "inapp",
    },
  });
  return status.isOwned && status.purchaseState === 0;
}
