// mute chatty console
import "src/_test_utilities/consoleMock";

import { AssetPreloader } from "./assetPreloader";
import { ReportContent } from "./reportContent";
import * as util from "./util";

// Mock the getBase64Image function
jest.mock("./util", () => ({
  ...jest.requireActual("./util"),
  getBase64Image: jest.fn(),
}));

const mockGetBase64Image = util.getBase64Image as jest.MockedFunction<typeof util.getBase64Image>;

describe("AssetPreloader", () => {
  let preloader: AssetPreloader;
  const expectedAssetCount = Object.keys(ReportContent.IMAGE_URLS).length;

  beforeEach(() => {
    preloader = new AssetPreloader();
    mockGetBase64Image.mockClear();
  });

  afterEach(() => {
    preloader.clear();
  });

  describe("preloadAllAssets", () => {
    it("should fetch all assets from ReportContent.IMAGE_URLS", async () => {
      mockGetBase64Image.mockResolvedValue("data:image/png;base64,mockdata");

      await preloader.preloadAllAssets();

      // Should have called getBase64Image for each unique image URL
      expect(mockGetBase64Image).toHaveBeenCalledTimes(expectedAssetCount);
      expect(preloader.isLoaded).toBe(true);
      expect(preloader.cacheSize).toBe(expectedAssetCount);
    });

    it("should not fetch assets again if already preloaded", async () => {
      mockGetBase64Image.mockResolvedValue("data:image/png;base64,mockdata");

      await preloader.preloadAllAssets();
      const firstCallCount = mockGetBase64Image.mock.calls.length;

      // Call again
      await preloader.preloadAllAssets();

      // Should not have called getBase64Image again
      expect(mockGetBase64Image).toHaveBeenCalledTimes(firstCallCount);
    });

    it("should throw error if asset fetch fails", async () => {
      mockGetBase64Image.mockRejectedValue(new Error("Network error"));

      await expect(preloader.preloadAllAssets()).rejects.toThrow("Network error");
    });
  });

  describe("getAsset", () => {
    it("should return preloaded asset", async () => {
      // Use an actual URL from ReportContent
      const mockUrl = ReportContent.IMAGE_URLS.COMPASS_LOGO;
      mockGetBase64Image.mockResolvedValue("data:image/png;base64,mockdata");

      await preloader.preloadAllAssets();
      const asset = preloader.getAsset(mockUrl);

      expect(asset).toBe("data:image/png;base64,mockdata");
    });

    it("should throw error if asset not preloaded", () => {
      const mockUrl = "http://example.com/notfound.png";

      expect(() => preloader.getAsset(mockUrl)).toThrow("Asset not preloaded");
    });
  });

  describe("getAssetOrFetch", () => {
    it("should return cached asset if available", async () => {
      // Use an actual URL from ReportContent
      const mockUrl = ReportContent.IMAGE_URLS.COMPASS_LOGO;
      mockGetBase64Image.mockResolvedValue("data:image/png;base64,mockdata");

      await preloader.preloadAllAssets();
      mockGetBase64Image.mockClear();

      const asset = await preloader.getAssetOrFetch(mockUrl);

      expect(asset).toBe("data:image/png;base64,mockdata");
      expect(mockGetBase64Image).not.toHaveBeenCalled();
    });

    it("should fetch asset if not in cache", async () => {
      const mockUrl = "http://example.com/newimage.png";
      mockGetBase64Image.mockResolvedValue("data:image/png;base64,newdata");

      const asset = await preloader.getAssetOrFetch(mockUrl);

      expect(asset).toBe("data:image/png;base64,newdata");
      expect(mockGetBase64Image).toHaveBeenCalledWith(mockUrl);
    });
  });

  describe("clear", () => {
    it("should clear cache and reset preloaded state", async () => {
      mockGetBase64Image.mockResolvedValue("data:image/png;base64,mockdata");

      await preloader.preloadAllAssets();
      expect(preloader.isLoaded).toBe(true);
      expect(preloader.cacheSize).toBeGreaterThan(0);

      preloader.clear();

      expect(preloader.isLoaded).toBe(false);
      expect(preloader.cacheSize).toBe(0);
    });
  });

  describe("getCache", () => {
    it("should return the underlying cache Map", async () => {
      mockGetBase64Image.mockResolvedValue("data:image/png;base64,mockdata");

      await preloader.preloadAllAssets();
      const cache = preloader.getCache();

      expect(cache).toBeInstanceOf(Map);
      expect(cache.size).toBe(expectedAssetCount);
    });
  });
});
