"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
type Detector = {
  detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
export function BarcodeScanner({
  onScan,
  disabled = false,
}: {
  onScan: (code: string) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState(""),
    [camera, setCamera] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    handler = useRef(onScan);
  handler.current = onScan;
  useEffect(() => {
    if (!camera || disabled) return;
    let stopped = false,
      stream: MediaStream | undefined,
      timer: ReturnType<typeof setTimeout>;
    async function start() {
      try {
        const Ctor = (
          window as unknown as {
            BarcodeDetector?: new (options: { formats: string[] }) => Detector;
          }
        ).BarcodeDetector;
        if (!Ctor)
          throw new Error(
            "Camera barcode detection is unavailable in this browser. Use a USB scanner or enter the code.",
          );
        const detector = new Ctor({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
        });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        async function scan() {
          if (stopped) return;
          try {
            const found = video.current
              ? await detector.detect(video.current)
              : [];
            if (found[0]) {
              handler.current(found[0].rawValue);
              setCamera(false);
              return;
            }
          } catch {
            /* A camera frame may not be ready yet. */
          }
          timer = setTimeout(scan, 250);
        }
        await scan();
      } catch (e) {
        setError((e as Error).message);
        setCamera(false);
      }
    }
    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, disabled]);
  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) {
            onScan(code.trim());
            setCode("");
          }
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Barcode or SKU</span>
          <input
            disabled={disabled}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan barcode or type SKU + Enter"
            autoComplete="off"
          />
        </label>
        <Button disabled={disabled || !code.trim()} aria-label="Submit barcode">
          <ScanBarcode size={18} />
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setError("");
            setCamera((v) => !v);
          }}
          aria-label="Toggle camera"
        >
          <Camera size={18} />
        </Button>
      </form>
      {camera && (
        <video
          ref={video}
          playsInline
          muted
          className="max-h-64 w-full rounded-xl"
        />
      )}
      {error && (
        <p role="status" className="text-sm text-amber-300">
          {error}
        </p>
      )}
    </div>
  );
}
