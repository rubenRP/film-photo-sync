import exifr from "exifr";
import JSZip from "jszip";
import piexif from "piexifjs";
import * as UTIF from "utif";
import "./style.css";

const loginOverlay = document.querySelector<HTMLDivElement>("#login-overlay")!;
const loginForm = document.querySelector<HTMLFormElement>("#login-form")!;
const loginPassword = document.querySelector<HTMLInputElement>("#login-password")!;
const loginError = document.querySelector<HTMLParagraphElement>("#login-error")!;
const appContainer = document.querySelector<HTMLDivElement>("#app")!;

const SESSION_KEY = "film-sync-auth";

const checkAuth = () => {
  const isAuthenticated = sessionStorage.getItem(SESSION_KEY) === "true";
  if (isAuthenticated) {
    loginOverlay.classList.add("hidden");
    appContainer.classList.remove("hidden");
  }
  return isAuthenticated;
};

const handleLogin = async (e: Event) => {
  e.preventDefault();
  loginError.classList.add("hidden");

  const password = loginPassword.value;
  if (!password) return;

  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      sessionStorage.setItem(SESSION_KEY, "true");
      loginOverlay.classList.add("hidden");
      appContainer.classList.remove("hidden");
    } else {
      loginError.textContent = data.error || "Invalid password";
      loginError.classList.remove("hidden");
      loginPassword.value = "";
      loginPassword.focus();
    }
  } catch {
    loginError.textContent = "Login failed. Please try again.";
    loginError.classList.remove("hidden");
  }
};

loginForm.addEventListener("submit", handleLogin);
checkAuth();

type PhotoItem = {
  id: string;
  file: File;
  name: string;
  url: string;
  previewUrl?: string;
  date?: Date;
  tzOffset?: string;
  latitude?: number;
  longitude?: number;
  index: number;
};

type Assignment = {
  date: Date;
  matchedTo?: string;
  method: "matched" | "interpolated" | "clamped";
};

type RenameConfig = {
  prefix: string;
  startNumber: number;
};

const iphonePhotos: PhotoItem[] = [];
const filmPhotos: PhotoItem[] = [];
const matches = new Map<string, string>();
const filmCardMap = new Map<string, HTMLDivElement>();
const assignments = new Map<string, Assignment>();
const imageObservers = new Map<HTMLImageElement, IntersectionObserver>();

const renameConfig: RenameConfig = {
  prefix: "",
  startNumber: 1,
};

const anchors = {
  startFilmId: "" as string,
  startIphoneId: "" as string,
  endFilmId: "" as string,
  endIphoneId: "" as string,
};

const uploadSection = document.querySelector<HTMLElement>("#upload-section")!;
const rangeSection = document.querySelector<HTMLElement>("#range-section")!;
const timelineSection =
  document.querySelector<HTMLElement>("#timeline-section")!;
const renameSection = document.querySelector<HTMLElement>("#rename-section")!;
const exportSection = document.querySelector<HTMLElement>("#export-section")!;

const iphoneInput = document.querySelector<HTMLInputElement>("#iphone-input")!;
const filmInput = document.querySelector<HTMLInputElement>("#film-input")!;
const iphoneZone = document.querySelector<HTMLDivElement>("#iphone-zone")!;
const filmZone = document.querySelector<HTMLDivElement>("#film-zone")!;
const iphoneCount = document.querySelector<HTMLDivElement>("#iphone-count")!;
const filmCount = document.querySelector<HTMLDivElement>("#film-count")!;
const iphoneThumbs =
  document.querySelector<HTMLDivElement>("#iphone-thumbnails")!;
const filmThumbs = document.querySelector<HTMLDivElement>("#film-thumbnails")!;
const proceedToRange =
  document.querySelector<HTMLButtonElement>("#proceed-to-range")!;

const rangeFilm = document.querySelector<HTMLDivElement>("#range-film-photos")!;
const rangeIphone = document.querySelector<HTMLDivElement>(
  "#range-iphone-photos",
)!;
const startFilmSlot =
  document.querySelector<HTMLDivElement>("#start-film-slot")!;
const startIphoneSlot =
  document.querySelector<HTMLDivElement>("#start-iphone-slot")!;
const endFilmSlot = document.querySelector<HTMLDivElement>("#end-film-slot")!;
const endIphoneSlot =
  document.querySelector<HTMLDivElement>("#end-iphone-slot")!;
const proceedToTimeline = document.querySelector<HTMLButtonElement>(
  "#proceed-to-timeline",
)!;
const backToUpload =
  document.querySelector<HTMLButtonElement>("#back-to-upload")!;

const timelineTrack =
  document.querySelector<HTMLDivElement>("#timeline-track")!;
const unmatchedPhotos =
  document.querySelector<HTMLDivElement>("#unmatched-photos")!;
const matchedCountEl =
  document.querySelector<HTMLSpanElement>("#matched-count")!;
const totalFilmCountEl =
  document.querySelector<HTMLSpanElement>("#total-film-count")!;
const autoMatchBtn =
  document.querySelector<HTMLButtonElement>("#auto-match-btn")!;
const proceedToRename =
  document.querySelector<HTMLButtonElement>("#proceed-to-rename")!;
const backToRange =
  document.querySelector<HTMLButtonElement>("#back-to-range")!;

const renamePrefixInput =
  document.querySelector<HTMLInputElement>("#rename-prefix")!;
const renameStartInput =
  document.querySelector<HTMLInputElement>("#rename-start")!;
const renamePreviewList =
  document.querySelector<HTMLDivElement>("#rename-preview-list")!;
const proceedToExport =
  document.querySelector<HTMLButtonElement>("#proceed-to-export")!;
const backToTimeline =
  document.querySelector<HTMLButtonElement>("#back-to-timeline")!;

