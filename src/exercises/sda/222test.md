---
title: Afgræns navngiven timeline
id: test-1
draft: true
video: /assets/vid/sda/sda-ex-1.webm
debug: false
scrollDirection: inline
help:
  {
    link: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-range,
    topic: animation-range,
  }
startingCSS: |
  .container {
    display: flex;
    gap: 20px;
  }
  .box {
    flex-shrink: 0;
    width: 40%;
    animation: spin linear both;
    animation-timeline: view(inline);
  }
  @keyframes spin {
    entry 0%,
    exit 100% {
      scale: .5;
    }
    entry 50%,
    exit 50% {
      scale: 1;
    }
  }
startingHTML: |
  <div style="width:50cqw"></div>

  <div class="box">I'm a box</div>
  <div class="box">I'm a box</div>
  <div class="box">I'm a box</div>
  <div class="box">I'm a box</div>
  <div class="box">I'm a box</div>
  <div class="box">I'm a box</div>
  <div class="box">I'm a box</div>
  <div class="box">I'm a box</div>

  <div style="width:50cqw"></div>
hints:
  - { type: property, name: animation-range }
  - { type: value, name: entry }
  - { type: value, name: cover }
  - { type: value, name: "entry 0% entry 100%" }
---

Begræns animationen til kun at køre mens containeren er på vej ind i viewporten vha. `animation-range` `entry`.

Prøv derefter specifikke procenter som `entry 0% entry 100%` for finere kontrol over start- og sluttidspunkt.
