---
title: Afgræns navngiven timeline
id: test-1
draft: true
video: /assets/vid/sda/sda-ex-1.webm
debug: false
help:
  {
    link: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-range,
    topic: animation-range,
  }
startingCSS: |
  .container {
    position: relative;
  }
  .progress {
    animation: spin linear both;
  }
  @keyframes spin {
    from {
      scale: 0 1;
    }
  }
startingHTML: |
  <div class="inner">
    <div class="progress"></div>
  </div>
hints:
  - { type: property, name: animation-range }
  - { type: value, name: entry }
  - { type: value, name: cover }
  - { type: value, name: "entry 0% entry 100%" }
---

Begræns animationen til kun at køre mens containeren er på vej ind i viewporten vha. `animation-range` `entry`.

Prøv derefter specifikke procenter som `entry 0% entry 100%` for finere kontrol over start- og sluttidspunkt.
