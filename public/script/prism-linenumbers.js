Prism.hooks.add("after-highlight", function (e) {
  var t = e.element.parentNode,
    s = /\s*\bline-numbers\b\s*/;
  if (
    t &&
    /pre/i.test(t.nodeName) &&
    (s.test(t.className) || s.test(e.element.className))
  ) {
    s.test(e.element.className) &&
      (e.element.className = e.element.className.replace(s, "")),
      s.test(t.className) || (t.className += " line-numbers");
    var a,
      n = 1 + e.code.split("\n").length,
      l = new Array(n);
    (l = l.join("<span></span>")),
      (a = document.createElement("span")),
      (a.className = "line-numbers-rows"),
      (a.innerHTML = l),
      t.hasAttribute("data-start") &&
        (t.style.counterReset =
          "linenumber " + (parseInt(t.getAttribute("data-start"), 10) - 1)),
      e.element.appendChild(a);
  }
});
