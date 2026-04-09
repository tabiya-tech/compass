import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import React from "react";
import { render, screen, userEvent } from "src/_test_utilities/test-utils";
import Footer, { DATA_TEST_ID, EXTERNAL_URLS } from "./Footer";

describe("Footer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, "open", {
      value: jest.fn(),
      writable: true,
    });
  });

  test("should render the footer container, logos, links, and collaboration text", () => {
    // GIVEN the Footer component
    const givenComponent = <Footer />;

    // WHEN the Footer is rendered
    render(givenComponent);

    // THEN the footer container is in the document
    const footerContainer = screen.getByTestId(DATA_TEST_ID.FOOTER_CONTAINER);
    expect(footerContainer).toBeInTheDocument();
    // AND the logo container is in the document
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_LOGOS_CONTAINER)).toBeInTheDocument();
    // AND the World Bank logo is displayed
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_WORLD_BANK_LOGO)).toBeInTheDocument();
    // AND the Ministry Tech logo is displayed
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_MINISTRY_TECH_LOGO)).toBeInTheDocument();
    // AND the Tabiya logo is displayed
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_TABIYA_LOGO)).toBeInTheDocument();
    // AND the privacy link is in the document
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_PRIVACY_LINK)).toBeInTheDocument();
    // AND the term link is in the document
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_TERMS_LINK)).toBeInTheDocument();
    // AND the accessibility link is in the document
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_ACCESSIBILITY_LINK)).toBeInTheDocument();
    // AND the contact link is in the document
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_CONTACT_LINK)).toBeInTheDocument();
    // AND the collaboration section is in the document
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_COLLABORATION)).toBeInTheDocument();
    // AND to match the snapshot
    expect(footerContainer).toMatchSnapshot();
  });

  test("should open all external links in new tabs", async () => {
    // GIVEN the Footer is rendered
    render(<Footer />);
    // AND the expected URLs for each link
    const privacyUrl = EXTERNAL_URLS.PRIVACY_POLICY;
    const termsUrl = EXTERNAL_URLS.TERMS_OF_USE;
    const accessibilityUrl = EXTERNAL_URLS.ACCESSIBILITY;
    const contactUrl = EXTERNAL_URLS.CONTACT;

    // WHEN the external links are clicked
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.FOOTER_PRIVACY_LINK));
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.FOOTER_TERMS_LINK));
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.FOOTER_ACCESSIBILITY_LINK));
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.FOOTER_CONTACT_LINK));

    // THEN window.open is called with the correct URLs
    expect(window.open).toHaveBeenCalledTimes(4);
    expect(window.open).toHaveBeenCalledWith(privacyUrl, "_blank", "noopener,noreferrer");
    expect(window.open).toHaveBeenCalledWith(termsUrl, "_blank", "noopener,noreferrer");
    expect(window.open).toHaveBeenCalledWith(accessibilityUrl, "_blank", "noopener,noreferrer");
    expect(window.open).toHaveBeenCalledWith(contactUrl, "_blank", "noopener,noreferrer");
  });
});
