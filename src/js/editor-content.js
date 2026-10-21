// Textarea values use LF. Keep the display-only trailing-line marker out of
// the editable value, persistence and exports.
export function displayCode(value) {
  const text = value.replace(/\r\n?/g, '\n');
  return text + (text.endsWith('\n') ? '\u200b' : '');
}

export function lineCount(value) {
  return value.replace(/\r\n?/g, '\n').split('\n').length;
}

export function lineNumbersMarkup(value) {
  // One span per logical line, including an empty document and trailing lines.
  return `<span class="line-numbers-rows" aria-hidden="true">${'<span></span>'.repeat(lineCount(value))}</span>`;
}

export function installLineNumbers(Prism) {
  if (Prism.__lineNumbers) return;
  Prism.__lineNumbers = true;
  // Prism skips after-highlight for empty text, but always emits complete.
  Prism.hooks.add('complete', ({ element, code }) => {
    const pre = element.parentElement;
    if (!pre?.matches('pre') || !(pre.classList.contains('line-numbers') || element.classList.contains('line-numbers'))) return;
    element.classList.remove('line-numbers');
    pre.classList.add('line-numbers');
    element.querySelector(':scope > .line-numbers-rows')?.remove();
    element.insertAdjacentHTML('beforeend', lineNumbersMarkup(code));
    if (pre.hasAttribute('data-start')) pre.style.counterReset = `linenumber ${Number(pre.dataset.start) - 1}`;
  });
}
