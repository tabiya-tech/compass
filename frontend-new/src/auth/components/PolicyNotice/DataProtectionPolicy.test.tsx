import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import DataProtectionAgreement, { DATA_TEST_ID } from "./DataProtectionPolicy";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { HashRouter } from "react-router-dom";

// mock the snack bar provider
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

describe("Testing Register component with AuthProvider", () => {
  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  test("it should show data protection policy successfully", async () => {
    // WHEN the component is rendered
    render(
      <HashRouter>
        <DataProtectionAgreement />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.DPA_CONTAINER)).toBeDefined();

    // AND the agreement body should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.AGREEMENT_BODY)).toBeInTheDocument();

    // AND the accept button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON)).toBeInTheDocument();

    // AND WHEN the accept button is clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));

    // Expect a message to be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Data Protection Agreement Accepted", {
      variant: "success",
    });

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.DPA_CONTAINER)).toMatchSnapshot();
  });
});