const exportTableBody =
  document.querySelector<HTMLTableSectionElement>("#export-table-body")!;
const exportBtn = document.querySelector<HTMLButtonElement>("#export-btn")!;
const newRollBtn = document.querySelector<HTMLButtonElement>("#new-roll-btn")!;
const backToRename =
  document.querySelector<HTMLButtonElement>("#back-to-rename")!;
const exportProgress =
  document.querySelector<HTMLDivElement>("#export-progress")!;
const progressFill = document.querySelector<HTMLDivElement>("#progress-fill")!;
const progressText =
  document.querySelector<HTMLSpanElement>("#progress-text")!;

const sections = [
  uploadSection,
  rangeSection,
  timelineSection,
  renameSection,
  exportSection,
];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
});

const BATCH_SIZE = 5;
const THUMBNAIL_QUALITY = 0.6;

const idFromFile = (file: File, index: number) =>
  `${file.name}-${file.size}-${index}`;

const formatDate = (value?: Date) =>
  value ? dateFormatter.format(value) : "Missing";

const setSectionVisible = (section: HTMLElement) => {
  sections.forEach((item) => item.classList.add("hidden"));
  section.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const readArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

const isTiffFile = (file: File) => {
  const type = file.type.toLowerCase();
  const parts = file.name.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
  return (
    type.includes("tiff") ||
    type.includes("tif") ||
    ext === "tif" ||
    ext === "tiff"
  );
};

const tiffToJpegDataUrl = async (file: File, quality = 0.85) => {
  const buffer = await readArrayBuffer(file);
  const ifds = UTIF.decode(buffer);
  if (!ifds[0]) {
    throw new Error("TIFF decode failed");
  }
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width as number;
  const height = ifds[0].height as number;

  const maxDim = 400;
  let targetWidth = width;
  let targetHeight = height;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    targetWidth = Math.round(width * ratio);
    targetHeight = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) {
    throw new Error("Canvas unavailable");
  }
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  tempCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", quality);
};

const formatExifDate = (date: Date) => {
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const normalizeTzOffset = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const match = value.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) {
    return undefined;
  }
  return `${match[1]}${match[2]}:${match[3]}`;
};

const tzOffsetFromDate = (date: Date) => {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
};

const getTzOffsetForAssignment = (
  assignmentDate: Date,
  matchedIphoneId: string | undefined,
  tzCandidates: PhotoItem[],
) => {
  if (matchedIphoneId) {
    const matched = tzCandidates.find((item) => item.id === matchedIphoneId);
    if (matched?.tzOffset) {
      return matched.tzOffset;
    }
  }

  if (tzCandidates.length === 0) {
    return tzOffsetFromDate(assignmentDate);
  }

  const target = assignmentDate.getTime();
  let closest = tzCandidates[0];
  let closestDiff = Math.abs((closest.date?.getTime() ?? 0) - target);

  for (const item of tzCandidates) {
    const time = item.date?.getTime() ?? 0;
    const diff = Math.abs(time - target);
    if (diff < closestDiff) {
      closest = item;
      closestDiff = diff;
    }
  }

  return closest.tzOffset ?? tzOffsetFromDate(assignmentDate);
};

const setProgress = (value: number, text: string) => {
  progressFill.style.width = `${Math.round(value * 100)}%`;
  progressText.textContent = text;
};

const clearNode = (node: HTMLElement) => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
};

const lazyLoadImage = (img: HTMLImageElement, src: string) => {
  const existingObserver = imageObservers.get(img);
  if (existingObserver) {
    existingObserver.disconnect();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src;
          observer.disconnect();
          imageObservers.delete(img);
        }
      });
    },
    { rootMargin: "200px" },
  );

  imageObservers.set(img, observer);
  observer.observe(img);
};

const attachImageFallback = (img: HTMLImageElement, text: string) => {
  const fallback = document.createElement("div");
  fallback.className = "thumb-fallback hidden";
  fallback.textContent = text;
  img.addEventListener("error", () => {
    img.classList.add("hidden");
    fallback.classList.remove("hidden");
  });
  return fallback;
};

const createThumb = (photo: PhotoItem, extra?: string, lazy = true) => {
  const wrapper = document.createElement("div");
  wrapper.className = "thumb";
  wrapper.dataset.photoId = photo.id;
  const img = document.createElement("img");
  img.alt = photo.name;

  const src = photo.previewUrl ?? photo.url;
  if (lazy) {
    img.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
    lazyLoadImage(img, src);
  } else {
    img.src = src;
  }

  const fallback = attachImageFallback(img, "Preview unavailable");
  const label = document.createElement("div");
  label.className = "thumb-label";
  label.textContent = extra ?? photo.name;
  wrapper.appendChild(img);
  wrapper.appendChild(fallback);
  wrapper.appendChild(label);
  return wrapper;
};

const updateCounts = () => {
  iphoneCount.textContent = `${iphonePhotos.length} photos loaded`;
  filmCount.textContent = `${filmPhotos.length} photos loaded`;
  proceedToRange.disabled =
    iphonePhotos.length === 0 || filmPhotos.length === 0;
};

const renderUploadThumbs = () => {
  clearNode(iphoneThumbs);
  clearNode(filmThumbs);
  iphonePhotos.forEach((photo) => {
    const thumb = createThumb(photo, formatDate(photo.date));
    iphoneThumbs.appendChild(thumb);
  });
  filmPhotos.forEach((photo, index) => {
    const thumb = createThumb(photo, `Film ${index + 1}`);
    filmThumbs.appendChild(thumb);
  });
};

const processInBatches = async <T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void,
): Promise<R[]> => {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => processor(item, i + batchIndex)),
    );
    results.push(...batchResults);
    onProgress?.(Math.min(i + batchSize, items.length), items.length);
  }
  return results;
};

