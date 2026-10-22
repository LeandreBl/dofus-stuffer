import { useEffect, useRef, useState, type PointerEvent } from "react";
import { MonitorUp, ScanText, Square } from "lucide-react";
import type { Block, Worker as OcrWorker } from "tesseract.js";

/** Part of the shared screen to read, as fractions of the video size. */
type Region = { x: number; y: number; w: number; h: number };
const REGION_KEY = "dofus-stuffer.forge-region.v1";
const TICK_MS = 600;
/** A thumbnail pixel this much greyer or lighter (0-255) has changed: compression noise stays far below. */
const PIXEL_CHANGE = 40;
/** Changed thumbnail pixels that make a new screen: one digit of a line is a few of them. */
const CHANGED_PIXELS = 3;
const loadRegion = (): Region | undefined => {
  try { return JSON.parse(localStorage.getItem(REGION_KEY) || "null") ?? undefined; } catch { return undefined; }
};

let ocr: Promise<OcrWorker> | undefined;
// Self-hosted engine (copy-ocr.mjs): loaded on first use only, ~4 MB.
// Sparse-text mode: the default block mode drops the game's highlighted rows (green/red frames).
const ocrWorker = () => (ocr ??= import("tesseract.js").then(async ({ createWorker, PSM }) => {
  const worker = await createWorker("fra", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr/", langPath: "/ocr", workerBlobURL: false });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return worker;
}));

/** Sparse text comes word by word: put the words of each table row back on one line, left to right. */
function rowsOf(blocks: Block[]) {
  const rows: { y: number; h: number; words: { x: number; text: string }[] }[] = [];
  const words = blocks.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)));
  for (const word of words.sort((a, b) => a.bbox.y0 + a.bbox.y1 - b.bbox.y0 - b.bbox.y1)) {
    const y = (word.bbox.y0 + word.bbox.y1) / 2, h = word.bbox.y1 - word.bbox.y0;
    const row = rows.find((entry) => Math.abs(entry.y - y) < Math.max(h, entry.h) * 0.6);
    if (row) row.words.push({ x: word.bbox.x0, text: word.text });
    else rows.push({ y, h, words: [{ x: word.bbox.x0, text: word.text }] });
  }
  return rows.map((row) => row.words.sort((a, b) => a.x - b.x).map((word) => word.text).join(" ")).join("\n");
}

/** Grey thumbnail used to notice that the game window changed. */
function thumbnail(source: HTMLCanvasElement) {
  const small = document.createElement("canvas");
  small.width = 200; small.height = Math.max(1, Math.round(200 * source.height / source.width));
  const context = small.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, small.width, small.height);
  const { data } = context.getImageData(0, 0, small.width, small.height);
  return Uint8Array.from({ length: data.length / 4 }, (_, i) => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3);
}
const changed = (a: Uint8Array, b: Uint8Array) => a.reduce((count, value, i) => count + (Math.abs(value - b[i]) > PIXEL_CHANGE ? 1 : 0), 0) >= CHANGED_PIXELS;

