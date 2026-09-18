export const paletteColors = [
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;

export type PaletteColor = (typeof paletteColors)[number];
export type ColorScheme = "light" | "dark" | "black";
type ColorPair = { text: string; background: string };
type ColorPalette = {
  canvas: string;
  defaultText: string;
  colors: Record<PaletteColor, ColorPair>;
};

export const pastelPalettes: Record<ColorScheme, ColorPalette> = {
  light: {
    canvas: "#ffffff",
    defaultText: "#343732",
    colors: {
      gray: { text: "#5f625d", background: "#eceee9" },
      brown: { text: "#795548", background: "#f0e5df" },
      red: { text: "#a94552", background: "#f8dfe2" },
      orange: { text: "#92551f", background: "#f8e7d4" },
      yellow: { text: "#766116", background: "#f7efc9" },
      green: { text: "#3f7254", background: "#dff0e5" },
      blue: { text: "#386b91", background: "#deebf5" },
      purple: { text: "#6e5a96", background: "#eae3f4" },
      pink: { text: "#92506d", background: "#f5e1eb" },
    },
  },
  dark: {
    canvas: "#20231f",
    defaultText: "#d8ded2",
    colors: {
      gray: { text: "#c5c8c1", background: "#363a35" },
      brown: { text: "#d7b6a5", background: "#403a35" },
      red: { text: "#f0a9b1", background: "#44373a" },
      orange: { text: "#efbd8b", background: "#423a32" },
      yellow: { text: "#e4d587", background: "#403d31" },
      green: { text: "#9ed3ae", background: "#334039" },
      blue: { text: "#9fc9e7", background: "#333d43" },
      purple: { text: "#c4b1e6", background: "#3b3844" },
      pink: { text: "#e4abc6", background: "#423740" },
    },
  },
  black: {
    canvas: "#000000",
    defaultText: "#e2e5df",
    colors: {
      gray: { text: "#c9ccc6", background: "#242624" },
      brown: { text: "#dabaa9", background: "#2c2825" },
      red: { text: "#f3adb5", background: "#302629" },
      orange: { text: "#f2c08e", background: "#302a24" },
      yellow: { text: "#e8d98a", background: "#2e2c23" },
      green: { text: "#a2d7b2", background: "#243029" },
      blue: { text: "#a4cdeb", background: "#242d33" },
      purple: { text: "#c8b5ea", background: "#2a2732" },
      pink: { text: "#e8afca", background: "#30272d" },
    },
  },
};

export function applyColorPalette(element: HTMLElement, scheme: ColorScheme) {
  for (const color of paletteColors) {
    const pair = pastelPalettes[scheme].colors[color];
    element.style.setProperty(`--lotion-${color}-text`, pair.text);
    element.style.setProperty(`--lotion-${color}-background`, pair.background);
    element.style.setProperty(
      `--bn-colors-highlights-${color}-text`,
      pair.text,
    );
    element.style.setProperty(
      `--bn-colors-highlights-${color}-background`,
      pair.background,
    );
  }
}