const cleanupBlobUrls = (photos: PhotoItem[]) => {
  photos.forEach((photo) => {
    if (photo.url.startsWith("blob:")) {
      URL.revokeObjectURL(photo.url);
    }
  });
};

const loadIphonePhotos = async (files: FileList) => {
  cleanupBlobUrls(iphonePhotos);
  iphonePhotos.length = 0;
  const fileArray = Array.from(files);

  const parsed = await processInBatches(
    fileArray,
    BATCH_SIZE,
    async (file, index) => {
      const id = idFromFile(file, index);
      const url = URL.createObjectURL(file);
      let previewUrl: string | undefined;
      if (isTiffFile(file)) {
        try {
          previewUrl = await tiffToJpegDataUrl(file, THUMBNAIL_QUALITY);
        } catch (error) {
          console.warn("Failed to preview TIFF", file.name, error);
        }
      }
      const exif = await exifr.parse(file, {
        tiff: true,
        exif: true,
        gps: true,
      });
      const date: Date | undefined =
        exif?.DateTimeOriginal ??
        exif?.CreateDate ??
        exif?.ModifyDate ??
        undefined;
      const tzOffset =
        normalizeTzOffset(
          exif?.OffsetTimeOriginal ??
            exif?.OffsetTimeDigitized ??
            exif?.OffsetTime,
        ) ?? (date ? tzOffsetFromDate(date) : undefined);
      const latitude: number | undefined = exif?.latitude;
      const longitude: number | undefined = exif?.longitude;
      return {
        id,
        file,
        name: file.name,
        url,
        previewUrl,
        date,
        tzOffset,
        latitude,
        longitude,
        index,
      };
    },
  );

  iphonePhotos.push(...parsed.filter(Boolean));
};

const loadFilmPhotos = async (files: FileList) => {
  cleanupBlobUrls(filmPhotos);
  filmPhotos.length = 0;
  const fileArray = Array.from(files);

  const parsed = await processInBatches(
    fileArray,
    BATCH_SIZE,
    async (file, index) => {
      const id = idFromFile(file, index);
      const url = URL.createObjectURL(file);
      let previewUrl: string | undefined;
      if (isTiffFile(file)) {
        try {
          previewUrl = await tiffToJpegDataUrl(file, THUMBNAIL_QUALITY);
        } catch (error) {
          console.warn("Failed to preview TIFF", file.name, error);
        }
      }
      return { id, file, name: file.name, url, previewUrl, index };
    },
  );

  filmPhotos.push(...parsed);
};

const renderRangeSelection = () => {
  clearNode(rangeIphone);
  clearNode(rangeFilm);
  iphonePhotos
    .slice()
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
    .forEach((photo) => {
      const item = createThumb(photo, formatDate(photo.date));
      item.classList.add("selectable");
      item.addEventListener("click", () => handleRangeIphoneClick(photo));
      rangeIphone.appendChild(item);
    });
  filmPhotos.forEach((photo) => {
    const item = createThumb(photo, photo.name);
    item.classList.add("selectable");
    item.addEventListener("click", () => handleRangeFilmClick(photo));
    rangeFilm.appendChild(item);
  });
};

const updateAnchorSlot = (
  slot: HTMLDivElement,
  photo?: PhotoItem,
  label?: string,
) => {
  clearNode(slot);
  if (!photo) {
    const placeholder = document.createElement("span");
    placeholder.className = "placeholder";
    placeholder.textContent = label ?? "Select a photo";
    slot.appendChild(placeholder);
    return;
  }
  const img = document.createElement("img");
  img.src = photo.previewUrl ?? photo.url;
  img.alt = photo.name;
  const text = document.createElement("div");
  text.className = "slot-label";
  text.textContent = label ?? photo.name;
  slot.appendChild(img);
  slot.appendChild(text);
};

const handleRangeFilmClick = (photo: PhotoItem) => {
  if (!anchors.startFilmId) {
    anchors.startFilmId = photo.id;
    updateAnchorSlot(startFilmSlot, photo, "Start film");
  } else if (!anchors.endFilmId) {
    anchors.endFilmId = photo.id;
    updateAnchorSlot(endFilmSlot, photo, "End film");
  } else {
    anchors.endFilmId = photo.id;
    updateAnchorSlot(endFilmSlot, photo, "End film");
  }
  validateAnchors();
};

const handleRangeIphoneClick = (photo: PhotoItem) => {
  if (!anchors.startIphoneId) {
    anchors.startIphoneId = photo.id;
    updateAnchorSlot(startIphoneSlot, photo, "Start iPhone");
  } else if (!anchors.endIphoneId) {
    anchors.endIphoneId = photo.id;
    updateAnchorSlot(endIphoneSlot, photo, "End iPhone");
  } else {
    anchors.endIphoneId = photo.id;
    updateAnchorSlot(endIphoneSlot, photo, "End iPhone");
  }
  validateAnchors();
};

const validateAnchors = () => {
  const ready =
    anchors.startFilmId &&
    anchors.endFilmId &&
    anchors.startIphoneId &&
    anchors.endIphoneId;
  proceedToTimeline.disabled = !ready;
};

const createFilmCard = (photo: PhotoItem) => {
  const card = document.createElement("div");
  card.className = "film-card";
  card.draggable = true;
  card.dataset.photoId = photo.id;
  const img = document.createElement("img");
  const src = photo.previewUrl ?? photo.url;
  img.src =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
  lazyLoadImage(img, src);
  img.alt = photo.name;
  const fallback = attachImageFallback(img, "Preview unavailable");
  const label = document.createElement("div");
  label.className = "film-card-label";
  label.textContent = photo.name;
  card.appendChild(img);
  card.appendChild(fallback);
  card.appendChild(label);

  card.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", photo.id);
  });

  return card;
};

