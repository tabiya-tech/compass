import { getActiveToken } from "./getActiveToken";
import { jwtDecode } from "jwt-decode";
import { auth } from "src/auth/firebaseConfig";

jest.mock("jwt-decode");
jest.mock("src/auth/firebaseConfig");
jest.mock("src/app/PersistentStorageService/PersistentStorageService");

describe("getActiveToken", () => {
  const mockJwtDecode = jwtDecode as jest.Mock;
  const mockAuth = auth.currentUser?.getIdToken as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a new token if no token is available", async () => {
    // GIVEN the mocked tokne.
    const givenMockedToken = "mocked.token";
    mockAuth.mockResolvedValue(givenMockedToken);
    mockJwtDecode.mockReturnValue({ exp: Date.now() / 1000 - 10 });

    // WHEN we call the function.
    const actualToken = await getActiveToken();

    // THEN we should get the mocked token.
    expect(actualToken).toBe(givenMockedToken);

    // AND we should have called the auth function.
    expect(mockAuth).toHaveBeenCalledWith(true);
  });

  it("should return a new token if the stored token is expired", async () => {
    // GIVEN the mocked tokne.
    const givenMockedToken = "mocked.token";

    mockJwtDecode.mockReturnValue({ exp: Date.now() / 1000 - 10 });
    mockAuth.mockResolvedValue(givenMockedToken);

    // WHEN we call the function.
    const token = await getActiveToken();

    // THEN we should get the mocked token.
    expect(token).toBe(givenMockedToken);
    expect(mockAuth).toHaveBeenCalledWith(true);
  });

  it("should return a new token if the stored token is about to expire", async () => {
    // GIVEN the mocked tokne.
    const givenMockedToken = "mocked.token";

    mockJwtDecode.mockReturnValue({ exp: Date.now() / 1000 + 100 });
    mockAuth.mockResolvedValue(givenMockedToken);

    // WHEN we call the function.
    const token = await getActiveToken();

    // THEN we should get the mocked token.
    expect(token).toBe(givenMockedToken);
    expect(mockAuth).toHaveBeenCalledWith(true);
  });
});
