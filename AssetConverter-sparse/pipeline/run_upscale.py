import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import argparse
import os
from collections import Counter

from PIL import Image

from config.paths import OUTPUT_ASSETS_DIR, SOURCES_DIR
from config.registry import texture_namespace
from pipeline.pixel_scaler import upscale_rgba as hq2x_upscale
from pipeline.texture_policy import (
    SCALE,
    Strategy,
    classify_texture,
    copy_image,
    copy_sidecar,
    nearest_scale,
)
from pipeline.waifu_scaler import upscale_rgba as waifu_upscale
from pipeline.xbrz_scaler import upscale_rgba as xbrz_upscale


METHODS = {
    "hq2x": ("hq2x pixel-art upscale", hq2x_upscale),
    "xbrz": ("xBRZ pixel-art upscale", xbrz_upscale),
    "waifu2x": ("waifu2x 2x (noise=0, anime model)", waifu_upscale),
}


MONOREPO_HOSTS = {
    "mekanismgenerators": "mekanism",
    "mekanismtools": "mekanism",
}

THERMAL_REPO_FOLDERS = [
    "thermal_core",
    "thermal_foundation",
    "thermal_expansion",
    "thermal_innovation",
]


def _texture_roots_in_repos(repo_names, suffix):
    roots = []
    for repo_name in repo_names:
        repo_root = os.path.join(SOURCES_DIR, repo_name)
        if not os.path.isdir(repo_root):
            continue
        for root, _, files in os.walk(repo_root):
            if not root.endswith(suffix):
                continue
            has_png = any(file.endswith(".png") for file in files)
            if not has_png:
                has_png = any(
                    file.endswith(".png")
                    for _, _, walk_files in os.walk(root)
                    for file in walk_files
                )
            if has_png:
                roots.append(root)
    return sorted(set(roots))


def find_source_texture_roots(mod_name):
    namespace = texture_namespace(mod_name)
    suffix = os.path.join("assets", namespace, "textures")
    repo_names = [mod_name]
    if mod_name in MONOREPO_HOSTS:
        repo_names.insert(0, MONOREPO_HOSTS[mod_name])

    if mod_name == "thermal":
        repo_names = THERMAL_REPO_FOLDERS

    roots = _texture_roots_in_repos(repo_names, suffix)
    if roots:
        return roots

    primary = find_source_textures_dir(mod_name)
    if os.path.isdir(primary):
        return [primary]
    return []


def find_source_textures_dir(mod_name):
    namespace = texture_namespace(mod_name)
    suffix = os.path.join("assets", namespace, "textures")
    repo_names = [mod_name]
    if mod_name in MONOREPO_HOSTS:
        repo_names.insert(0, MONOREPO_HOSTS[mod_name])

    candidates = []
    for repo_name in repo_names:
        candidates.extend([
            os.path.join(SOURCES_DIR, repo_name, "src", "main", "resources", suffix),
            os.path.join(
                SOURCES_DIR, repo_name, "common", "src", "main", "resources", suffix
            ),
            os.path.join(
                SOURCES_DIR, repo_name, "Common", "src", "main", "resources", suffix
            ),
            os.path.join(
                SOURCES_DIR, repo_name, "Xplat", "src", "main", "resources", suffix
            ),
            os.path.join(
                SOURCES_DIR,
                repo_name,
                "refinedstorage-common",
                "src",
                "main",
                "resources",
                suffix,
            ),
            os.path.join(
                SOURCES_DIR,
                repo_name,
                "neoforge",
                "src",
                "main",
                "resources",
                suffix,
            ),
            os.path.join(
                SOURCES_DIR,
                repo_name,
                "NeoForge",
                "src",
                "platform-shared",
                "resources",
                suffix,
            ),
        ])

    candidates.extend([
        os.path.join(SOURCES_DIR, mod_name, "src", "main", "resources", suffix),
    ])

    best = ""
    best_count = 0
    for candidate in candidates:
        if not os.path.isdir(candidate):
            continue
        count = sum(
            1
            for root, _, files in os.walk(candidate)
            for file in files
            if file.endswith(".png")
        )
        if count > best_count:
            best = candidate
            best_count = count

    if best:
        return best

    for repo_name in repo_names:
        mod_root = os.path.join(SOURCES_DIR, repo_name)
        if not os.path.isdir(mod_root):
            continue
        for root, _, files in os.walk(mod_root):
            if not root.endswith(suffix):
                continue
            if any(file.endswith(".png") for file in files):
                return root
            for sub_root, _, sub_files in os.walk(root):
                if any(file.endswith(".png") for file in sub_files):
                    return root

    for candidate in candidates:
        if os.path.isdir(candidate):
            return candidate

    # YUNG structure mods (and similar): icon/catalogue PNGs live in Common resources
    for repo_name in repo_names:
        for subpath in (
            os.path.join("Common", "src", "main", "resources"),
            os.path.join("common", "src", "main", "resources"),
        ):
            fallback = os.path.join(SOURCES_DIR, repo_name, subpath)
            if not os.path.isdir(fallback):
                continue
            if any(
                file.endswith(".png")
                for file in os.listdir(fallback)
                if os.path.isfile(os.path.join(fallback, file))
            ):
                return fallback

    # Mods with PNGs directly under assets/<namespace>/ (no textures/ subfolder)
    for repo_name in repo_names:
        assets_ns = os.path.join(
            SOURCES_DIR,
            repo_name,
            "src",
            "main",
            "resources",
            "assets",
            namespace,
        )
        if not os.path.isdir(assets_ns):
            continue
        if any(
            file.endswith(".png")
            for file in os.listdir(assets_ns)
            if os.path.isfile(os.path.join(assets_ns, file))
        ):
            return assets_ns

    return candidates[0]