const getFilmCard = (photo: PhotoItem) => {
  if (!filmCardMap.has(photo.id)) {
    filmCardMap.set(photo.id, createFilmCard(photo));
  }
  return filmCardMap.get(photo.id)!;
};

const renderTimeline = () => {
  clearNode(timelineTrack);
  clearNode(unmatchedPhotos);
  matches.clear();

  const startIphone = iphonePhotos.find((p) => p.id === anchors.startIphoneId);
  const endIphone = iphonePhotos.find((p) => p.id === anchors.endIphoneId);
  const startFilm = filmPhotos.find((p) => p.id === anchors.startFilmId);
  const endFilm = filmPhotos.find((p) => p.id === anchors.endFilmId);

  if (
    !startIphone ||
    !endIphone ||
    !startFilm ||
    !endFilm ||
    !startIphone.date ||
    !endIphone.date
  ) {
    return;
  }

  const minTime = Math.min(
    startIphone.date.getTime(),
    endIphone.date.getTime(),
  );
  const maxTime = Math.max(
    startIphone.date.getTime(),
    endIphone.date.getTime(),
  );

  const timelinePhotos = iphonePhotos
    .filter((photo) => {
      const time = photo.date?.getTime() ?? 0;
      return time >= minTime && time <= maxTime;
    })
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

  timelinePhotos.forEach((photo) => {
    const node = document.createElement("div");
    node.className = "timeline-node";
    node.dataset.iphoneId = photo.id;

    const img = document.createElement("img");
    const src = photo.previewUrl ?? photo.url;
    img.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
    lazyLoadImage(img, src);
    img.alt = photo.name;

    const label = document.createElement("div");
    label.className = "timeline-label";
    label.textContent = formatDate(photo.date);

    const filmSlot = document.createElement("div");
    filmSlot.className = "node-film";

    node.appendChild(img);
    node.appendChild(label);
    node.appendChild(filmSlot);

    node.addEventListener("dragover", (event) => event.preventDefault());
    node.addEventListener("drop", (event) => {
      event.preventDefault();
      const filmId = event.dataTransfer?.getData("text/plain");
      if (filmId) {
        assignMatch(filmId, photo.id);
      }
    });

    timelineTrack.appendChild(node);
  });

  filmPhotos
    .slice()
    .sort((a, b) => a.index - b.index)
    .forEach((photo) => {
      const card = getFilmCard(photo);
      unmatchedPhotos.appendChild(card);
    });

  unmatchedPhotos.addEventListener("dragover", (event) =>
    event.preventDefault(),
  );
  unmatchedPhotos.addEventListener("drop", (event) => {
    event.preventDefault();
    const filmId = event.dataTransfer?.getData("text/plain");
    if (filmId) {
      unassignMatch(filmId);
    }
  });

  assignMatch(startFilm.id, startIphone.id);
  assignMatch(endFilm.id, endIphone.id);
  updateMatchStats();
};

const assignMatch = (filmId: string, iphoneId: string) => {
  if (matches.get(filmId) === iphoneId) {
    return;
  }
  matches.set(filmId, iphoneId);
  const card = filmCardMap.get(filmId);
  const targetNode = timelineTrack.querySelector<HTMLDivElement>(
    `.timeline-node[data-iphone-id="${iphoneId}"] .node-film`,
  );
  if (card && targetNode) {
    targetNode.appendChild(card);
  }
  updateMatchStats();
};

const unassignMatch = (filmId: string) => {
  matches.delete(filmId);
  const card = filmCardMap.get(filmId);
  if (card) {
    unmatchedPhotos.appendChild(card);
  }
  updateMatchStats();
};

const updateMatchStats = () => {
  matchedCountEl.textContent = `${matches.size}`;
  totalFilmCountEl.textContent = `${filmPhotos.length}`;
};

const buildAssignments = () => {
  assignments.clear();
  const sortedFilms = filmPhotos.slice().sort((a, b) => a.index - b.index);

  const anchorsByIndex = sortedFilms
    .map((photo, idx) => {
      const matchedIphoneId = matches.get(photo.id);
      if (!matchedIphoneId) {
        return null;
      }
      const matchedIphone = iphonePhotos.find(
        (item) => item.id === matchedIphoneId,
      );
      if (!matchedIphone?.date) {
        return null;
      }
      return { idx, date: matchedIphone.date, matchedTo: matchedIphone.name };
    })
    .filter((item): item is { idx: number; date: Date; matchedTo: string } =>
      Boolean(item),
    );

  sortedFilms.forEach((photo, idx) => {
    const matchedIphoneId = matches.get(photo.id);
    if (matchedIphoneId) {
      const matchedIphone = iphonePhotos.find(
        (item) => item.id === matchedIphoneId,
      );
      if (matchedIphone?.date) {
        assignments.set(photo.id, {
          date: matchedIphone.date,
          matchedTo: matchedIphone.name,
          method: "matched",
        });
      }
      return;
    }

    const before = [...anchorsByIndex]
      .reverse()
      .find((anchor) => anchor.idx < idx);
    const after = anchorsByIndex.find((anchor) => anchor.idx > idx);

    if (before && after) {
      const total = after.idx - before.idx;
      const offset = idx - before.idx;
      const ratio = total === 0 ? 0 : offset / total;
      const time =
        before.date.getTime() +
        ratio * (after.date.getTime() - before.date.getTime());
      assignments.set(photo.id, {
        date: new Date(time),
        method: "interpolated",
      });
      return;
    }

    const fallback = before ?? after;
    if (fallback) {
      assignments.set(photo.id, {
        date: fallback.date,
        method: "clamped",
      });
    }
  });
};

const getBasename = (filename: string) => {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? filename : filename.slice(0, lastDot);
};

const getOutputExtension = (file: File) => {
  return isTiffFile(file) ? ".tif" : ".jpg";
};

