import React from "react";
import { render, screen } from "@testing-library/react";
import CustomLink from "./CustomLink";

describe("CustomLink", () => {
    test("renders the link with the correct text", () => {
        // GIVEN the component is rendered with a given text and href
        const givenText = "Hello";
        const givenHref = "#foo";
        render(<CustomLink href={givenHref}>{givenText}</CustomLink>);
        // THEN the link with the correct text is rendered
        expect(screen.getByText(givenText)).toBeInTheDocument();
        // AND the link has the correct href
        expect(screen.getByRole("link")).toHaveAttribute("href", givenHref);
    });
}); 