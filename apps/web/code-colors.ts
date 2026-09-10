/** Keep syntax hues, darkening only colors below 4.5:1 against #efe7d5. */
export function readableCodeColor(color: string): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return "#b4232d";
  let channels = color
    .slice(1)
    .match(/../g)!
    .map((part) => parseInt(part, 16));
  const luminance = (values: number[]) =>
    values
      .map((value) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const background = luminance([239, 231, 213]);
  while ((background + 0.05) / (luminance(channels) + 0.05) < 4.5)
    channels = channels.map((value) => Math.floor(value * 0.9));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
