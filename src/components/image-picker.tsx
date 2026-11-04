"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui";

const MAX_SIDE = 800;
const QUALITY = 0.8;

/* Perkecil foto di browser lalu ubah ke data URL JPEG supaya ringan disimpan di kolom image_url. */
async function compress(source: Blob | HTMLVideoElement): Promise<string> {
  let w: number;
  let h: number;
  let draw: CanvasImageSource;
  if (source instanceof HTMLVideoElement) {
    w = source.videoWidth;
    h = source.videoHeight;
    draw = source;
  } else {
    const bmp = await createImageBitmap(source);
    w = bmp.width;
    h = bmp.height;
    draw = bmp;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(draw, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export function ImagePicker({ name, defaultValue, error }: { name: string; defaultValue?: string | null; error?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => stopCamera, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("File harus berupa gambar (JPG, PNG, WEBP).");
      return;
    }
    try {
      setValue(await compress(file));
      setMsg(null);
    } catch {
      setMsg("Gambar tidak bisa dibaca. Coba file lain.");
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  async function startCamera() {
    setMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Peramban tanpa akses kamera langsung: pakai kamera bawaan lewat input file.
      fileRef.current?.setAttribute("capture", "environment");
      fileRef.current?.click();
      fileRef.current?.removeAttribute("capture");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setMsg("Kamera tidak bisa dibuka. Pastikan izin kamera diberikan.");
    }
  }

  async function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setValue(await compress(v));
    stopCamera();
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={value} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />

      {cameraOn ? (
        <div className="grid gap-2">
          <video ref={videoRef} playsInline muted className="aspect-square w-full max-w-xs rounded-md bg-black object-cover" />
          <div className="flex gap-2">
            <Button type="button" onClick={snap}>Ambil foto</Button>
            <Button type="button" variant="secondary" onClick={stopCamera}>Batal</Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={"flex flex-col items-center gap-3 rounded-md border-2 border-dashed p-4 text-center " + (dragging ? "border-accent bg-accent/10" : "border-zinc-300")}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Pratinjau foto produk" className="aspect-square w-32 rounded-md object-cover" />
          ) : (
            <p className="text-sm text-muted">Tarik foto ke sini, atau pilih dari bawah.</p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Pilih dari komputer/galeri</Button>
            <Button type="button" variant="secondary" onClick={startCamera}>Pakai kamera</Button>
            {value && <Button type="button" variant="secondary" onClick={() => setValue("")}>Hapus foto</Button>}
          </div>
        </div>
      )}
      {(msg || error) && <p className="text-sm text-danger">{error ?? msg}</p>}
    </div>
  );
}