const generateOutputFilename = (
  photo: PhotoItem,
  index: number,
  config: RenameConfig,
) => {
  const ext = getOutputExtension(photo.file);
  if (!config.prefix.trim()) {
    return `${getBasename(photo.name)}${ext}`;
  }
  const number = config.startNumber + index;
  const paddedNumber = String(number).padStart(3, "0");
  return `${config.prefix}_${paddedNumber}${ext}`;
};

const renderRenamePreview = () => {
  clearNode(renamePreviewList);
  const sortedFilms = filmPhotos.slice().sort((a, b) => a.index - b.index);

  sortedFilms.forEach((photo, index) => {
    const outputName = generateOutputFilename(photo, index, renameConfig);
    const item = document.createElement("div");
    item.className = "rename-preview-item";

    const original = document.createElement("span");
    original.className = "rename-original";
    original.textContent = photo.name;

    const arrow = document.createElement("span");
    arrow.className = "rename-arrow";
    arrow.textContent = "→";

    const newName = document.createElement("span");
    newName.className = "rename-new";
    newName.textContent = outputName;

    item.appendChild(original);
    item.appendChild(arrow);
    item.appendChild(newName);
    renamePreviewList.appendChild(item);
  });
};

const updateRenameConfig = () => {
  renameConfig.prefix = renamePrefixInput.value.trim();
  renameConfig.startNumber = parseInt(renameStartInput.value, 10) || 1;
  renderRenamePreview();
};

const renderExportPreview = () => {
  buildAssignments();
  clearNode(exportTableBody);

  const sortedFilms = filmPhotos.slice().sort((a, b) => a.index - b.index);

  sortedFilms.forEach((photo, index) => {
    const assignment = assignments.get(photo.id);
    const outputName = generateOutputFilename(photo, index, renameConfig);
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = outputName;

    const dateCell = document.createElement("td");
    dateCell.textContent = assignment
      ? formatDate(assignment.date)
      : "Missing";

    const matchedCell = document.createElement("td");
    matchedCell.textContent = assignment?.matchedTo ?? "Interpolated";

    const methodCell = document.createElement("td");
    methodCell.textContent = assignment?.method ?? "Missing";

    row.appendChild(nameCell);
    row.appendChild(dateCell);
    row.appendChild(matchedCell);
    row.appendChild(methodCell);
    exportTableBody.appendChild(row);
  });
};

const getExifPayload = (
  assignment: Assignment,
  matchedIphoneId: string | undefined,
  tzCandidates: PhotoItem[],
) => {
  const exifDate = formatExifDate(assignment.date);
  const tzOffset = getTzOffsetForAssignment(
    assignment.date,
    matchedIphoneId,
    tzCandidates,
  );
  return { exifDate, tzOffset };
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
};

const decimalToDMS = (decimal: number): [[number, number], [number, number], [number, number]] => {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minFloat);
  const secFloat = (minFloat - minutes) * 60;
  const seconds = Math.round(secFloat * 100);
  return [[degrees, 1], [minutes, 1], [seconds, 100]];
};

type GpsCoords = { latitude: number; longitude: number } | null;

const createExifData = (exifDate: string, _tzOffset: string | null, gps: GpsCoords) => {
  const zeroth: Record<string, unknown> = {};
  const exifData: Record<string, unknown> = {};
  const gpsData: Record<string, unknown> = {};

  const TAG_DATETIME = 306;
  const TAG_DATETIME_ORIGINAL = 36867;
  const TAG_DATETIME_DIGITIZED = 36868;

  zeroth[TAG_DATETIME] = exifDate;
  exifData[TAG_DATETIME_ORIGINAL] = exifDate;
  exifData[TAG_DATETIME_DIGITIZED] = exifDate;

  if (gps) {
    const TAG_GPS_LATITUDE_REF = 1;
    const TAG_GPS_LATITUDE = 2;
    const TAG_GPS_LONGITUDE_REF = 3;
    const TAG_GPS_LONGITUDE = 4;

    gpsData[TAG_GPS_LATITUDE_REF] = gps.latitude >= 0 ? "N" : "S";
    gpsData[TAG_GPS_LATITUDE] = decimalToDMS(gps.latitude);
    gpsData[TAG_GPS_LONGITUDE_REF] = gps.longitude >= 0 ? "E" : "W";
    gpsData[TAG_GPS_LONGITUDE] = decimalToDMS(gps.longitude);
  }

  return { "0th": zeroth, Exif: exifData, GPS: gpsData, "1st": {}, thumbnail: null };
};

const writeExifToJpeg = (jpegDataUrl: string, exifDate: string, tzOffset: string | null, gps: GpsCoords): string => {
  const exifObj = createExifData(exifDate, tzOffset, gps);
  const exifBytes = piexif.dump(exifObj);
  return piexif.insert(exifBytes, jpegDataUrl);
};

