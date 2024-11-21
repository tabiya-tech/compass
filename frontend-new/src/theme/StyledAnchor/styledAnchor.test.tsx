import { render, screen } from "src/_test_utilities/test-utils";
import { StyledAnchor } from "./StyledAnchor";

describe("Styled Anchor tests", () => {
  describe("render tests", () => {
   test("should render correctly default state", () => {
     // GIVEN href and children
     const givenHref = "foo";
     const givenChildren = "bar";

     // AND a data test id.
     const givenDataTestId = "foo-bar";

     // WHEN the component is rendered
     render(<StyledAnchor
       href={givenHref}
       disabled={false}
       data-testid={givenDataTestId}
       children={givenChildren}
     />)

     // THEN it should render an anchor element with the href and children.
     const anchor = screen.getByTestId(givenDataTestId);

     expect(anchor).toBeInTheDocument();
     expect(anchor).toHaveAttribute("href", givenHref);
     expect(anchor).toHaveAttribute("data-testid", givenDataTestId);
     expect(anchor).toHaveTextContent(givenChildren);

     // AND it should not be disabled.
     expect(anchor).not.toHaveAttribute("disabled");
     expect(anchor).toHaveAttribute("aria-disabled", "false");

     // AND it should match the snapshot.
     expect(anchor).toMatchSnapshot();
   })

    test("should render correctly disabled state", () => {
      // GIVEN href and children
      const givenHref = "foo";
      const givenChildren = "bar";

      // AND a data test id.
      const givenDataTestId = "foo-bar";

      // WHEN the component is rendered
      render(<StyledAnchor
        href={givenHref}
        disabled={true}
        data-testid={givenDataTestId}
        children={givenChildren}
      />)

      // THEN it should render an anchor element with the href and children.
      const anchor = screen.getByTestId(givenDataTestId);

      expect(anchor).toBeInTheDocument();
      expect(anchor).toHaveAttribute("href", givenHref);
      expect(anchor).toHaveAttribute("data-testid", givenDataTestId);
      expect(anchor).toHaveTextContent(givenChildren);

      // AND it should be disabled.
      expect(anchor).toHaveAttribute("aria-disabled", "true");

      // AND it should match the snapshot.
      expect(anchor).toMatchSnapshot()
    });
  });

  describe("action tests", () => {
    test("should call onClick when not disabled", () => {
      // GIVEN an onClick handler
      const onClick = jest.fn();

      // AND the component is rendered with the onClick handler and not disabled.
      render(<StyledAnchor
        href="foo"
        disabled={false}
        onClick={onClick}
      />);

      // WHEN the anchor is clicked
      screen.getByRole("link").click();

      // THEN the onClick handler should be called
      expect(onClick).toHaveBeenCalled();
    })

    test("should not call onClick when disabled", () => {
      // GIVEN an onClick handler
      const onClick = jest.fn();

      // AND the component is rendered with the onClick handler and disabled.
      render(<StyledAnchor
        href="foo"
        disabled={true}
        onClick={onClick}
      />);

      // WHEN the anchor is clicked
      screen.getByRole("link").click();

      // THEN the onClick handler should not be called
      expect(onClick).not.toHaveBeenCalled();
    })
  })
});
