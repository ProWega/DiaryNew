import "../src/styles.css";

const preview = {
  parameters: {
    a11y: {
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
