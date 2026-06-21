# TCET Header Image

Place the official TCET header image (`.png` format) in this directory.

## Expected asset

```
templates/
  tcet-header.png
```

## Recommended format

| Property | Value |
|---|---|
| Format | PNG |
| Dimensions | 960 × 137 pixels (or similar wide aspect ratio ~7:1) |
| Mode | RGB / RGBA |

## How it's used

The `WordTemplateBuilder` and `PdfExporter` load this file at generation time from `templates/tcet-header.png` relative to the project root. The template engine scales it proportionally to fit the A4 page width (preserving aspect ratio).

## Updating the branding

To replace the header (e.g. when TCET updates its branding):

1. Replace `templates/tcet-header.png` with the new image
2. Keep the filename and path unchanged
3. Keep the aspect ratio roughly similar (wide, ~7:1)
4. No code changes needed

Every newly generated paper will use the updated header automatically.

## Fallback

If the file is missing, the template builder skips the header image gracefully and generates the paper without it. Only the header image is affected — all other content remains unchanged.
