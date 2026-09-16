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
      gray: { text: "#c5c8c1", background: "#3b3e39" },
      brown: { text: "#d7b6a5", background: "#49372f" },
      red: { text: "#f0a9b1", background: "#512f34" },
      orange: { text: "#efbd8b", background: "#4d3826" },
      yellow: { text: "#e4d587", background: "#463f25" },
      green: { text: "#9ed3ae", background: "#294334" },
      blue: { text: "#9fc9e7", background: "#293e4d" },
      purple: { text: "#c4b1e6", background: "#3a324d" },
      pink: { text: "#e4abc6", background: "#49303d" },
    },
  },
  black: {
    canvas: "#000000",
    defaultText: "#e2e5df",
    colors: {
      gray: { text: "#c9ccc6", background: "#292b28" },
      brown: { text: "#dabaa9", background: "#382820" },
      red: { text: "#f3adb5", background: "#402328" },
      orange: { text: "#f2c08e", background: "#3d2a1b" },
      yellow: { text: "#e8d98a", background: "#373118" },
      green: { text: "#a2d7b2", background: "#1d3326" },
      blue: { text: "#a4cdeb", background: "#1d3040" },
      purple: { text: "#c8b5ea", background: "#2d263f" },
      pink: { text: "#e8afca", background: "#39232f" },
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
