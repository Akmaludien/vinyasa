/**
 * Ornament behind the scan console: a soft brand glow plus four corner marks
 * that frame the card like a live artboard selection.
 *
 * Everything here is decoration, so the whole layer is aria-hidden and
 * pointer-events-none.
 */

function CropMarks() {
  /* Four corner brackets, like an artboard with a live selection. Outset just
     past the card edge so they read as a marquee around it, not as its border. */
  const corners = [
    "left-0 top-0 border-l border-t",
    "right-0 top-0 border-r border-t",
    "left-0 bottom-0 border-l border-b",
    "right-0 bottom-0 border-r border-b",
  ];
  return (
    <div className="absolute -inset-2.5 hidden lg:block">
      {corners.map((c) => (
        <span key={c} className={`absolute h-3 w-3 border-brand-400/45 ${c}`} />
      ))}
    </div>
  );
}

export function HomeDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      {/* Wider and taller than the card so only the spill is visible. */}
      <div className="decor-aura absolute left-1/2 top-1/2 h-[150%] w-[130%] -translate-x-1/2 -translate-y-1/2" />

      <CropMarks />
    </div>
  );
}
