import { ReportContent } from "src/experiences/report/reportContent";
import { getBase64Image } from "src/experiences/report/util";

/**
 * Cache for preloaded assets (images/fonts) used in report generation.
 * This prevents fetching the same assets multiple times during bulk downloads.
 */
export class AssetPreloader {
  private assetCache: Map<string, string> = new Map();
  private isPreloaded = false;

  /**
   * Preload all assets used in PDF and DOCX reports.
   * This should be called once before generating multiple reports.
   * @returns Promise that resolves when all assets are loaded
   */
  async preloadAllAssets(): Promise<void> {
    if (this.isPreloaded) {
      return; // Already preloaded
    }

    const imageUrls = Object.values(ReportContent.IMAGE_URLS);

    // Fetch all images in parallel
    const promises = imageUrls.map(async (url) => {
      try {
        const base64Data = await getBase64Image(url);
        this.assetCache.set(url, base64Data);
      } catch (error) {
        console.error(`Failed to preload asset: ${url}`, error);
        throw error;
      }
    });

    await Promise.all(promises);
    this.isPreloaded = true;
  }

  /**
   * Get a preloaded asset by URL.
   * @param url - The URL of the asset
   * @returns The base64-encoded asset data
   * @throws Error if asset was not preloaded
   */
  getAsset(url: string): string {
    const asset = this.assetCache.get(url);
    if (!asset) {
      throw new Error(`Asset not preloaded: ${url}. Call preloadAllAssets() first.`);
    }
    return asset;
  }

  /**
   * Get a preloaded asset by URL, or fetch it if not in cache.
   * This is useful as a fallback for single report generation.
   * @param url - The URL of the asset
   * @returns The base64-encoded asset data
   */
  async getAssetOrFetch(url: string): Promise<string> {
    const cached = this.assetCache.get(url);
    if (cached) {
      return cached;
    }

    // Not in cache, fetch it
    const base64Data = await getBase64Image(url);
    this.assetCache.set(url, base64Data);
    return base64Data;
  }

  /**
   * Clear all cached assets and reset preloaded state.
   */
  clear(): void {
    this.assetCache.clear();
    this.isPreloaded = false;
  }

  /**
   * Get the underlying cache Map.
   * This is useful for passing to functions that need direct cache access.
   */
  getCache(): Map<string, string> {
    return this.assetCache;
  }

  /**
   * Check if assets have been preloaded.
   */
  get isLoaded(): boolean {
    return this.isPreloaded;
  }

  /**
   * Get the number of cached assets.
   */
  get cacheSize(): number {
    return this.assetCache.size;
  }
}

/**
 * Global singleton instance for asset preloading.
 * Use this instance for bulk operations to share the cache.
 */
export const globalAssetPreloader = new AssetPreloader();
