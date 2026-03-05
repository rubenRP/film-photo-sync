# Film Photo Sync

<p align="center">
  <img src="public/logo.png" alt="Film Photo Sync" width="120" />
</p>

<p align="center">
  <strong>Sync dates and GPS coordinates from iPhone photos to film scans</strong>
</p>

<p align="center">
  Perfect for organizing your analog photography in Apple Photos with accurate timestamps and locations.
</p>

---

## Features

- **Timeline Matching** — Use iPhone photos as time anchors to accurately date your film scans
- **GPS Coordinates** — Transfer location data so your photos appear on the map in Apple Photos
- **TIFF Support** — Works with high-quality TIFF scans, preserving original image data
- **Batch Renaming** — Rename files with custom prefixes and sequential numbering
- **100% Private** — All processing happens in your browser. No uploads to any server
- **Multiple Rolls** — Process multiple film rolls in one session with the same iPhone reference photos

## How It Works

1. **Upload** — Add your iPhone photos (with correct timestamps) and film scans
2. **Anchor** — Select the first and last film photos and match them to corresponding iPhone photos
3. **Match** — The app interpolates timestamps for all photos in between
4. **Rename** — Optionally add a filename prefix and numbering
5. **Export** — Download a ZIP with your film scans containing embedded EXIF data

## Tech Stack

- **Frontend**: TypeScript, Vite, Vanilla DOM
- **EXIF Processing**: 
  - [exifr](https://github.com/MikeKovarik/exifr) — Reading EXIF from iPhone photos
  - [piexifjs](https://github.com/hMatoba/piexifjs) — Writing EXIF to JPEGs
  - Custom TIFF IFD writer for TIFF metadata
- **Image Processing**: [UTIF](https://github.com/nicksrandall/utif) for TIFF decoding
- **Deployment**: Vercel Edge Functions for authentication

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/film-photo-sync.git
cd film-photo-sync

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and set your AUTH_PASSWORD
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add the environment variable:
   - `AUTH_PASSWORD`: Your chosen password for the login page
4. Deploy!

The `api/auth.ts` Edge Function handles authentication, keeping your password secure on the server.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AUTH_PASSWORD` | Password for the login page | Yes |

## Usage Guide

### Preparing Your Photos

1. **iPhone Photos**: Export photos from the same time period as your film roll. These should have accurate timestamps and GPS data.

2. **Film Scans**: Your scanned film photos. Supported formats:
   - JPEG (.jpg, .jpeg)
   - TIFF (.tif, .tiff) — recommended for quality
   - PNG (.png)

### Workflow Tips

- Take a photo with your iPhone at the **start** and **end** of each film roll for easy anchoring
- The more iPhone photos you have in your timeline, the more accurate the interpolation
- For best GPS accuracy, match film photos to iPhone photos taken at the same location

### Output

Exported files will have:
- **DateTime** — When the photo was taken
- **DateTimeOriginal** — Original capture time
- **DateTimeDigitized** — Digitization time (set to capture time)
- **GPS Coordinates** — From the matched or nearest iPhone photo

TIFF files are exported with metadata but remain uncompressed. JPEG and other formats are converted to JPEG with EXIF data.

## License

MIT License — feel free to use and modify for your own projects.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

<p align="center">
  Built for film photographers who want their scans organized properly 📷
</p>
