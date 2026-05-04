import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReceiptCaptureProps {
  onCapture: (file: File) => void;
}

export function ReceiptCapture({ onCapture }: ReceiptCaptureProps) {
  const [mode, setMode] = useState<'idle' | 'camera'>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setStream(s);
      setMode('camera');
      // Wait for video element to mount
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
      });
    } catch (err) {
      // Camera not available — silently fall back to file picker
      setMode('idle');
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setMode('idle');
  }, [stream]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      }
    }, 'image/jpeg', 0.9);

    stopCamera();
  }, [onCapture, stopCamera]);

  return (
    <div>
      {mode === 'idle' ? (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={startCamera}>
            <Camera size={14} />
            Scan receipt
          </Button>
        </div>
      ) : (
        <div className="relative" style={{ maxWidth: 400 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full"
            style={{ border: '1px solid #1A1814' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2 mt-2">
            <Button variant="primary" size="sm" onClick={capturePhoto}>
              <Camera size={12} />
              Capture
            </Button>
            <Button variant="ghost" size="sm" onClick={stopCamera}>
              <X size={12} />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
