// mute chatty console
import "src/_test_utilities/consoleMock";

import InfoService from "./info.service";
import infoURL from "./info.constants";

import { VersionItem } from "./info.types";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import * as CustomFetchModule from "src/utils/customFetch/customFetch";

describe("InfoService", () => {
  describe("Test the loadInfoFromUrl function", () => {
    afterAll(() => {
      jest.restoreAllMocks();
      // reset the instance cache
      InfoService.getInstance().clearCache();
      // reset method mocks
      resetAllMethodMocks(InfoService.getInstance());
    });

    function setupFetchMock(expectedBody: any): jest.Mock {
      const expectedResponse = new Response(expectedBody);
      const mockFetch = jest.fn().mockResolvedValueOnce(expectedResponse);
      jest.spyOn(CustomFetchModule, "customFetch").mockImplementation(mockFetch);
      return mockFetch;
    }

    test("should fetch and return the infoProps object from the provided URL", async () => {
      // GIVEN some URL that returns some info data structure
      const someURL: string = "url";
      const expectedData: VersionItem = {
        date: "foo",
        branch: "bar",
        buildNumber: "baz",
        sha: "goo",
      };
      const mockFetch = setupAPIServiceSpy(200, JSON.stringify(expectedData), "application/json;charset=UTF-8");

      // WHEN the loadInfoFromUrl function is called for that URL
      const service = InfoService.getInstance();
      const actualResult = await service.loadInfoFromUrl(someURL);

      // THEN it returns that data structure from the given url
      expect(mockFetch).toHaveBeenCalledWith(someURL, {
        method: "GET",
        headers: { "content-type": "application/json" },
        expectedStatusCode: 200,
        serviceName: "InfoService",
        serviceFunction: "loadInfoFromUrl",
        failureMessage: `Failed to load info from ${someURL}`,
        expectedContentType: "application/json",
        authRequired: false,
        retryOnFailedToFetch: true
      });
      expect(actualResult).toMatchObject(expectedData);
    });

    test("should return an info object with empty values when the fetched data is a malformed json", async () => {
      // GIVEN some URL that returns some info data structure
      const someURL: string = "url";
      const malformedJSON: string = "{";
      const mockFetch = setupFetchMock(malformedJSON);

      // WHEN the loadInfoFromUrl function is called for that URL
      const service = InfoService.getInstance();
      const actualResult = await service.loadInfoFromUrl(someURL);

      // THEN it returns info object with empty values
      expect(mockFetch).toHaveBeenCalledWith(someURL, {
        method: "GET",
        headers: { "content-type": "application/json" },
        expectedStatusCode: 200,
        serviceName: "InfoService",
        serviceFunction: "loadInfoFromUrl",
        failureMessage: `Failed to load info from ${someURL}`,
        expectedContentType: "application/json",
        authRequired: false,
        retryOnFailedToFetch: true
      });
      expect(actualResult).toMatchObject({ date: "", branch: "", buildNumber: "", sha: "" });

      // AND an error should be logged
      expect(console.error).toHaveBeenCalled()
    });

    test.each([{}, { foo: "bar" }, null])(
      "should return an info object with empty values when the fetched data is not a valid info data json structure: '%s'",
      async (jsonData) => {
        // GIVEN some URL that returns some info data structure
        const someURL: string = "url";
        const mockFetch = setupFetchMock(JSON.stringify(jsonData));

        // WHEN the loadInfoFromUrl function is called for that URL
        const service = InfoService.getInstance();
        const actualResult = await service.loadInfoFromUrl(someURL);

        // THEN it returns info object with empty values
        expect(mockFetch).toHaveBeenCalledWith(someURL, {
          method: "GET",
          headers: { "content-type": "application/json" },
          expectedStatusCode: 200,
          serviceName: "InfoService",
          serviceFunction: "loadInfoFromUrl",
          failureMessage: `Failed to load info from ${someURL}`,
          expectedContentType: "application/json",
          authRequired: false,
          retryOnFailedToFetch: true,
        });
        expect(actualResult).toMatchObject({ date: "", branch: "", buildNumber: "", sha: "" });
      }
    );

    test("should return an info object with empty values when the fetching the data fails with a HTTP error", async () => {
      // GIVEN some URL that fails with an HTTP error
      const someURL: string = "url";
      const expectedResponse = new Response(
        JSON.stringify({
          reason: "some reason",
          detail: "some detail",
        }),
        { status: 500 }
      );
      const mockFetch = jest.fn().mockRejectedValueOnce(expectedResponse);
      jest.spyOn(CustomFetchModule, "customFetch").mockImplementation(mockFetch);

      // WHEN the loadInfoFromUrl function is called for that URL
      const service = InfoService.getInstance();
      const actualResult = await service.loadInfoFromUrl(someURL);

      // THEN it returns info object with empty values
      expect(mockFetch).toHaveBeenCalledWith(someURL, {
        method: "GET",
        headers: { "content-type": "application/json" },
        expectedStatusCode: 200,
        serviceName: "InfoService",
        serviceFunction: "loadInfoFromUrl",
        failureMessage: `Failed to load info from ${someURL}`,
        expectedContentType: "application/json",
        authRequired: false,
        retryOnFailedToFetch: true
      });
      expect(actualResult).toMatchObject({ date: "", branch: "", buildNumber: "", sha: "" });

      // AND an error should be logged
      expect(console.error).toHaveBeenCalled()
    });
  });

  describe("Test the loadInfo function", () => {
    test("should fetch and return the frontend and backend info data", async () => {
      // GIVEN the backend info url responds with the expected backend info data
      // AND the frontend info url responds with the expected frontend info data
      const service = InfoService.getInstance();
      const expectedFrontendInfoData: VersionItem = {
        date: "fooFrontend",
        branch: "barFrontend",
        buildNumber: "bazFrontend",
        sha: "gooFrontend",
      };
      const expectedBackendInfoData: VersionItem = {
        date: "fooBackend",
        branch: "barBackend",
        buildNumber: "bazBackend",
        sha: "gooBackend",
      };

      jest.spyOn(service, "loadInfoFromUrl").mockImplementation((url: string) => {
        if (url === infoURL.frontend) {
          return Promise.resolve(expectedFrontendInfoData);
        } else if (url === infoURL.backend) {
          return Promise.resolve(expectedBackendInfoData);
        } else {
          return Promise.reject(new Error("Unexpected url"));
        }
      });
      // WHEN the loadInfo function is called
      const result = await service.loadInfo();
      // THEN it returns the expected frontend and backend info data in the expected order
      expect(result).toEqual({
        frontend: expectedFrontendInfoData,
        backend: expectedBackendInfoData,
      });
    });

    test("should call the correct frontend and backend urls", async () => {
      // WHEN the loadInfo function is called
      const service = InfoService.getInstance();
      jest.spyOn(service, "loadInfoFromUrl").mockImplementation(() =>
        Promise.resolve({
          date: "",
          branch: "",
          buildNumber: "",
          sha: "",
        })
      );
      await service.loadInfo();
      // THEN it calls the correct frontend and backend urls
      expect(service.loadInfoFromUrl).toHaveBeenCalledWith(infoURL.frontend);
      expect(service.loadInfoFromUrl).toHaveBeenCalledWith(infoURL.backend);
    });
  });
});
