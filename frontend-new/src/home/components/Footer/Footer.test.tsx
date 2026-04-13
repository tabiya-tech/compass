import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import { routerPaths } from "src/app/routerPaths";
import Footer, { DATA_TEST_ID, EXTERNAL_URLS } from "./Footer";

describe("Footer", () => {
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
    // AND the contact link is in the document
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_CONTACT_LINK)).toBeInTheDocument();
    // AND the collaboration section is in the document
    expect(screen.getByTestId(DATA_TEST_ID.FOOTER_COLLABORATION)).toBeInTheDocument();
    // AND to match the snapshot
    expect(footerContainer).toMatchSnapshot();
  });

  test("should open privacy, terms, and contact in a new tab via href", () => {
    render(<Footer />);
    const privacyHref = `${window.location.origin}/#${routerPaths.PRIVACY_POLICY}`;
    const termsHref = `${window.location.origin}/#${routerPaths.TERMS_OF_USE}`;

    const privacyLink = screen.getByTestId(DATA_TEST_ID.FOOTER_PRIVACY_LINK);
    const termsLink = screen.getByTestId(DATA_TEST_ID.FOOTER_TERMS_LINK);
    const contactLink = screen.getByTestId(DATA_TEST_ID.FOOTER_CONTACT_LINK);

    expect(privacyLink).toHaveAttribute("href", privacyHref);
    expect(privacyLink).toHaveAttribute("target", "_blank");
    expect(privacyLink).toHaveAttribute("rel", "noopener noreferrer");

    expect(termsLink).toHaveAttribute("href", termsHref);
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(termsLink).toHaveAttribute("rel", "noopener noreferrer");

    expect(contactLink).toHaveAttribute("href", EXTERNAL_URLS.CONTACT);
    expect(contactLink).toHaveAttribute("target", "_blank");
    expect(contactLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});
