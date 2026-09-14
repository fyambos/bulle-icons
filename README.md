# @bulle/icons

Open source icon font.

Icons are drawn on a 24 unit grid with a 2 unit stroke. Some icons also have a filled version, named with `-fill` (`heart`, `heart-fill`).

## Install

```bash
npm i @bulle/icons
```

## Files

| File | Content |
|---|---|
| `dist/fonts/` | font in ttf, woff and woff2 |
| `dist/svg/<name>.svg` | one SVG per icon |
| `dist/sprite.svg` | all icons as `<symbol>`, for `<use href="#bi-heart">` |

## Commands

| Command | Result |
|---|---|
| `npm run lint:icons` | check of the icons |
| `npm run new -- <name> <category> <keyword>` | a new icon |

## Repository

```
icons/                source icons
meta/catalog.json     category and keywords of each icon
meta/codepoints.json  codepoint of each icon
build/                build scripts
tools/                lint and new icon scripts
dist/                 build output, not committed
```

## License

MIT. See [LICENSE](LICENSE).
