---
name: anti-generic-design
description: Anti-generic UI design system directive based on huts.com, naleka.xyz, and pear.no reverse engineering. Prevents AI slop layouts with asymmetric grids, 3D card flips, sticky scrollytelling, alternating back-and-forth sections, editorial display typography, and human copywriting.
---

# Anti-Generic Design Directive (Huts.com & Naleka Protocol)

This skill strictly enforces anti-generic UI design patterns derived from reverse-engineering **huts.com**, **naleka.xyz**, and **pear.no**. It prevents AI slop, uniform grids, and boilerplate SaaS templates.

## 1. Absolute Layout Rules (Anti-Slop Grid & Flow)
- **Asymmetric Grid Ratios**: Never make all cards in a grid identical size. Use 1 featured card (span 2 / 60-70% width) and smaller secondary cards.
- **Alternating Section Flow**: Consecutive showcase sections MUST alternate directions (`back-and-forth` media-left/text-right → `reverse` text-left/media-right).
- **Sticky Scrollytelling & Card Sliders**: Include horizontal scroll containers (`.h-scroll-container`) or sticky section highlights pinned on scroll.
- **Interactive 3D Card Flips**: Use dual-sided cards (`.card-front` clean visual + title, `.card-back` detailed specs + action) with 3D perspective transition.
- **Custom Section Dividers**: Place visual section dividers (`divider-arrow` or SVG vector connectors) between major content blocks.
- **Section Tone Shift**: Shift background color between key sections (e.g. Warm Cream `#FFFDFA` → Deep Forest `#0C310A` or Mono Midnight `#070C18` → Deep Navy `#0D1527`).

## 2. Typography & Color Palette
- **High-Contrast Display Scale**: Contrast display headers (32px–148px serif/editorial display) with ultra-clean, tracked sans body.
- **Huts.com Palette**: Warm Cream (`#FFFDFA`, `#FAF7ED`), Deep Forest Green (`#0C310A`, `#57772E`), Terracotta/Earth (`#664A42`), Charcoal (`#1E1414`).
- **Naleka Palette**: Mono Navy (`#070C18`, `#0D1527`), Burnt Orange / Electric Blue accents (`#3E6BFF`, `#FF6B35`), Off-white typography.

## 3. Human & Editorial Copywriting
- **Conversational Transitions**: Use natural human transitions ("Whatever type of place you have in mind", "It all starts with...", "...and we work with you to make it yours", "But, don't take it from us...").
- **Specific Metaphors**: Replace generic buzzwords ("seamless", "next-gen", "all-in-one platform") with contextual brand metaphors.

## 4. Execution Directive for Codebase
Whenever building or modifying UI components in `apps/demo` or any frontend codebase:
1. Enforce asymmetric grid ratios on catalog & trust cards.
2. Implement 3D flip card interactions for feature cards or standards.
3. Include an alternating back-and-forth media/text section block.
4. Ensure section backgrounds shift dynamically with smooth visual hierarchy.
5. Add sticky horizontal card sliders for interactive feature exploration.
