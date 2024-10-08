// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import "@testing-library/jest-dom/extend-expect";
// jest extended adds more matchers
// allows you to do things like:
// expect().toHaveBeenCalledBefore();
// learn more: https://jest-extended.jestcommunity.dev/docs/
import "jest-extended/all";
// pollyfill because jsdom does not support TextEncoder
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });
// mock firebase for tests
jest.mock("firebase/compat/app", () => require("src/_test_utilities/firebaseMock"));
