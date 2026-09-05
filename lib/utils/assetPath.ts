import { fetchAssetDataUrl } from "../api/assets";

/**
 * Matches managed asset references emitted by the asset pipeline:
 * `assets/<uuid>.<ext>` — anything else (remote URLs, data URLs, relative
 * files) is rendered verbatim by the markdown layer.
 */
const MANAGED_ASSET_PATH = /^assets\/[A-Za-z0-9._-]+$/;

export function isManagedAssetPath(path: string): boolean {
  return MANAGED_ASSET_PATH.test(path.trim());
}

type CacheEntry = { status: "resolved"; src: string } | { status: "failed" };

const assetSrcCache = new Map<string, CacheEntry>();

/**
 * Resolves a managed asset path to an inline data URL. Results (including
 * failures) are cached so re-renders never re-read unchanged files. Returns
 * `null` when the file is missing on disk so callers can show a fallback.
 */
export async function resolveAssetSrc(filePath: string): Promise<string | null> {
  const key = filePath.trim();
  if (!isManagedAssetPath(key)) return null;

  const cached = assetSrcCache.get(key);
  if (cached) {
    return cached.status === "resolved" ? cached.src : null;
  }

  try {
    const src = await fetchAssetDataUrl(key);
    assetSrcCache.set(key, { status: "resolved", src });
    return src;
  } catch (err) {
    console.error(`Failed to load asset '${key}':`, err);
    assetSrcCache.set(key, { status: "failed" });
    return null;
  }
}

/** Drops cached resolutions — used after an asset is deleted or re-attached. */
export function clearAssetCache(filePath?: string): void {
  if (filePath) {
    assetSrcCache.delete(filePath.trim());
  } else {
    assetSrcCache.clear();
  }
}
