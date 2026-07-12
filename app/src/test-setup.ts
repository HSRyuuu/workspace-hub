import "@testing-library/jest-dom";

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
});
