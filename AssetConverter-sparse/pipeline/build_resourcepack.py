import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import (
    DEPLOY_DIR,
    DEPLOY_ENABLED,
    OUTPUT_ASSETS_DIR,
    PACK_DESCRIPTION,
    PACK_FORMAT,
    PACK_NAME,
    PROJECT_ROOT,
    RESOURCEPACK_DIR,
)

import json
import os
import shutil
import sys

SOURCE_ASSETS_DIR = OUTPUT_ASSETS_DIR
BUILD_DIR = RESOURCEPACK_DIR


def build_pack():
    pack_root = os.path.join(BUILD_DIR, PACK_NAME)
    assets_dest = os.path.join(pack_root, "assets")

    if os.path.exists(pack_root):
        shutil.rmtree(pack_root)

    os.makedirs(assets_dest, exist_ok=True)

    if not os.path.isdir(SOURCE_ASSETS_DIR):
        print(f"[-] No upscaled assets found at {SOURCE_ASSETS_DIR}")
        sys.exit(1)

    namespaces = []
    texture_count = 0
    sidecar_count = 0

    for namespace in sorted(os.listdir(SOURCE_ASSETS_DIR)):
        namespace_src = os.path.join(SOURCE_ASSETS_DIR, namespace)
        if not os.path.isdir(namespace_src):
            continue

        textures_src = os.path.join(namespace_src, "textures")
        if not os.path.isdir(textures_src):
            continue

        textures_dest = os.path.join(assets_dest, namespace, "textures")
        shutil.copytree(textures_src, textures_dest)

        pngs = 0
        metas = 0
        for root, _, files in os.walk(textures_dest):
            for file in files:
                if file.endswith(".png.mcmeta"):
                    metas += 1
                elif file.endswith(".png"):
                    pngs += 1

        texture_count += pngs
        sidecar_count += metas
        namespaces.append(namespace)
        meta_note = f", {metas} sidecars" if metas else ""
        print(f"[+] Included {pngs} textures from {namespace}{meta_note}")

    if texture_count == 0:
        print("[-] No PNG textures found to package.")
        sys.exit(1)

    pack_mcmeta = {
        "pack": {
            "pack_format": PACK_FORMAT,
            "description": PACK_DESCRIPTION,
        }
    }

    with open(os.path.join(pack_root, "pack.mcmeta"), "w", encoding="utf-8") as handle:
        json.dump(pack_mcmeta, handle, indent=2)
        handle.write("\n")

    print(f"[*] Built resource pack at {pack_root}")
    print(
        f"[*] {texture_count} textures, {sidecar_count} sidecars "
        f"across {len(namespaces)} namespaces"
    )
    return pack_root, texture_count


def deploy_pack(pack_root):
    os.makedirs(DEPLOY_DIR, exist_ok=True)
    deploy_path = os.path.join(DEPLOY_DIR, PACK_NAME)

    if os.path.exists(deploy_path):
        shutil.rmtree(deploy_path)

    shutil.copytree(pack_root, deploy_path)
    print(f"[*] Deployed to {deploy_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Build Omni32 resource pack")
    parser.add_argument(
        "--deploy",
        action="store_true",
        help="Copy pack to ASSETCONVERTER_INSTANCE resourcepacks/",
    )
    parser.add_argument(
        "--no-deploy",
        action="store_true",
        help="Skip instance deploy (default unless OMNI32_DEPLOY=1)",
    )
    args = parser.parse_args()

    root, total = build_pack()
    should_deploy = args.deploy or (DEPLOY_ENABLED and not args.no_deploy)
    if should_deploy:
        deploy_pack(root)
        print(f"[*] Done. {total} textures deployed in-game.")
    else:
        print(f"[*] Done. {total} textures in {root}")
        print("[*] Deploy skipped (set OMNI32_DEPLOY=1 or pass --deploy to copy to instance)")