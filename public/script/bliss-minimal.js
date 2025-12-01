/**
 * Minimal Bliss.js shim - only includes functions used by prism-live.js
 * This is ~80% smaller than the full bliss.js library
 */
(function () {
  "use strict";

  const Bliss = function (selector, context) {
    if (!selector) return null;
    if (typeof selector === "string") {
      return (context || document).querySelector(selector);
    }
    return selector;
  };

  // Query all matching elements
  Bliss.$ = function (selector, context) {
    if (selector instanceof Node || selector instanceof Window) {
      return [selector];
    }
    if (typeof selector === "string") {
      return Array.from((context || document).querySelectorAll(selector));
    }
    return Array.from(selector || []);
  };

  // Create element with properties
  Bliss.create = function (tag, options) {
    if (tag instanceof Node) {
      return Bliss.set(tag, options);
    }

    if (arguments.length === 1 && typeof tag === "object") {
      options = tag;
      tag = options.tag || "div";
      const newOptions = {};
      for (const key in options) {
        if (key !== "tag") newOptions[key] = options[key];
      }
      options = newOptions;
    }

    return Bliss.set(document.createElement(tag || "div"), options);
  };

  // Set properties on element
  Bliss.set = function (element, options) {
    if (!options || !element) return element;

    for (const property in options) {
      const value = options[property];

      if (property === "contents") {
        if (value instanceof Node) {
          element.appendChild(value);
        } else if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item instanceof Node) element.appendChild(item);
          });
        }
      } else if (property === "before") {
        value.parentNode.insertBefore(element, value);
      } else if (property === "after") {
        value.parentNode.insertBefore(element, value.nextSibling);
      } else if (property === "around") {
        value.parentNode.insertBefore(element, value);
        element.appendChild(value);
      } else if (property === "inside") {
        value.appendChild(element);
      } else if (property === "className") {
        element.className = value;
      } else if (property === "events") {
        Bliss.bind(element, value);
      } else if (property in element) {
        try {
          element[property] = value;
        } catch (e) {
          element.setAttribute(property, value);
        }
      } else {
        element.setAttribute(property, value);
      }
    }

    return element;
  };

  // Bind event listeners
  Bliss.bind = function (element, events) {
    for (const event in events) {
      const callback = events[event];
      const eventNames = event.split(/\s+/);
      eventNames.forEach((eventName) => {
        element.addEventListener(eventName, callback);
      });
    }
    return element;
  };

  // Fire custom event
  Bliss.fire = function (element, type, options) {
    const event = new CustomEvent(type, {
      bubbles: true,
      cancelable: true,
      ...options,
    });
    element.dispatchEvent(event);
    return event;
  };

  // DOM ready
  Bliss.ready = function (doc, callback) {
    if (typeof doc === "function") {
      callback = doc;
      doc = document;
    }

    // Default to document if not provided
    doc = doc || document;

    if (callback) {
      if (doc.readyState !== "loading") {
        callback();
      } else {
        doc.addEventListener("DOMContentLoaded", callback, { once: true });
      }
    }

    return new Promise((resolve) => {
      if (doc.readyState !== "loading") {
        resolve();
      } else {
        doc.addEventListener("DOMContentLoaded", resolve, { once: true });
      }
    });
  };

  // Load script
  Bliss.load = function (url, base) {
    if (base) {
      url = new URL(url, base).href;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(script);
    });
  };

  // Type checking
  Bliss.type = function (value) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    const type =
      Object.prototype.toString
        .call(value)
        .match(/^\[object\s+(.*?)\]$/)?.[1]
        ?.toLowerCase() || "";
    if (type === "number" && isNaN(value)) return "nan";
    return type;
  };

  // Extend objects
  Bliss.extend = function (target, source, filter) {
    for (const key in source) {
      if (!filter || (typeof filter === "function" ? filter(key) : true)) {
        target[key] = source[key];
      }
    }
    return target;
  };

  // Export
  self.Bliss = Bliss;
})();
