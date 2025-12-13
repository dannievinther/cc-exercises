---
title: Afgræns navngiven timeline
id: test-5
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
  img {
    animation: move both linear;
    animation-timeline: scroll();
    animation-range: 0 100cqh;
    z-index: 0;
    max-block-size: 100cqh;
    object-fit: cover;
  }
  @keyframes move {
    to {
      opacity: 0;
      translate: 0 75cqh;
    }
  }
startingHTML: |
  <div class="container">
    <img src="/assets/imgs/demo.jpg" alt="">
  </div>
  <div style="height:100%"></div>
hints:
  - { type: property, name: animation-range }
  - { type: value, name: entry }
  - { type: value, name: cover }
  - { type: value, name: "entry 0% entry 100%" }
---

Begræns animationen til kun at køre mens containeren er på vej ind i viewporten vha. `animation-range` `entry`.

Prøv derefter specifikke procenter som `entry 0% entry 100%` for finere kontrol over start- og sluttidspunkt.
