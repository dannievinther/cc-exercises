import { runInNewContext } from 'node:vm';
import prismSource from '../../public/script/prism-custom.min.js?raw';
import { displayCode, lineNumbersMarkup } from '../js/editor-content.js';

// Run the existing browser grammar in an isolated build-time context. Both the
// static view and live/worker highlighting therefore use the same Prism build.
const Prism = runInNewContext(`${prismSource}\n;Prism;`, {});

export function highlightedEditor(value, language) {
  const code = displayCode(value);
  return Prism.highlight(code, Prism.languages[language], language) + lineNumbersMarkup(code);
}
