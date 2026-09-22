import { useState } from 'react';

export default function ProductImage({ src, name, className = '' }) {
  const [failedSource, setFailedSource] = useState(null);
  if (!src || failedSource === src) {
    return (
      <div
        className={`flex items-center justify-center bg-teal-50 text-sm text-teal-700 ${className}`}
        role="img"
        aria-label={`Chưa có ảnh: ${name}`}
      >
        Chưa có ảnh
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailedSource(src)}
      className={`bg-slate-100 object-cover ${className}`}
    />
  );
}
