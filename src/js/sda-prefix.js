// Import the parser directly so the client does not ship PostCSS's plugin pipeline.
import SafeParser from 'postcss-safe-parser/lib/safe-parser.js';
import Input from 'postcss/lib/input';
import valueParser from 'postcss-value-parser';
import { simulateViewportHeight } from './sda-viewport.js';

const keyframes = /^(?:-webkit-)?keyframes$/i;
const shorthandKeywords = new Set(('none initial inherit unset revert revert-layer linear ease ease-in ease-out ease-in-out step-start step-end infinite normal reverse alternate alternate-reverse forwards backwards both running paused auto').split(' '));
let animationStyle;

function decode(value) {
  return value.replace(/\\([0-9a-f]{1,6}\s?|[^\r\n\f])/gi, (_, escaped) => {
    if (!/^[0-9a-f]/i.test(escaped)) return escaped;
    const point = parseInt(escaped, 16);
    return String.fromCodePoint(point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? point : 0xfffd);
  });
}

// Parse once per rendered frame. A tolerant source parser preserves incomplete
// edits, comments and pending var() shorthands that CSSOM serialization loses.
export function sdaPrefix(css, key) {
  const parser = new SafeParser(new Input(simulateViewportHeight(css), { from: undefined, map: false }));
  parser.parse();
  const root = parser.root;
  const names = new Map();
  root.walkAtRules((rule) => {
    if (!keyframes.test(rule.name)) return;
    const params = valueParser(rule.params);
    const token = params.nodes.find((node) => node.type === 'word' || node.type === 'string');
    if (!token) return;
    const name = decode(token.value);
    names.set(name, `${key}--${name}`);
    token.value = token.type === 'string' ? names.get(name) : CSS.escape(names.get(name));
    rule.params = params.toString();
  });

  const aliases = new Map();
  function rewrite(value, shorthand = false) {
    const parsed = valueParser(value);
    function walk(nodes) {
      for (const token of nodes) {
        if (token.type === 'function') {
          if (token.value.toLowerCase() !== 'var') continue;
          const variable = token.nodes.find((node) => node.type === 'word');
          if (variable?.value.startsWith('--')) {
            const original = variable.value;
            const id = `${shorthand ? 'shorthand' : 'name'}:${original}`;
            if (!aliases.has(id)) aliases.set(id, { original, shorthand, name: `--${key}-${shorthand ? 'animation' : 'animation-name'}-${original.slice(2)}` });
            variable.value = CSS.escape(aliases.get(id).name);
          }
          const comma = token.nodes.findIndex((node) => node.type === 'div' && node.value === ',');
          if (comma >= 0) walk(token.nodes.slice(comma + 1));
        } else if (token.type === 'word' || token.type === 'string') {
          if (shorthand && token.type === 'word' && shorthandKeywords.has(token.value.toLowerCase())) continue;
          const name = names.get(decode(token.value));
          if (name) token.value = token.type === 'string' ? name : CSS.escape(name);
        }
      }
    }
    walk(parsed.nodes);
    return parsed.toString();
  }

  const declarations = [];
  root.walkDecls((decl) => declarations.push(decl));
  for (const decl of declarations) {
    if (/^(?:-webkit-)?animation-name$/i.test(decl.prop)) decl.value = rewrite(decl.value);
    else if (/^(?:-webkit-)?animation$/i.test(decl.prop)) {
      if (/\bvar\(/i.test(decl.value)) decl.value = rewrite(decl.value, true);
      else {
        // A single-declaration CSSOM parse disambiguates shorthand keywords:
        // in "linear 1s linear" only the second "linear" names the keyframes.
        animationStyle ??= document.createElement('span').style;
        animationStyle.cssText = '';
        animationStyle.setProperty('animation', decl.value);
        const value = animationStyle.getPropertyValue('animation-name');
        const scoped = rewrite(value);
        if (value && scoped !== value) decl.cloneAfter({ prop: decl.prop.replace(/animation$/i, 'animation-name'), value: scoped });
      }
    }
  }
  // Scope animation variables through aliases. Their original values remain
  // available to color/content/etc., with cascade and !important preserved.
  for (const { original, name, shorthand } of aliases.values()) {
    for (const decl of declarations) if (decl.prop === original) {
      decl.cloneAfter({ prop: name, value: rewrite(decl.value, shorthand) });
    }
  }

  const rules = [];
  root.walkRules((rule) => rules.push(rule));
  const scope = `[data-exercise-key="${CSS.escape(key)}"] .sda-result`;
  for (const rule of rules) {
    let nested = false;
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type === 'rule' || (parent.type === 'atrule' && keyframes.test(parent.name))) nested = true;
    }
    if (!nested) {
      const wrapper = rule.clone({ selector: scope, nodes: [] });
      rule.replaceWith(wrapper);
      wrapper.append(rule);
    }
  }
  return root.toString();
}
