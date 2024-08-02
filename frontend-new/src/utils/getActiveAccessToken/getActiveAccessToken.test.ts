import { getActiveAccessToken } from "./getActiveAccessToken";
import { jwtDecode } from "jwt-decode";
import { auth } from "src/auth/firebaseConfig";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

jest.mock("jwt-decode");
jest.mock("src/auth/firebaseConfig");
jest.mock("src/app/PersistentStorageService/PersistentStorageService");

describe("getActiveAccessToken", () => {
  const mockGetToken = PersistentStorageService.getToken as jest.Mock;
  const mockSetToken = PersistentStorageService.setToken as jest.Mock;
  const mockJwtDecode = jwtDecode as jest.Mock;
  const mockAuth = auth.currentUser?.getIdToken as jest.Mock;


  const mockDecodedToken = { exp: Date.now() / 1000 + 4000 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a new token if no token is available", async () => {
    // GIVEN the mocked tokne.
    const givenMockedToken = "mocked.token";

    mockGetToken.mockReturnValue(null);

    mockAuth.mockResolvedValue(givenMockedToken);

    // WHEN we call the function.
    const actualToken = await getActiveAccessToken();

    // THEN we should get the mocked token.
    expect(actualToken).toBe(givenMockedToken);

    // AND we should have called the auth function.
    expect(mockAuth).toHaveBeenCalledWith(true);

    // AND we should have set the token.
    expect(mockSetToken).toHaveBeenCalledWith(givenMockedToken);
  });

  it("should return the token from storage if it is valid", async () => {
    // GIVEN the mocked tokne.
    const givenMockedToken = "mocked.token";

    mockGetToken.mockReturnValue(givenMockedToken);
    mockJwtDecode.mockReturnValue(mockDecodedToken);

    // WHEN we call the function.
    const token = await getActiveAccessToken();

    // THEN we should get the mocked token.
    expect(token).toBe(givenMockedToken);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockSetToken).not.toHaveBeenCalled();
  });

  it("should return a new token if the stored token is expired", async () => {
    // GIVEN the mocked tokne.
    const givenMockedToken = "mocked.token";

    mockGetToken.mockReturnValue(givenMockedToken);
    mockJwtDecode.mockReturnValue({ exp: Date.now() / 1000 - 10 });
    mockAuth.mockResolvedValue(givenMockedToken);

    // WHEN we call the function.
    const token = await getActiveAccessToken();

    // THEN we should get the mocked token.
    expect(token).toBe(givenMockedToken);
    expect(mockAuth).toHaveBeenCalledWith(true);
    expect(mockSetToken).toHaveBeenCalledWith(givenMockedToken);
  });

  it("should return a new token if the stored token is about to expire", async () => {
    // GIVEN the mocked tokne.
    const givenMockedToken = "mocked.token";

    mockGetToken.mockReturnValue(givenMockedToken);
    mockJwtDecode.mockReturnValue({ exp: Date.now() / 1000 + 100 });
    mockAuth.mockResolvedValue(givenMockedToken);

    // WHEN we call the function.
    const token = await getActiveAccessToken();

    // THEN we should get the mocked token.
    expect(token).toBe(givenMockedToken);
    expect(mockAuth).toHaveBeenCalledWith(true);
    expect(mockSetToken).toHaveBeenCalledWith(givenMockedToken);
  });
});