const imageToJpegDataUrl = async (file: File, quality = 0.95): Promise<string> => {
  if (isTiffFile(file)) {
    const buffer = await readArrayBuffer(file);
    const ifds = UTIF.decode(buffer);
    if (!ifds[0]) {
      throw new Error("TIFF decode failed");
    }
    UTIF.decodeImage(buffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const width = ifds[0].width as number;
    const height = ifds[0].height as number;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas unavailable");
    }
    const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpeg", quality);
  }

  const dataUrl = await fileToDataUrl(file);
  if (file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg")) {
    return dataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
};

const writeTiffDateTime = async (file: File, exifDate: string, gps: GpsCoords): Promise<Blob> => {
  const buffer = await readArrayBuffer(file);
  const data = new Uint8Array(buffer);
  
  const littleEndian = data[0] === 0x49 && data[1] === 0x49;
  
  const readU16 = (offset: number) => {
    if (littleEndian) {
      return data[offset] | (data[offset + 1] << 8);
    }
    return (data[offset] << 8) | data[offset + 1];
  };
  
  const readU32 = (offset: number) => {
    if (littleEndian) {
      return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
    }
    return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
  };

  const writeU16 = (arr: number[], value: number) => {
    if (littleEndian) {
      arr.push(value & 0xff, (value >> 8) & 0xff);
    } else {
      arr.push((value >> 8) & 0xff, value & 0xff);
    }
  };

  const writeU32 = (arr: number[], value: number) => {
    if (littleEndian) {
      arr.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
    } else {
      arr.push((value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
    }
  };

  const writeRational = (arr: number[], num: number, den: number) => {
    writeU32(arr, num);
    writeU32(arr, den);
  };

  const ifdOffset = readU32(4);
  const numEntries = readU16(ifdOffset);
  
  const TAG_DATETIME = 306;
  const TAG_EXIF_IFD = 34665;
  const TAG_GPS_IFD = 34853;
  
  const existingTags = new Set<number>();
  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    const tag = readU16(entryOffset);
    existingTags.add(tag);
  }
  
  const dateTimeStr = exifDate + "\0";
  const dateTimeBytes = new TextEncoder().encode(dateTimeStr);
  
  const newTags: { tag: number; type: number; count: number; valueBytes: number[] }[] = [];
  
  newTags.push({
    tag: TAG_DATETIME,
    type: 2,
    count: 20,
    valueBytes: Array.from(dateTimeBytes).concat(Array(20 - dateTimeBytes.length).fill(0)).slice(0, 20),
  });
  
  const exifIfdTags: { tag: number; type: number; count: number; valueBytes: number[] }[] = [];
  const TAG_DATETIME_ORIGINAL = 36867;
  const TAG_DATETIME_DIGITIZED = 36868;
  
  exifIfdTags.push({
    tag: TAG_DATETIME_ORIGINAL,
    type: 2,
    count: 20,
    valueBytes: Array.from(dateTimeBytes).concat(Array(20 - dateTimeBytes.length).fill(0)).slice(0, 20),
  });
  exifIfdTags.push({
    tag: TAG_DATETIME_DIGITIZED,
    type: 2,
    count: 20,
    valueBytes: Array.from(dateTimeBytes).concat(Array(20 - dateTimeBytes.length).fill(0)).slice(0, 20),
  });
  
  const gpsIfdTags: { tag: number; type: number; count: number; valueBytes: number[] }[] = [];
  if (gps) {
    const latDMS = decimalToDMS(gps.latitude);
    const lonDMS = decimalToDMS(gps.longitude);
    
    const latRef = gps.latitude >= 0 ? "N\0" : "S\0";
    const lonRef = gps.longitude >= 0 ? "E\0" : "W\0";
    
    gpsIfdTags.push({ tag: 1, type: 2, count: 2, valueBytes: Array.from(new TextEncoder().encode(latRef)) });
    
    const latBytes: number[] = [];
    for (const [num, den] of latDMS) {
      writeRational(latBytes, num, den);
    }
    gpsIfdTags.push({ tag: 2, type: 5, count: 3, valueBytes: latBytes });
    
    gpsIfdTags.push({ tag: 3, type: 2, count: 2, valueBytes: Array.from(new TextEncoder().encode(lonRef)) });
    
    const lonBytes: number[] = [];
    for (const [num, den] of lonDMS) {
      writeRational(lonBytes, num, den);
    }
    gpsIfdTags.push({ tag: 4, type: 5, count: 3, valueBytes: lonBytes });
  }
  
  const originalData = Array.from(data);
  let appendOffset = originalData.length;
  
  while (appendOffset % 2 !== 0) {
    originalData.push(0);
    appendOffset++;
  }
  
  let exifIfdOffset = 0;
  let gpsIfdOffset = 0;
  
  if (exifIfdTags.length > 0 && !existingTags.has(TAG_EXIF_IFD)) {
    exifIfdOffset = appendOffset;
    
    const exifIfd: number[] = [];
    writeU16(exifIfd, exifIfdTags.length);
    
    let exifDataOffset = appendOffset + 2 + exifIfdTags.length * 12;
    const exifOverflowData: number[] = [];
    
    for (const entry of exifIfdTags.sort((a, b) => a.tag - b.tag)) {
      writeU16(exifIfd, entry.tag);
      writeU16(exifIfd, entry.type);
      writeU32(exifIfd, entry.count);
      
      const typeSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][entry.type] || 1;
      const totalSize = typeSize * entry.count;
      
      if (totalSize <= 4) {
        const padded = entry.valueBytes.concat([0, 0, 0, 0]).slice(0, 4);
        exifIfd.push(...padded);
      } else {
        writeU32(exifIfd, exifDataOffset);
        exifOverflowData.push(...entry.valueBytes);
        exifDataOffset += entry.valueBytes.length;
        while (exifOverflowData.length % 2 !== 0) {
          exifOverflowData.push(0);
          exifDataOffset++;
        }
      }
    }
    
    originalData.push(...exifIfd, ...exifOverflowData);
    appendOffset = originalData.length;
    
    newTags.push({
      tag: TAG_EXIF_IFD,
      type: 4,
      count: 1,
      valueBytes: [],
    });
  }
  
  if (gpsIfdTags.length > 0 && !existingTags.has(TAG_GPS_IFD)) {
    while (originalData.length % 2 !== 0) {
      originalData.push(0);
    }
    gpsIfdOffset = originalData.length;
    
    const gpsIfd: number[] = [];
    writeU16(gpsIfd, gpsIfdTags.length);
    
    let gpsDataOffset = gpsIfdOffset + 2 + gpsIfdTags.length * 12;
    const gpsOverflowData: number[] = [];
    
    for (const entry of gpsIfdTags.sort((a, b) => a.tag - b.tag)) {
      writeU16(gpsIfd, entry.tag);
      writeU16(gpsIfd, entry.type);
      writeU32(gpsIfd, entry.count);
      
      const typeSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][entry.type] || 1;
      const totalSize = typeSize * entry.count;
      
      if (totalSize <= 4) {
        const padded = entry.valueBytes.concat([0, 0, 0, 0]).slice(0, 4);
        gpsIfd.push(...padded);
      } else {
        writeU32(gpsIfd, gpsDataOffset);
        gpsOverflowData.push(...entry.valueBytes);
        gpsDataOffset += entry.valueBytes.length;
        while (gpsOverflowData.length % 2 !== 0) {
          gpsOverflowData.push(0);
          gpsDataOffset++;
        }
      }
    }
    
    originalData.push(...gpsIfd, ...gpsOverflowData);
    appendOffset = originalData.length;
    
    newTags.push({
      tag: TAG_GPS_IFD,
      type: 4,
      count: 1,
      valueBytes: [],
    });
  }
  
  const nextIfdPointerOffset = ifdOffset + 2 + numEntries * 12;
  const nextIfdPointer = readU32(nextIfdPointerOffset);
  
  while (originalData.length % 2 !== 0) {
    originalData.push(0);
  }
  const newIfdOffset = originalData.length;
  
  const allTags: { tag: number; type: number; count: number; value: number[] }[] = [];
  
  const tagsToReplace = new Set([TAG_DATETIME, TAG_EXIF_IFD, TAG_GPS_IFD]);
  
  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    const tag = readU16(entryOffset);
    if (tagsToReplace.has(tag)) {
      continue;
    }
    const type = readU16(entryOffset + 2);
    const count = readU32(entryOffset + 4);
    const value = [data[entryOffset + 8], data[entryOffset + 9], data[entryOffset + 10], data[entryOffset + 11]];
    allTags.push({ tag, type, count, value });
  }
  
  let dataAppendOffset = newIfdOffset + 2 + (allTags.length + newTags.length) * 12 + 4;
  const overflowData: number[] = [];
  
  for (const newTag of newTags) {
    if (newTag.tag === TAG_EXIF_IFD) {
      const val: number[] = [];
      writeU32(val, exifIfdOffset);
      allTags.push({ tag: newTag.tag, type: newTag.type, count: newTag.count, value: val });
    } else if (newTag.tag === TAG_GPS_IFD) {
      const val: number[] = [];
      writeU32(val, gpsIfdOffset);
      allTags.push({ tag: newTag.tag, type: newTag.type, count: newTag.count, value: val });
    } else {
      const typeSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][newTag.type] || 1;
      const totalSize = typeSize * newTag.count;
      
      if (totalSize <= 4) {
        const padded = newTag.valueBytes.concat([0, 0, 0, 0]).slice(0, 4);
        allTags.push({ tag: newTag.tag, type: newTag.type, count: newTag.count, value: padded });
      } else {
        const offsetVal: number[] = [];
        writeU32(offsetVal, dataAppendOffset);
        allTags.push({ tag: newTag.tag, type: newTag.type, count: newTag.count, value: offsetVal });
        overflowData.push(...newTag.valueBytes);
        dataAppendOffset += newTag.valueBytes.length;
        while (overflowData.length % 2 !== 0) {
          overflowData.push(0);
          dataAppendOffset++;
        }
      }
    }
  }
  
  allTags.sort((a, b) => a.tag - b.tag);
  
  const newIfd: number[] = [];
  writeU16(newIfd, allTags.length);
  
  for (const entry of allTags) {
    writeU16(newIfd, entry.tag);
    writeU16(newIfd, entry.type);
    writeU32(newIfd, entry.count);
    newIfd.push(...entry.value);
  }
  
  writeU32(newIfd, nextIfdPointer);
  
  originalData.push(...newIfd, ...overflowData);
  
  if (littleEndian) {
    originalData[4] = newIfdOffset & 0xff;
    originalData[5] = (newIfdOffset >> 8) & 0xff;
    originalData[6] = (newIfdOffset >> 16) & 0xff;
    originalData[7] = (newIfdOffset >> 24) & 0xff;
  } else {
    originalData[4] = (newIfdOffset >> 24) & 0xff;
    originalData[5] = (newIfdOffset >> 16) & 0xff;
    originalData[6] = (newIfdOffset >> 8) & 0xff;
    originalData[7] = newIfdOffset & 0xff;
  }
  
  return new Blob([new Uint8Array(originalData)], { type: "image/tiff" });
};

