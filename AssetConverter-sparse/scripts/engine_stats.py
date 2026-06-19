"""Print Omni32 engine statistics."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import OUTPUT_ASSETS_DIR, RESOURCEPACK_DIR, PACK_NAME, SOURCES_DIR
from config.registry import MOD_REPOS
from pipeline.queue import discover_pending, pending_mods, queue_status


def count_pngs(root):
    if not os.path.isdir(root):
        return 0
    return sum(
        1
        for _, _, files in os.walk(root)
        for f in files
        if f.endswith(".png")
    )


def main():
    namespaces = []
    total_png = 0
    total_meta = 0
    if os.path.isdir(OUTPUT_ASSETS_DIR):
        for ns in sorted(os.listdir(OUTPUT_ASSETS_DIR)):
            tex = os.path.join(OUTPUT_ASSETS_DIR, ns, "textures")
            if not os.path.isdir(tex):
                continue
            pngs = count_pngs(tex)
            if pngs:
                namespaces.append((ns, pngs))
                total_png += pngs
                total_meta += sum(
                    1
                    for _, _, files in os.walk(tex)
                    for f in files
                    if f.endswith(".png.mcmeta")
                )

    sources = (
        len([d for d in os.listdir(SOURCES_DIR) if os.path.isdir(os.path.join(SOURCES_DIR, d))])
        if os.path.isdir(SOURCES_DIR)
        else 0
    )
    pack_path = os.path.join(RESOURCEPACK_DIR, PACK_NAME)
    pack_built = os.path.isdir(pack_path)

    done, pending = queue_status()
    discovered = discover_pending()

    print("=== Omni32 Engine Stats ===")
    print(f"Registry mods:     {len(MOD_REPOS)}")
    print(f"Source trees:      {sources}")
    print(f"Upscaled ns:       {len(namespaces)}")
    print(f"Total PNG:         {total_png:,}")
    print(f"Sidecars:          {total_meta:,}")
    print(f"Pack built:        {pack_built} ({pack_path})")
    print(f"Queue done:        {len(done)}/{len(done) + len([p for p in pending if p[1] == 'ready'])}")
    print(f"Auto-discovered:   {len(discovered)} pending registry mods")
    if discovered[:10]:
        print(f"  next discover:   {', '.join(discovered[:10])}")
    if pending:
        ready = [m for m, s in pending if s == "ready"]
        if ready:
            print(f"  queue next:      {ready[0]}")


if __name__ == "__main__":
    main()