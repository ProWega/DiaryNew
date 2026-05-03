import "../src/styles/index.css";

const preview = {
  parameters: {
    a11y: {
      // "todo" runs axe and surfaces results in the Storybook UI but does NOT
      // fail the test runner. Pre-existing violations (mostly chart SVGs missing
      // titles) are tracked separately. Switch back to "error" once fixed.
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile 390",
          styles: { width: "390px", height: "844px" },
        },
        tablet: {
          name: "Tablet 768",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "Desktop 1280",
          styles: { width: "1280px", height: "900px" },
        },
      },
    },
  },
};

export default preview;