const processPhotoForExport = async (
  photo: PhotoItem,
  exifDate: string,
  tzOffset: string | null,
  gps: GpsCoords,
): Promise<Blob> => {
  if (isTiffFile(photo.file)) {
    return writeTiffDateTime(photo.file, exifDate, gps);
  }
  const jpegDataUrl = await imageToJpegDataUrl(photo.file, 0.95);
  const withExif = writeExifToJpeg(jpegDataUrl, exifDate, tzOffset, gps);
  return dataUrlToBlob(withExif);
};

const findGpsForPhoto = (
  matchedIphoneId: string | undefined,
  assignedDate: Date,
  gpsCandidates: PhotoItem[],
): GpsCoords => {
  if (matchedIphoneId) {
    const matched = iphonePhotos.find((p) => p.id === matchedIphoneId);
    if (matched?.latitude !== undefined && matched?.longitude !== undefined) {
      return { latitude: matched.latitude, longitude: matched.longitude };
    }
  }

  if (gpsCandidates.length === 0) return null;

  const targetTime = assignedDate.getTime();
  let closest = gpsCandidates[0];
  let closestDiff = Math.abs((closest.date?.getTime() ?? 0) - targetTime);

  for (const candidate of gpsCandidates) {
    const diff = Math.abs((candidate.date?.getTime() ?? 0) - targetTime);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = candidate;
    }
  }

  if (closest.latitude !== undefined && closest.longitude !== undefined) {
    return { latitude: closest.latitude, longitude: closest.longitude };
  }

  return null;
};

