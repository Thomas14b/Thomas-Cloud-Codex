import { useEffect, useState } from "react";
import QRCode from "qrcode";
export function QR({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: 240,
      margin: 2,
      color: { dark: "#244e42" },
    })
      .then((v) => {
        if (active) setSrc(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value]);
  return src ? (
    <details className="qr">
      <summary>{label}</summary>
      <img src={src} width="180" height="180" alt={label} />
      <a href={src} download="failure-monsters-qr.png">
        下載 QR Code
      </a>
    </details>
  ) : null;
}
