---
title: Scroll Another Div
id: test-6
draft: true
video: /assets/vid/sda/sda-ex-1.webm
debug: false
scrollDirection: block
help:
  {
    link: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-range,
    topic: animation-range,
  }
startingCSS: |
  .scrollport {
    timeline-scope: --scroll;
    display: grid;
    grid: auto / 1fr 1fr;
  }
  .scroller {
    overflow-y: auto;
    scroll-timeline: --scroll;
  }
  .box {
    place-self: center;
    animation: rotate linear both;
    animation-timeline: --scroll;
  }
  @keyframes rotate {
    to {
      rotate: 180deg;
    }
  }
startingHTML: |
  <div class="scroller" style="background:inherit">
    <div style="height:100%"></div>
    <div style="height:100%"></div>
  </div>
  <div class="sibling-container">
    <div class="box">Rotate me</div>
  </div>
hints:
  - { type: property, name: animation-range }
  - { type: value, name: entry }
  - { type: value, name: cover }
  - { type: value, name: "entry 0% entry 100%" }
---

Begræns animationen til kun at køre mens containeren er på vej ind i viewporten vha. `animation-range` `entry`.

Prøv derefter specifikke procenter som `entry 0% entry 100%` for finere kontrol over start- og sluttidspunkt.