/** Crops, upscales and turns the game's light-on-dark text into dark-on-light for the OCR. */
function crop(video: HTMLVideoElement, region: Region) {
  const canvas = document.createElement("canvas");
  const sx = region.x * video.videoWidth, sy = region.y * video.videoHeight;
  const sw = Math.max(1, region.w * video.videoWidth), sh = Math.max(1, region.h * video.videoHeight);
  const scale = Math.min(3, Math.max(1, 1200 / sw));
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height), { data } = image;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) total += data[i] + data[i + 1] + data[i + 2];
  const invert = total / (data.length / 4) / 3 < 128;
  for (let i = 0; i < data.length; i += 4) {
    const grey = Math.max(data[i], data[i + 1], data[i + 2]); // keeps coloured game text bright
    data[i] = data[i + 1] = data[i + 2] = invert ? 255 - grey : grey;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function ForgeScreen({ onText, onSharing }: { onText: (text: string) => void; onSharing: (sharing: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream>();
  const [region, setRegion] = useState(loadRegion);
  const [drawing, setDrawing] = useState<{ x: number; y: number; to?: { x: number; y: number } }>();
  const [selecting, setSelecting] = useState(false);
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => onSharing(!!stream), [stream, onSharing]);
  useEffect(() => {
    if (video.current) video.current.srcObject = stream ?? null;
    if (!stream) return;
    const end = () => setStream(undefined);
    stream.getVideoTracks()[0]?.addEventListener("ended", end);
    return () => stream.getTracks().forEach((track) => track.stop());
  }, [stream]);

  useEffect(() => {
    if (!stream || !region || selecting) return;
    let previous: Uint8Array | undefined, read: Uint8Array | undefined, busy = false, stopped = false;
    const timer = window.setInterval(async () => {
      const source = video.current;
      if (busy || !source?.videoWidth) return;
      const canvas = crop(source, region), print = thumbnail(canvas);
      const settled = previous !== undefined && !changed(print, previous);
      previous = print;
      // Read once the window stops moving, and only when it differs from the last read.
      if (!settled || (read && !changed(print, read))) return;
      read = print; busy = true;
      setStatus("Lecture de l’écran…");
      try {
        const { data } = await (await ocrWorker()).recognize(canvas, {}, { blocks: true });
        const rows = rowsOf(data.blocks ?? []);
        if (!stopped) { onTextRef.current(rows); setText(rows); setStatus(`Lu à ${new Date().toLocaleTimeString("fr-FR")}`); }
      } catch {
        if (!stopped) setStatus("La lecture a échoué. Vérifie la zone choisie.");
      } finally { busy = false; }
    }, TICK_MS);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [stream, region, selecting]);

  async function share() {
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      setStream(next);
      setSelecting(!region);
    } catch { setStatus("Partage d’écran refusé ou indisponible."); }
  }
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)) };
  };
  function finish() {
    if (!drawing?.to) return setDrawing(undefined);
    const next = { x: Math.min(drawing.x, drawing.to.x), y: Math.min(drawing.y, drawing.to.y), w: Math.abs(drawing.to.x - drawing.x), h: Math.abs(drawing.to.y - drawing.y) };
    setDrawing(undefined);
    if (next.w < 0.02 || next.h < 0.02) return;
    setRegion(next);
    setSelecting(false);
    try { localStorage.setItem(REGION_KEY, JSON.stringify(next)); } catch { /* The region is asked again next time. */ }
  }
  const shown = drawing?.to
    ? { x: Math.min(drawing.x, drawing.to.x), y: Math.min(drawing.y, drawing.to.y), w: Math.abs(drawing.to.x - drawing.x), h: Math.abs(drawing.to.y - drawing.y) }
    : region;

  return (
    <section className="panel forge-screen">
      <div className="panel-head">
        <div><h2><ScanText size={17} /> Lecture de l’écran</h2><p>Partage la fenêtre de Dofus, encadre la liste des effets de l’objet et le reliquat : chaque changement en jeu est reporté ici.</p></div>
        {stream
          ? <button className="button small ghost" onClick={() => setStream(undefined)}><Square size={13} /> Arrêter</button>
          : <button className="button small" onClick={() => void share()}><MonitorUp size={14} /> Partager l’écran</button>}
      </div>
      <div className={`forge-screen-view ${stream ? "" : "hidden"} ${selecting ? "selecting" : ""}`}
        onPointerDown={(event) => { if (!selecting) return; event.currentTarget.setPointerCapture(event.pointerId); setDrawing(point(event)); }}
        onPointerMove={(event) => drawing && setDrawing({ ...drawing, to: point(event) })}
        onPointerUp={finish}>
        <video ref={video} autoPlay muted playsInline />
        {shown && <span className="forge-screen-region" style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }} />}
      </div>
      {stream && (
        <div className="forge-screen-bar">
          <span className="inline-notice">{selecting ? "Trace un rectangle autour des effets de l’objet." : status || "En attente d’un changement…"}</span>
          {!selecting && <button className="button small ghost" onClick={() => setSelecting(true)}>Changer la zone</button>}
        </div>
      )}
      {stream && text && <details className="forge-screen-text"><summary>Texte lu</summary><pre>{text}</pre></details>}
    </section>
  );
}
