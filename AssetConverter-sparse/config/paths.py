import os

# Repo root (parent of config/)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Override via environment for other machines
PROJECT_ROOT = os.environ.get("ASSETCONVERTER_ROOT", PROJECT_ROOT)

SOURCES_DIR = os.path.join(PROJECT_ROOT, "sources")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")
OUTPUT_ASSETS_DIR = os.path.join(OUTPUT_DIR, "assets")
RESOURCEPACK_DIR = os.path.join(OUTPUT_DIR, "resourcepack")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
CACHE_DIR = os.path.join(PROJECT_ROOT, "local", "cache")
JARS_DIR = os.path.join(PROJECT_ROOT, "local", "jars")

# Omni32 — standalone 32× resource pack product line
PACK_NAME = os.environ.get("OMNI32_PACK_NAME", "Omni32")
PACK_FORMAT = int(os.environ.get("OMNI32_PACK_FORMAT", "15"))  # Minecraft 1.20.1
PACK_DESCRIPTION = os.environ.get(
    "OMNI32_PACK_DESCRIPTION",
    "Omni32 — autonomous 32× upscaled mod textures",
)

# Optional instance deploy (off by default — Omni32 is standalone)
DEPLOY_ENABLED = os.environ.get("OMNI32_DEPLOY", "").lower() in ("1", "true", "yes")
DEFAULT_INSTANCE = r"C:\Users\Bulkl\curseforge\minecraft\Instances\Base-Wars_Stripped"
INSTANCE_DIR = os.environ.get("ASSETCONVERTER_INSTANCE", DEFAULT_INSTANCE)
MODS_DIR = os.path.join(INSTANCE_DIR, "mods")
DEPLOY_DIR = os.path.join(INSTANCE_DIR, "resourcepacks")

# Future: multiple Omni32 pack variants (e.g. Omni32-Tech, Omni32-Decor)
PACK_VARIANTS_DIR = os.path.join(OUTPUT_DIR, "packs")