const exportPhotos = async () => {
  buildAssignments();
  const missing = filmPhotos.filter((photo) => !assignments.get(photo.id));
  if (missing.length > 0) {
    window.alert(
      "Some film photos are missing timestamps. Add more matches and try again.",
    );
    return;
  }

  exportProgress.classList.remove("hidden");
  setProgress(0, "Preparing export...");

  try {
    const zip = new JSZip();
    const sortedFilms = filmPhotos.slice().sort((a, b) => a.index - b.index);
    const tzCandidates = iphonePhotos
      .filter((item) => item.date && item.tzOffset)
      .slice()
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    const gpsCandidates = iphonePhotos
      .filter((item) => item.date && item.latitude !== undefined && item.longitude !== undefined)
      .slice()
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

    for (let i = 0; i < sortedFilms.length; i++) {
      const photo = sortedFilms[i];
      const assignment = assignments.get(photo.id);
      if (!assignment) continue;

      const matchedIphoneId = matches.get(photo.id);
      const { exifDate, tzOffset } = getExifPayload(
        assignment,
        matchedIphoneId,
        tzCandidates,
      );
      const gps = findGpsForPhoto(matchedIphoneId, assignment.date, gpsCandidates);
      const outputName = generateOutputFilename(photo, i, renameConfig);

      setProgress(
        (i + 0.5) / sortedFilms.length * 0.9,
        `Processing ${i + 1} of ${sortedFilms.length}...`,
      );

      const blob = await processPhotoForExport(photo, exifDate, tzOffset, gps);
      zip.file(outputName, blob);
    }

    setProgress(0.95, "Creating ZIP file...");
    const zipBlob = await zip.generateAsync({ type: "blob" });

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "film-photo-sync.zip";
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export failed:", error);
    window.alert("Export failed. Check the console for details.");
  } finally {
    exportProgress.classList.add("hidden");
  }
};

iphoneInput.addEventListener("change", async () => {
  if (!iphoneInput.files) {
    return;
  }
  await loadIphonePhotos(iphoneInput.files);
  updateCounts();
  renderUploadThumbs();
});

filmInput.addEventListener("change", async () => {
  if (!filmInput.files) {
    return;
  }
  await loadFilmPhotos(filmInput.files);
  updateCounts();
  renderUploadThumbs();
});

proceedToRange.addEventListener("click", () => {
  if (iphonePhotos.length === 0 || filmPhotos.length === 0) {
    return;
  }
  renderRangeSelection();
  setSectionVisible(rangeSection);
});

backToUpload.addEventListener("click", () => setSectionVisible(uploadSection));

proceedToTimeline.addEventListener("click", () => {
  renderTimeline();
  setSectionVisible(timelineSection);
});

backToRange.addEventListener("click", () => setSectionVisible(rangeSection));

autoMatchBtn.addEventListener("click", () => {
  window.alert(
    "Auto-match will be added next. For now, drag film photos onto the timeline.",
  );
});

proceedToRename.addEventListener("click", () => {
  renderRenamePreview();
  setSectionVisible(renameSection);
});

backToTimeline.addEventListener("click", () =>
  setSectionVisible(timelineSection),
);

renamePrefixInput.addEventListener("input", updateRenameConfig);
renameStartInput.addEventListener("input", updateRenameConfig);

proceedToExport.addEventListener("click", () => {
  renderExportPreview();
  setSectionVisible(exportSection);
});

backToRename.addEventListener("click", () => setSectionVisible(renameSection));

exportBtn.addEventListener("click", () => {
  exportPhotos().catch((error) => {
    console.error(error);
    window.alert("Export failed. Check the console for details.");
  });
});

const resetForNewRoll = () => {
  cleanupBlobUrls(filmPhotos);
  filmPhotos.length = 0;
  matches.clear();
  filmCardMap.clear();
  assignments.clear();

  anchors.startFilmId = "";
  anchors.endFilmId = "";
  anchors.startIphoneId = "";
  anchors.endIphoneId = "";

  renameConfig.prefix = "";
  renameConfig.startNumber = 1;
  renamePrefixInput.value = "";
  renameStartInput.value = "1";

  clearNode(filmThumbs);
  clearNode(rangeFilm);
  clearNode(rangeIphone);
  clearNode(timelineTrack);
  clearNode(unmatchedPhotos);
  clearNode(renamePreviewList);
  clearNode(exportTableBody);

  updateAnchorSlot(startFilmSlot, undefined, "Click a film photo");
  updateAnchorSlot(endFilmSlot, undefined, "Click a film photo");
  updateAnchorSlot(startIphoneSlot, undefined, "Click an iPhone photo");
  updateAnchorSlot(endIphoneSlot, undefined, "Click an iPhone photo");

  updateCounts();
  renderUploadThumbs();
  setSectionVisible(uploadSection);
};

newRollBtn.addEventListener("click", resetForNewRoll);

const setupDropZone = (
  zone: HTMLElement,
  loadFn: (files: FileList) => Promise<void>,
) => {
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add("drag-over");
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("drag-over");
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("drag-over");

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await loadFn(files);
      updateCounts();
      renderUploadThumbs();
    }
  };

  zone.addEventListener("dragover", handleDragOver);
  zone.addEventListener("dragenter", handleDragOver);
  zone.addEventListener("dragleave", handleDragLeave);
  zone.addEventListener("drop", handleDrop);
};

setupDropZone(iphoneZone, loadIphonePhotos);
setupDropZone(filmZone, loadFilmPhotos);
