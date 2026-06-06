import { PIXEL_ITEM_BADGES } from '../lib/constants.js'

export default function PixelItemIcon({ name, earned }) {
  const badge = PIXEL_ITEM_BADGES[name] ?? PIXEL_ITEM_BADGES.card
  const rows = badge.pixels
  const palette = earned ? badge.palette : {
    d: '#9ca3af',
    g: '#d1d5db',
    l: '#f3f4f6',
    y: '#e5e7eb',
    w: '#f9fafb',
    b: '#d1d5db',
    r: '#d1d5db',
    o: '#e5e7eb',
    p: '#d1d5db',
    c: '#e5e7eb',
    k: '#9ca3af',
  }

  return (
    <div className={`grid h-16 w-16 shrink-0 place-items-center border-2 border-gray-900 bg-[#1f2937] p-1 shadow-[4px_4px_0_#d1d5db] ${earned ? '' : 'opacity-70'}`} aria-hidden="true">
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${rows[0].length}, 5px)`,
          imageRendering: 'pixelated',
        }}
      >
        {rows.join('').split('').map((pixel, index) => (
          <span
            key={`${name}-${index}`}
            className="h-[5px] w-[5px]"
            style={{ backgroundColor: pixel === '.' ? 'transparent' : palette[pixel] }}
          />
        ))}
      </div>
    </div>
  )
}
