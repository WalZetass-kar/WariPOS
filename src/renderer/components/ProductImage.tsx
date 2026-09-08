import { useState, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'

interface ProductImageProps {
  src?: string | null
  alt?: string
  /** Tailwind size/shape classes for the wrapper, e.g. "w-11 h-11 rounded-xl" */
  className?: string
  /** Icon size in px */
  iconSize?: number
  /** Draw a hairline border around the box (default true) */
  bordered?: boolean
}

/**
 * Product thumbnail that always renders a clean box: the photo when it loads,
 * a neutral icon placeholder when the src is missing OR the image fails to load
 * (404, bad path, offline). Prevents broken-image glyphs and sprawling alt text.
 */
export default function ProductImage({
  src,
  alt = '',
  className = 'w-11 h-11 rounded-xl',
  iconSize = 18,
  bordered = true,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false)

  // Reset the error state whenever the source changes.
  useEffect(() => {
    setFailed(false)
  }, [src])

  const showImage = !!src && !failed

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800 ${bordered ? 'border border-slate-200 dark:border-slate-800' : ''} ${className}`}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <ImageIcon size={iconSize} className="text-slate-400 opacity-60" />
      )}
    </div>
  )
}