def texture_paths(mod_name):
    namespace = texture_namespace(mod_name)
    roots = find_source_texture_roots(mod_name)
    source_textures_dir = roots[0] if roots else find_source_textures_dir(mod_name)
    target_project_dir = os.path.join(OUTPUT_ASSETS_DIR, namespace, "textures")
    return source_textures_dir, target_project_dir


def process_texture(src_path, dest_path, mod_name, upscale_fn):
    with Image.open(src_path) as image:
        strategy = classify_texture(image.width, image.height, mod_name)

        if strategy == Strategy.COPY:
            copy_image(src_path, dest_path)
            action = "Copied"
        elif strategy == Strategy.NEAREST:
            upscaled = nearest_scale(image)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            upscaled.save(dest_path, format="PNG")
            action = f"Nearest {SCALE}x"
        else:
            upscaled = upscale_fn(image)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            upscaled.save(dest_path, format="PNG")
            action = f"Upscaled {SCALE}x"

    copy_sidecar(src_path, dest_path)
    return action, strategy


def walk_and_generate(mod_name, method):
    if method not in METHODS:
        raise ValueError(f"Unknown method '{method}'. Choose from: {', '.join(METHODS)}")

    label, upscale_fn = METHODS[method]
    namespace = texture_namespace(mod_name)
    source_roots = find_source_texture_roots(mod_name)
    target_project_dir = os.path.join(OUTPUT_ASSETS_DIR, namespace, "textures")

    if not source_roots:
        print(f"[-] Directory Error: Could not locate source textures for {mod_name}")
        raise SystemExit(1)

    print(f"[*] Processing {mod_name} textures with {label} + smart sizing...")
    if len(source_roots) > 1:
        print(f"[*] Merging {len(source_roots)} source roots")

    processed = 0
    sidecars = 0
    actions: Counter[str] = Counter()

    for source_textures_dir in source_roots:
        for root, _, files in os.walk(source_textures_dir):
            for file in files:
                if not file.endswith(".png"):
                    continue

                src_path = os.path.join(root, file)
                rel_path = os.path.relpath(src_path, source_textures_dir)
                dest_path = os.path.join(target_project_dir, rel_path)

                try:
                    action, strategy = process_texture(
                        src_path, dest_path, mod_name, upscale_fn
                    )
                    processed += 1
                    actions[strategy.value] += 1
                    if os.path.isfile(dest_path + ".mcmeta"):
                        sidecars += 1
                    print(f"[+] {action} [{strategy.value}] -> {rel_path}")
                except Exception as exc:
                    print(f"[-] Failed for: {src_path}")
                    print(f"    {exc}")

    print(f"[*] Done. {processed} textures written to {target_project_dir}")
    print(
        f"[*] Strategies: "
        + ", ".join(f"{name}={actions[name]}" for name in sorted(actions))
    )
    print(f"[*] Sidecars copied: {sidecars}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upscale Minecraft mod textures to 32x (2x).")
    parser.add_argument("mod", help="Mod namespace folder name, e.g. create_connected or minecolonies")
    parser.add_argument(
        "--method",
        choices=sorted(METHODS),
        default="xbrz",
        help="Upscaler for 16x pixel-art textures (default: xbrz).",
    )
    args = parser.parse_args()
    walk_and_generate(args.mod, args.method)