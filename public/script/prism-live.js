/**
	Prism Live: Code editor based on Prism.js
	Works best in Chrome. Currently only very basic support in other browsers (no snippets, no shortcuts)
	@author Lea Verou
*/
(function () {
  if (Prism.Live) return;
  var $ = Bliss;
  var ready = Promise.resolve();
  var superKey =
    navigator.platform.indexOf("Mac") === 0 ? "metaKey" : "ctrlKey";

  var _ = (Prism.Live = class PrismLive {
    constructor(source) {
      const existing = _.all.get(source);
      if (existing) return existing;
      this.controller = new AbortController();
      this.bind = (element, events) => {
        for (const [types, handler] of Object.entries(events)) {
          for (const type of types.split(/\s+/)) element.addEventListener(type, handler, { signal: this.controller.signal });
        }
      };
      this.source = source;
      this.sourceType = source.nodeName.toLowerCase();

      // The build ships the visible surface. Hydrate it in place instead of
      // replacing it after first paint. Bare dynamic sources still work.
      this.serverRendered = this.sourceType === "textarea" && this.source.parentElement?.matches('[data-editor-shell]');
      if (this.serverRendered) {
        this.wrapper = this.source.parentElement;
        this.textarea = this.source;
        this.pre = this.wrapper.querySelector(':scope > pre');
        this.code = this.pre.querySelector('code');
        const value = this.textarea.value;
        const display = value + (/\n$/.test(value) ? "\u200b" : "");
        if (this.code.textContent === display) this.lastValue = value;
      } else {
        this.wrapper = $.create({ className: "prism-live", around: this.source });
        if (this.sourceType === "textarea") {
          this.textarea = this.source;
          this.code = $.create("code");
          this.pre = $.create("pre", {
            className: this.textarea.className + " no-whitespace-normalization",
            contents: this.code,
            before: this.textarea,
          });
        } else {
          this.pre = this.source;
          this.pre.classList.add("no-whitespace-normalization");
          this.code = $("code", this.pre);
          this.textarea = $.create("textarea", {
            className: this.pre.className,
            value: this.pre.textContent,
            after: this.pre,
          });
        }
      }

      _.all.set(this.wrapper, this);
      _.all.set(this.textarea, this);
      _.all.set(this.pre, this);
      _.all.set(this.code, this);

      this.pre.classList.add("prism-live");
      this.textarea.classList.add("prism-live");
      this.source.classList.add("prism-live-source");

      if (self.Incrementable) {
        // TODO data-* attribute for modifier
        // TODO load dynamically if not present
        new Incrementable(this.textarea);
      }

      this._enterHandled = false;

      this.bind(this.textarea, {
        input: (evt) => {
          this.scheduleUpdate();

          // Auto-dedent when typing closing brace
          if (evt.data === "}") {
            this.handleClosingBrace();
          }
        },
        focus: () => this.update(),
        "editor-refresh": () => this.update(),
        compositionstart: () => { this.composing = true; },
        compositionend: () => { this.composing = false; this.scheduleUpdate(); },

        keydown: (evt) => {
          if (this.textarea.readOnly || this.textarea.disabled || evt.isComposing || this.composing) return;
          const primaryOnly = evt[superKey] && !evt.altKey &&
            !(superKey === "metaKey" ? evt.ctrlKey : evt.metaKey);
          if (!evt.defaultPrevented && primaryOnly && evt.key === "Enter") {
            evt.preventDefault();
            this._enterHandled = true;
            this.insertLine(evt.shiftKey);
            return;
          }
          // Danish Shift+7 produces '/', while code identifies the physical 7
          // key even when the browser reports a different shifted character.
          if (!evt.defaultPrevented && primaryOnly && evt.shiftKey &&
              (evt.code === "Digit7" || (!evt.code && evt.key === "/"))) {
            evt.preventDefault();
            this.update();
            this.toggleComment();
            return;
          }
          if (!evt.defaultPrevented && evt.altKey && !evt.ctrlKey && !evt.metaKey &&
              (evt.key === "ArrowUp" || evt.key === "ArrowDown")) {
            evt.preventDefault();
            this.editLines(evt.key === "ArrowDown" ? 1 : -1, evt.shiftKey);
            return;
          }
          // DOM-based shortcuts must see the latest highlighted text.
          if (evt.key === "Tab" || evt.ctrlKey || evt.metaKey) this.update();
          if (evt.key == "Enter") {
            // Handle Enter with smart indentation
            var indent = this.currentIndent;
            var before = this.beforeCaret();
            var after = this.afterCaret();
            var charBeforeCaret = before.slice(-1);
            var charAfterCaret = after.charAt(0);

            // Check if we're between { and }
            if (charBeforeCaret === "{" && charAfterCaret === "}") {
              evt.preventDefault();
              this._enterHandled = true;
              // Insert newline + indent + newline + base indent, position caret on middle line
              var newIndent = indent + this.indent;
              this.insert("\n" + newIndent + "\n" + indent);
              // Move caret back to the indented line
              this.selectionStart = this.selectionEnd =
                this.selectionStart - indent.length - 1;
              this.update();
              this.syncScroll();
            } else if (charBeforeCaret === "{") {
              evt.preventDefault();
              this._enterHandled = true;
              this.insert("\n" + indent + this.indent);
              this.update();
              this.syncScroll();
            } else {
              this._enterHandled = false;
            }
          } else if (evt.key == "Tab" && !evt.altKey) {
            // Default is to move focus off the textarea
            // this is never desirable in an editor
            evt.preventDefault();

            if (this.tabstops && this.tabstops.length > 0) {
              // We have tabstops to go
              this.moveCaret(this.tabstops.shift());
            } else if (this.hasSelection) {
              var before = this.beforeCaret("\n");
              var outdent = evt.shiftKey;

              this.selectionStart -= before.length;

              var selection = _.adjustIndentation(this.selection, {
                relative: true,
                indentation: outdent ? -1 : 1,
              });

              this.replace(selection);

              if (outdent) {
                var indentStart = _.regexp.gm`^${this.indent}`;
                var isBeforeIndented = indentStart.test(before);
                this.selectionStart +=
                  before.length + 1 - (outdent + isBeforeIndented);
              } else {
                // Indent
                var hasLineAbove = before.length == this.selectionStart;
                this.selectionStart += before.length + 1 + !hasLineAbove;
              }
            } else {
              // Nothing selected, expand snippet
              var selector = _.match(this.beforeCaret(), /\S*$/);
              var snippetExpanded = this.expandSnippet(selector);

              if (snippetExpanded) {
                $.fire(this.textarea, "input");
              } else {
                this.insert(this.indent);
              }
            }
          } else if (_.pairs[evt.key]) {
            var other = _.pairs[evt.key];
            this.wrapSelection({
              before: evt.key,
              after: other,
              outside: true,
            });
            evt.preventDefault();
          } else {
            for (let shortcut in _.shortcuts) {
              if (_.checkShortcut(shortcut, evt)) {
                _.shortcuts[shortcut].call(this, evt);
                evt.preventDefault();
              }
            }
          }
        },

        keyup: (evt) => {
          if (this.textarea.readOnly || this.textarea.disabled || evt.isComposing || this.composing) return;
          if (evt.key == "Enter" && !this._enterHandled) {
            // Maintain indent on regular line breaks (when not handled by keydown)
            this.insert(this.currentIndent);
            this.syncScroll();
          }
          this._enterHandled = false;
        },

        "click keyup": (evt) => {
          if (!evt.key || evt.key.lastIndexOf("Arrow") > -1) {
            // Caret moved
            this.tabstops = null;
          }
        },
      });

      this.textarea.addEventListener("scroll", this, { passive: true, signal: this.controller.signal });
      this.syncStyles();

      this.update();
      this.lang = (this.code.className.match(/lang(?:uage)?-(\w+)/i) || [,])[1];

      this.source.dispatchEvent(
        new CustomEvent("prism-live-init", { bubbles: true, detail: this })
      );
    }

    handleEvent(evt) {
      if (evt.type === "scroll") {
        this.syncScroll();
      }
    }

    scheduleUpdate() {
      if (this.destroyed || this.highlightFrame) return;
      this.highlightFrame = requestAnimationFrame(() => {
        this.highlightFrame = 0;
        this.update();
        this.syncScroll();
      });
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.controller.abort();
      this.onDestroy?.();
      cancelAnimationFrame(this.highlightFrame);
      this.worker?.terminate();
      for (const node of [this.source, this.textarea, this.pre, this.code, this.wrapper]) _.all.delete(node);
      this.source.classList.remove("prism-live-source");
      if (!this.serverRendered) this.wrapper.replaceWith(this.source);
    }

    expandSnippet(text) {
      if (!text) {
        return false;
      }

      var context = this.context;

      if (text in context.snippets || text in _.snippets) {
        // Static Snippets
        var expansion = context.snippets[text] || _.snippets[text];
      } else if (context.snippets.custom) {
        var expansion = context.snippets.custom.call(this, text);
      }

      if (expansion) {
        // Insert snippet
        var stops = [];
        var replacement = [];
        var str = expansion;
        var match;

        while ((match = _.CARET_INDICATOR.exec(str))) {
          stops.push(match.index + 1);
          replacement.push(str.slice(0, match.index + match[1].length));
          str = str.slice(match.index + match[0].length);
          _.CARET_INDICATOR.lastIndex = 0;
        }

        replacement.push(str);
        replacement = replacement.join("");

        if (stops.length > 0) {
          // make first stop relative to end, all others relative to previous stop
          stops[0] -= replacement.length;
        }

        this.delete(text);
        this.insert(replacement, { matchIndentation: true });
        this.tabstops = stops;
        this.moveCaret(this.tabstops.shift());
      }

      return !!expansion;
    }

    get selectionStart() {
      return this.textarea.selectionStart;
    }
    set selectionStart(v) {
      this.textarea.selectionStart = v;
    }

    get selectionEnd() {
      return this.textarea.selectionEnd;
    }
    set selectionEnd(v) {
      this.textarea.selectionEnd = v;
    }

    get hasSelection() {
      return this.selectionStart != this.selectionEnd;
    }

    get selection() {
      return this.value.slice(this.selectionStart, this.selectionEnd);
    }

    get value() {
      return this.textarea.value;
    }
    set value(v) {
      this.textarea.value = v;
    }

    get indent() {
      return _.match(this.value, /^[\t ]+/m, _.DEFAULT_INDENT);
    }

    get currentIndent() {
      var before = this.value.slice(0, this.selectionStart - 1);
      return _.match(before, /^[\t ]*/gm, "", -1);
    }

    // Handle auto-dedent when typing closing brace
    handleClosingBrace() {
      var pos = this.selectionStart;
      var value = this.value;

      // Get the current line up to caret
      var lineStart = value.lastIndexOf("\n", pos - 2) + 1;
      var lineBeforeBrace = value.slice(lineStart, pos - 1);

      // Only auto-dedent if line is only whitespace before the }
      if (!/^\s*$/.test(lineBeforeBrace)) return;

      // Find matching opening brace
      var beforeBrace = value.slice(0, pos - 1);
      var braceDepth = 0;
      var matchPos = -1;

      for (var i = beforeBrace.length - 1; i >= 0; i--) {
        if (beforeBrace[i] === "}") braceDepth++;
        else if (beforeBrace[i] === "{") {
          if (braceDepth === 0) {
            matchPos = i;
            break;
          }
          braceDepth--;
        }
      }

      if (matchPos === -1) return;

      // Get indentation of the line with the opening brace
      var openLineStart = beforeBrace.lastIndexOf("\n", matchPos) + 1;
      var openLineIndent = _.match(
        beforeBrace.slice(openLineStart),
        /^[\t ]*/,
        ""
      );

      // Replace current line's indentation with matching indentation
      var newValue =
        value.slice(0, lineStart) + openLineIndent + "}" + value.slice(pos);
      var newCaretPos = lineStart + openLineIndent.length + 1;

      this.value = newValue;
      this.selectionStart = this.selectionEnd = newCaretPos;
      $.fire(this.textarea, "input");
      this.update();
    }

    // Current language at caret position
    get currentLanguage() {
      var node = this.getNode();
      node = node ? node.parentNode : this.code;
      var lang = _.match(
        (node.closest('[class*="language-"]') || this.pre).className,
        /language-(\w+)/,
        1
      );
      return _.aliases[lang] || lang;
    }

    // Get settings based on current language
    get context() {
      var lang = this.currentLanguage;
      return _.languages[lang] || _.languages.DEFAULT;
    }

    update(force) {
      if (this.destroyed) return;
      cancelAnimationFrame(this.highlightFrame);
      this.highlightFrame = 0;
      const value = this.value;
      if (!force && (this.lastValue === value || (this.worker && this.pendingValue === value))) return;
      const code = value + (/\n$/.test(value) ? "\u200b" : "");
      this.code.textContent = code;
      this.lastValue = undefined;
      if (value.length > 16000) {
        // Tokenize large pastes off the main thread. Discard stale results and
        // terminate obsolete work instead of queuing behind a pathological regex.
        this.worker?.terminate();
        try {
          const worker = new Worker('/script/prism-worker.js');
          this.worker = worker;
          this.pendingValue = value;
          worker.onmessage = ({ data }) => {
            worker.terminate();
            if (this.worker === worker) this.worker = null;
            if (this.destroyed || this.value !== value || data.code !== code) return;
            this.code.innerHTML = data.html;
            const env = { element: this.code, code, language: data.language };
            Prism.hooks.run("after-highlight", env);
            Prism.hooks.run("complete", env);
            this.lastValue = value;
            this.syncScroll();
          };
          worker.onerror = () => { worker.terminate(); if (this.worker === worker) this.worker = null; };
          worker.postMessage({ code, language: Prism.util.getLanguage(this.pre) });
        } catch { /* Keep the plain text overlay if workers are unavailable. */ }
        return;
      }
      this.worker?.terminate();
      this.worker = null;
      try {
        Prism.highlightElement(this.code);
        this.lastValue = value;
      } catch {
        // Malformed/large input must remain editable even if a grammar fails.
        this.code.textContent = code;
      }
    }

    syncStyles() {
      if (this.destroyed || this.source.closest(".is-hidden") || !this.wrapper.getClientRects().length) return;
      // Copy pre metrics over to textarea
      var cs = getComputedStyle(this.pre);

      // Copy styles from <pre> to textarea
      this.textarea.style.caretColor = cs.color;

      const properties = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariationSettings", "fontFeatureSettings", "lineHeight", "letterSpacing", "tabSize"];
      for (const prop of properties) {
        if (this.wrapper.style[prop] !== cs[prop]) this.wrapper.style[prop] = cs[prop];
        this.textarea.style[prop] = this.pre.style[prop] = "inherit";
      }

      // This is primarily for supporting the line-numbers plugin.
      this.textarea.style["padding-left"] = cs["padding-left"];

      this.update();
    }

    syncScroll() {
      if (this.pre.clientWidth === 0 && this.pre.clientHeight === 0) {
        return;
      }

      this.pre.scrollTop = this.textarea.scrollTop;
      this.pre.scrollLeft = this.textarea.scrollLeft;
    }

    beforeCaretIndex(until = "") {
      return this.value.lastIndexOf(until, this.selectionStart);
    }

    afterCaretIndex(until = "") {
      return this.value.indexOf(until, this.selectionEnd);
    }

    beforeCaret(until = "") {
      var index = this.beforeCaretIndex(until);

      if (index === -1 || !until) {
        index = 0;
      }

      return this.value.slice(index, this.selectionStart);
    }

    getLine(offset = this.selectionStart) {
      var value = this.value;
      var lf = "\n",
        cr = "\r";
      var start, end, char;

      for (var start = this.selectionStart; (char = value[start]); start--) {
        if (char === lf || char === cr || !start) {
          break;
        }
      }

      for (var end = this.selectionStart; (char = value[end]); end++) {
        if (char === lf || char === cr) {
          break;
        }
      }

      return { start, end };
    }

    afterCaret(until = "") {
      var index = this.afterCaretIndex(until);

      if (index === -1 || !until) {
        index = undefined;
      }

      return this.value.slice(this.selectionEnd, index);
    }

    setCaret(pos) {
      this.selectionStart = this.selectionEnd = pos;
    }

    moveCaret(chars) {
      if (chars) {
        this.setCaret(this.selectionEnd + chars);
      }
    }

    insert(text, { index } = {}) {
      if (!text) {
        return;
      }

      this.textarea.focus();

      if (index === undefined) {
        // No specified index, insert in current caret position
        this.replace(text);
      } else {
        // Specified index, first move caret there
        var start = this.selectionStart;
        var end = this.selectionEnd;

        this.selectionStart = this.selectionEnd = index;
        this.replace(text);

        this.selectionStart = start + (index < start ? text.length : 0);
        this.selectionEnd = end + (index <= end ? text.length : 0);
      }
    }

    // Replace currently selected text
    replace(text) {
      var hadSelection = this.hasSelection;

      this.insertText(text);

      if (hadSelection) {
        // By default inserText places the caret at the end, losing any selection
        // What we want instead is the replaced text to be selected
        this.selectionStart = this.selectionEnd - text.length;
      }
    }

    // Set text between indexes and restore caret position
    set(text, { start, end } = {}) {
      var ss = this.selectionStart;
      var se = this.selectionEnd;

      this.selectionStart = start;
      this.selectionEnd = end;

      this.insertText(text);

      this.selectionStart = ss;
      this.selectionEnd = se;
    }

    insertLine(above = false) {
      const source = this.textarea;
      const value = source.value;
      // Use the active end of a selection, without replacing selected text.
      const caret = source.selectionDirection === "backward"
        ? source.selectionStart : source.selectionEnd;
      const start = value.slice(0, caret).lastIndexOf("\n") + 1;
      const newline = value.indexOf("\n", caret);
      const end = newline === -1 ? value.length : newline;
      const line = value.slice(start, end);
      let indent = line.match(/^[\t ]*/)[0];
      if (!above && /\{\s*$/.test(line)) indent += this.indent;
      const position = above ? start : end;
      // Replace the line for insertion above: WebKit adds an extra newline
      // when inserting a tab + newline before an existing tab-only line.
      const text = above ? indent + "\n" + line : "\n" + indent;
      source.setSelectionRange(position, above ? end : position);
      this.insertText(text);
      const nextCaret = position + indent.length + (above ? 0 : 1);
      source.setSelectionRange(nextCaret, nextCaret);
      this.tabstops = null;
      this.syncScroll();
    }

    // Move/copy whole logical lines in one native edit, preserving the caret or
    // selection within the block. A selection ending at column 0 excludes that line.
    editLines(direction, copy = false) {
      const source = this.textarea;
      if (source.readOnly || source.disabled || this.composing) return;
      const value = source.value;
      const ss = source.selectionStart, se = source.selectionEnd;
      const selectionDirection = source.selectionDirection;
      const start = value.slice(0, ss).lastIndexOf("\n") + 1;
      const last = se > ss && value[se - 1] === "\n" ? se - 1 : se;
      const newline = value.indexOf("\n", last);
      const end = newline === -1 ? value.length : newline;
      const block = value.slice(start, end);
      let from = start, to = end, text, offset;

      if (copy) {
        from = to = direction < 0 ? start : end;
        text = direction < 0 ? block + "\n" : "\n" + block;
        offset = direction < 0 ? 0 : block.length + 1;
      } else if (direction < 0) {
        if (start === 0) return;
        from = value.slice(0, start - 1).lastIndexOf("\n") + 1;
        text = block + "\n" + value.slice(from, start - 1);
        offset = from - start;
      } else {
        if (end === value.length) return;
        const nextNewline = value.indexOf("\n", end + 1);
        to = nextNewline === -1 ? value.length : nextNewline;
        const next = value.slice(end + 1, to);
        text = next + "\n" + block;
        offset = next.length + 1;
      }

      source.setSelectionRange(from, to);
      this.insertText(text);
      source.setSelectionRange(ss + offset, se + offset, selectionDirection);
      this.tabstops = null;
      this.syncScroll();
    }

    insertText(text) {
      if (typeof text !== "string" || (!text && !this.hasSelection) ||
          this.textarea.readOnly || this.textarea.disabled) return false;
      // Retain native undo where supported. A successful replacement can leave
      // the value unchanged, so testing value inequality can insert it twice.
      try {
        if (document.execCommand?.(text ? "insertText" : "delete", false, text)) return true;
      } catch { /* Fall through to the textarea API. */ }
      this.textarea.setRangeText(text, this.selectionStart, this.selectionEnd, "end");
      $.fire(this.textarea, "input");
      return false;
    }

    /**
     * Wrap text with strings
     * @param before {String} The text to insert before
     * @param after {String} The text to insert after
     * @param start {Number} Character offset
     * @param end {Number} Character offset
     */
    wrap({
      before,
      after,
      start = this.selectionStart,
      end = this.selectionEnd,
    } = {}) {
      var ss = this.selectionStart;
      var se = this.selectionEnd;
      var between = this.value.slice(start, end);

      this.set(before + between + after, { start, end });

      if (ss > start) {
        ss += before.length;
      }

      if (se > start) {
        se += before.length;
      }

      if (ss > end) {
        ss += after.length;
      }

      if (se > end) {
        se += after.length;
      }

      this.selectionStart = ss;
      this.selectionEnd = se;
    }

    wrapSelection(o = {}) {
      var hadSelection = this.hasSelection;

      this.replace(o.before + this.selection + o.after);

      if (hadSelection) {
        if (o.outside) {
          // Do not include new text in selection
          this.selectionStart += o.before.length;
          this.selectionEnd -= o.after.length;
        }
      } else {
        this.moveCaret(-o.after.length);
      }
    }

    toggleComment() {
      const source = this.textarea;
      const ss = source.selectionStart, se = source.selectionEnd;
      const direction = source.selectionDirection;
      const value = source.value;
      const comments = this.context.comments;
      // At EOF there is no text node at the caret; inspect the preceding one.
      const node = this.getNode(ss) || (ss > 0 ? this.getNode(ss - 1) : null);
      const commentNode = node?.parentNode?.closest(".token.comment");
      let commentStart = commentNode ? this.getOffset(commentNode) : -1;
      let commentText = commentNode?.textContent;
      if (!commentNode && comments.multiline) {
        // A worker may still be highlighting. Recognize a wrapper around the
        // selection or whole line from current text, so rapid toggles work too.
        const [before, after] = comments.multiline;
        const start = ss === se ? value.slice(0, ss).lastIndexOf("\n") + 1 : ss - before.length;
        const newline = value.indexOf("\n", se);
        const end = ss === se ? (newline === -1 ? value.length : newline) : se + after.length;
        const text = value.slice(Math.max(0, start), end);
        if (start >= 0 && text.startsWith(before) && text.endsWith(after) &&
            text.indexOf(after, before.length) === text.length - after.length) {
          commentStart = start;
          commentText = text;
        }
      }
      if (commentStart >= 0) {
        const start = commentStart;
        const text = commentText;
        const end = start + text.length;
        const single = comments.singleline && text.startsWith(comments.singleline);
        const [before, after] = single ? [comments.singleline, ""] : comments.multiline || comments;
        const closing = after && text.endsWith(after) ? after.length : 0;
        const content = text.slice(before.length, text.length - closing);
        const map = position => position <= start ? position
          : position >= end ? position - before.length - closing
          : Math.max(start, Math.min(position - before.length, start + content.length));
        source.setSelectionRange(start, end);
        this.insertText(content);
        source.setSelectionRange(map(ss), map(se), direction);
      } else {
        const [before, after] = comments.multiline || comments;
        const start = ss === se ? value.slice(0, ss).lastIndexOf("\n") + 1 : ss;
        const newline = value.indexOf("\n", se);
        const end = ss === se ? (newline === -1 ? value.length : newline) : se;
        source.setSelectionRange(start, end);
        this.insertText(before + value.slice(start, end) + after);
        source.setSelectionRange(ss + before.length, se + before.length, direction);
      }
      this.tabstops = null;
      this.syncScroll();
    }

    duplicateContent() {
      var before = this.beforeCaret("\n");
      var after = this.afterCaret("\n");
      var text = before + this.selection + after;

      this.insert(text, { index: this.selectionStart - before.length });
    }

    delete(characters, { forward, pos } = {}) {
      var i = (characters =
        characters > 0 ? characters : (characters + "").length);

      if (pos) {
        var selectionStart = this.selectionStart;
        this.selectionStart = pos;
        this.selectionEnd = pos + this.selectionEnd - selectionStart;
      }

      while (i--) {
        document.execCommand(forward ? "forwardDelete" : "delete");
      }

      if (pos) {
        // Restore caret
        this.selectionStart = selectionStart - characters;
        this.selectionEnd = this.selectionEnd - pos + this.selectionStart;
      }
    }

    /**
     * Get the text node at a given chracter offset
     */
    getNode(offset = this.selectionStart, container = this.code) {
      var node,
        sum = 0;
      var walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

      while ((node = walk.nextNode())) {
        sum += node.data.length;

        if (sum >= offset) {
          return node;
        }
      }

      // if here, offset is larger than maximum
      return null;
    }

    /**
     * Get the character offset of a given node in the highlighted source
     */
    getOffset(node) {
      var range = document.createRange();
      range.selectNodeContents(this.code);
      range.setEnd(node, 0);
      return range.toString().length;
    }

    // Utility method to get regex matches
    static match(str, regex, def, index = 0) {
      if (typeof def === "number" && arguments.length === 3) {
        index = def;
        def = undefined;
      }

      var match = str.match(regex);

      if (match && index < 0) {
        index = match.length + index;
      }

      return match ? match[index] : def;
    }

    static checkShortcut(shortcut, evt) {
      return shortcut
        .trim()
        .split(/\s*\+\s*/)
        .every((key) => {
          switch (key) {
            case "Cmd":
              return evt[superKey];
            case "Ctrl":
              return evt.ctrlKey;
            case "Shift":
              return evt.shiftKey;
            case "Alt":
              return evt.altKey;
            default:
              return evt.key === key;
          }
        });
    }

    static registerLanguage(name, context, parent = _.languages.DEFAULT) {
      Object.setPrototypeOf(context, parent);
      return (_.languages[name] = context);
    }

    static matchIndentation(text, currentIndent) {
      // FIXME this assumes that text has no indentation of its own
      // to make this more generally useful beyond snippets, we should first
      // strip text's own indentation.
      text = text.replace(/\r?\n/g, "$&" + currentIndent);
    }

    static adjustIndentation(
      text,
      { indentation, relative = true, indent = _.DEFAULT_INDENT }
    ) {
      if (!relative) {
        // First strip min indentation
        var minIndent = text.match(_.regexp.gm`^(${indent})+`).sort()[0];

        if (minIndent) {
          text.replace(_.regexp.gm`^${minIndent}`, "");
        }
      }

      if (indentation < 0) {
        return text.replace(_.regexp.gm`^${indent}`, "");
      } else if (indentation > 0) {
        // Indent
        return text.replace(/^/gm, indent);
      }
    }
  });

  // Static properties
  Object.assign(_, {
    all: new WeakMap(),
    ready,
    DEFAULT_INDENT: "\t",
    CARET_INDICATOR: /(^|[^\\])\$(\d+)/g,
    snippets: {
      test: "Snippets work!",
    },
    pairs: {
      "(": ")",
      "[": "]",
      "{": "}",
      '"': '"',
      "'": "'",
      "`": "`",
    },
    shortcuts: {
      "Cmd + /": function () {
        this.toggleComment();
      },
      "Ctrl + Shift + D": function () {
        this.duplicateContent();
      },
    },
    languages: {
      DEFAULT: {
        comments: {
          multiline: ["/*", "*/"],
        },
        snippets: {},
      },
    },
    // Map of Prism language ids and their canonical name
    aliases: (() => {
      var ret = {};
      var canonical = new WeakMap(
        Object.entries(Prism.languages)
          .map((x) => x.reverse())
          .reverse()
      );

      for (var id in Prism.languages) {
        var grammar = Prism.languages[id];

        if (typeof grammar !== "function") {
          ret[id] = canonical.get(grammar);
        }
      }

      return ret;
    })(),

    regexp: (() => {
      var escape = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      var _regexp = (flags, strings, ...values) => {
        var pattern =
          strings[0] +
          values.map((v, i) => escape(v) + strings[i + 1]).join("");
        return RegExp(pattern, flags);
      };
      var cache = {};

      return new Proxy(_regexp.bind(_, ""), {
        get: (t, property) => {
          return (
            t[property] ||
            cache[property] ||
            (cache[property] = _regexp.bind(_, property))
          );
        },
      });
    })(),
  });


})();
