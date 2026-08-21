# Blix

<p align="center">
  <img src="public/logo.png" alt="Blix" width="96" />
</p>

<p align="center">
  <strong>Match film scans to iPhone time and place.</strong>
</p>

<p align="center">
  A browser tool for analog photographers: embed timestamps and GPS from iPhone photos onto film scans so they sort and map correctly in Apple Photos.
</p>

---

## Features

- **Timeline matching** — Use iPhone photos as time anchors to date a roll of film
- **GPS coordinates** — Transfer location data so scans appear on the map in Apple Photos
- **TIFF support** — Works with high-quality TIFF scans, preserving original image data
- **Batch renaming** — Optional prefix and sequential numbering on export
- **Private by design** — Photos are processed in the browser. Nothing is uploaded.
- **Multiple rolls** — Process several rolls in one session, reusing the same iPhone reference set

## How it works

1. **Upload** — Add iPhone photos (accurate timestamps) and film scans
2. **Anchors** — Pair the first and last frames of the roll with iPhone photos
3. **Timeline** — Match remaining frames, or let Blix interpolate between anchors
4. **Rename** — Optionally set a filename prefix and starting number
5. **Export** — Download a ZIP with EXIF (and GPS) written into each scan

## Tech stack

- **App**: TypeScript, Vite, vanilla DOM
- **EXIF**
  - [exifr](https://github.com/MikeKovarik/exifr) — read EXIF from iPhone photos
  - [piexifjs](https://github.com/hMatoba/piexifjs) — write EXIF to JPEGs
  - Custom TIFF IFD writer for TIFF metadata
- **Images**: [UTIF](https://github.com/nicksrandall/utif) for TIFF decode
- **Export**: [JSZip](https://github.com/Stuk/jszip)
- **Deploy**: static Vite site (Vercel or any static host)

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/rubenRP/film-photo-sync.git
cd film-photo-sync

npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
```

## Deployment

### Vercel

1. Push the repository to GitHub
2. Import it in [Vercel](https://vercel.com)
3. Deploy

The app is a static site. Image files never leave the browser.

## Usage

### Preparing photos

1. **iPhone** — Export photos from the same period as the roll. They need accurate timestamps; GPS is used when present.
2. **Film scans** — JPEG (`.jpg` / `.jpeg`), TIFF (`.tif` / `.tiff`, recommended), or PNG.

### Tips

- Photograph the start and end of each roll with the iPhone so anchors are obvious
- More iPhone frames on the timeline generally mean better interpolation
- For GPS, match a film frame to an iPhone photo taken at the same place

### Output

Each exported file includes:

- **DateTime** / **DateTimeOriginal** / **DateTimeDigitized** — capture time
- **GPS** — from the matched iPhone photo, or the nearest GPS-bearing frame by time

TIFF files stay uncompressed with metadata written into the IFD. Other formats are exported as JPEG with EXIF.

The download is named `blix.zip`.

## Privacy

Matching, interpolation, EXIF writing, and ZIP creation all run in the browser. Photos never leave this device.

## License

MIT. See [LICENSE](LICENSE).
