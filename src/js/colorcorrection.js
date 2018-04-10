export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;

  if (max === min) {
    h = 0;
    s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else if (max === b) {
      h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return [h, s, l];
}


function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h, s, l) {
  let r;
  let g;
  let b;

  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r * 255, g * 255, b * 255];
}

const hexRegex = /#([a-fA-F0-9]{2,})([a-fA-F0-9]{2,})([a-fA-F0-9]{2,})/;
const rgbRegex = /rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?\)/;

export function colorToRGB(color) {
  let match = hexRegex.exec(color);
  if (match) {
    return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
  }
  match = rgbRegex.exec(color);
  if (match) {
    return [parseFloat(match[1], 10), parseFloat(match[2], 10), parseFloat(match[3], 10)];
  }
  throw new Error(`Couldnt parse color: ${color}`);
}

// formulae taken from https://www.w3.org/TR/AERT/#color-contrast
export function getBrightness(rgb) {
  return rgb[0] * 0.299 + rgb[1] * 0.578 + rgb[2] * 0.114;
}

const colorCorrectionCache = {};

export function fixContrastHSL(bg, fg) {
  if (colorCorrectionCache[`${bg}-${fg}`]) return colorCorrectionCache[`${bg}-${fg}`];

  const fgHsl = rgbToHsl(...colorToRGB(fg));
  const bgHsl = rgbToHsl(...colorToRGB(bg));
  const bgBrightness = getBrightness(colorToRGB(bg));
  let fgBrightness = getBrightness(colorToRGB(fg));

  if (bgBrightness < 50 && fgBrightness < bgBrightness) {
    // dark backgrounds never have colors darker than them
    fgBrightness = bgBrightness;
  }
  if (bgBrightness > 150 && fgBrightness > bgBrightness) {
    // bright backgrounds never have colors bright than them
    fgBrightness = bgBrightness;
  }

  const extremeL = bgHsl[2] > 0.5 ? 0 : 1;
  const eps = 5;
  let count = 0;
  while ((Math.sqrt(bgBrightness) - Math.sqrt(fgBrightness)) < 4 && count++ < 5) {
    fgHsl[2] = (fgHsl[2] * eps + extremeL) / (1 + eps);
    const newFg = hslToRgb(...fgHsl);
    fgBrightness = getBrightness(newFg);
  }

  const res = `hsl(${fgHsl[0] * 360}, ${fgHsl[1] * 100}%, ${fgHsl[2] * 100}%)`;

  colorCorrectionCache[`${bg}-${fg}`] = res;
  return res;
}
