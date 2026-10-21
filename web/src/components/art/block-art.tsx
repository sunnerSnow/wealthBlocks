import { getArt } from "@/components/art/assets";

/** 積木素材的 SVG（內容是程式內建的固定字串，所以可以直接放進 innerHTML） */
export function BlockArt({ asset, className }: { asset: string; className?: string }) {
  const [vw, vh, body] = getArt(asset);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
