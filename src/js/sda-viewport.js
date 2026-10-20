// Treat the scrollport's size container as the viewport of SDA exercises.
export function simulateViewportHeight(css) {
  // Skip comments, strings, URLs and identifiers; replace only vh dimensions.
  return css.replace(
    /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|url\((?:\\[\s\S]|[^)\\])*\)|(?<![\w.-])([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)vh(?![\w-])/gi,
    (token, amount) => amount === undefined ? token : `${amount}cqh`
  );
}
