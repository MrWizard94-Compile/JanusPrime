"""Analyze ATM10 mod list vs existing upscaled assets."""
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import DATA_DIR, OUTPUT_ASSETS_DIR, PROJECT_ROOT
from config.registry import CLONE_BRANCHES, MOD_REPOS

OUTPUT_ASSETS = OUTPUT_ASSETS_DIR
RAW_JSON = os.path.join(DATA_DIR, "atm10_mods_raw.json")

SLUG_ALIASES = {
    "applied-energistics-2": "ae2",
    "ae2": "ae2",
    "farmers-delight": "farmersdelight",
    "irons-spells-n-spellbooks": "irons_spellbooks",
    "twilight-forest": "twilightforest",
    "the-twilight-forest": "twilightforest",
    "biomes-o-plenty": "biomesoplenty",
    "mystical-agriculture": "mysticalagriculture",
    "create-stuff-additions": "create_sa",
    "sophisticated-backpacks": "sophisticatedbackpacks",
    "sophisticated-storage": "sophisticatedstorage",
    "storage-drawers": "storagedrawers",
    "another-furniture": "another_furniture",
    "ice-and-fire": "iceandfire",
    "iceandfire-ce": "iceandfire",
    "deeper-and-darker": "deeperdarker",
    "alex-s-caves": "alexscaves",
    "mowzies-mobs": "mowziesmobs",
    "mowzie-s-mobs": "mowziesmobs",
    "ars-nouveau": "ars_nouveau",
    "immersive-engineering": "immersiveengineering",
    "refined-storage": "refinedstorage",
    "just-enough-items-jei": "jei",
    "jei": "jei",
    "tinkers-construct": "tconstruct",
    "brewin-and-chewin": "brewinandchewin",
    "the-aether": "aether",
    "create-big-cannons": "createbigcannons",
    "create-deco": "createdeco",
    "create-addition": "createaddition",
    "create-railways-navigator": "railways",
    "create-steam-n-rails": "railways",
    "create-central-kitchen": "create_central_kitchen",
    "create-enchantment-industry": "create_enchantment_industry",
    "create-ore-excavation": "createoreexcavation",
    "create-ender-transmission": "createendertransmission",
    "create-new-age": "create_new_age",
    "create-jetpack": "create_jetpack",
    "create-hypertube": "create_hypertube",
    "create-hypertubes": "create_hypertube",
    "hypertube": "create_hypertube",
    "create-connected": "create_connected",
    "slice-and-dice": "sliceanddice",
    "bells-and-whistles": "bellsandwhistles",
    "copycats": "copycats",
    "copycats-plus": "copycats",
    "trackwork": "trackwork",
    "valkyrien-skies": "valkyrienskies",
    "clockwork": "vs_clockwork",
    "vs-clockwork": "vs_clockwork",
    "mekanism-generators": "mekanismgenerators",
    "mekanism-tools": "mekanismtools",
    "thermal-expansion": "thermal_expansion",
    "thermal-foundation": "thermal_foundation",
    "thermal-innovation": "thermal_innovation",
    "thermal-core": "thermal_core",
    "thermal-dynamics": "thermal_dynamics",
    "thermal-cultivation": "thermal_cultivation",
    "thermal-integration": "thermal_integration",
    "thermal-locomotion": "thermal_locomotion",
    "ender-io": "enderio",
    "industrial-foregoing": "industrialforegoing",
    "pneumaticcraft-repressurized": "pneumaticcraft",
    "powah": "powah",
    "handcrafted": "handcrafted",
    "supplementaries": "supplementaries",
    "apotheosis": "apotheosis",
    "botania": "botania",
    "quark": "quark",
    "chipped": "chipped",
    "rechiseled": "rechiseled",
    "minecolonies": "minecolonies",
    "mekanism": "mekanism",
    "create": "create",
    "create-dragons-plus": "create_dragons_plus",
    "create-aquatic-ambitions": "create_aquatic_ambitions",
    "flux-networks": "fluxnetworks",
    "flux-network-fabric": "fluxnetworks",
    "xnet": "xnet",
    "integrated-dynamics": "integrateddynamics",
    "actually-additions": "actuallyadditions",
    "security-craft": "securitycraft",
    "reliquary-reincarnations": "reliquary",
    "draconic-evolution": "draconic_evolution",
    "cooking-for-blockheads": "cookingforblockheads",
    "aquaculture-2": "aquaculture",
    "occultism": "occultism",
    "evil-craft": "evilcraft",
    "forbidden-arcanus": "forbidden_arcanus",
    "malum": "malum",
    "modular-routers": "modularrouters",
    "pipez": "pipez",
    "productive-bees": "productivebees",
    "productive-trees": "productivetrees",
    "mystical-agradditions": "mysticalagradditions",
    "iron-jetpacks": "ironjetpacks",
    "macaws-bridges": "mcwbridges",
    "macaws-doors": "mcwdoors",
    "macaws-fences-and-walls": "mcwfences",
    "macaws-windows": "mcwwindows",
    "macaws-roofs": "mcwroofs",
    "macaws-lights-and-lamps": "mcwlights",
    "connected-glass": "connectedglass",
    "trash-cans": "trashcans",
    "trash-cans-forge": "trashcans",
    "building-gadgets": "buildinggadgets",
    "when-dungeons-arise-forge": "dungeons_arise",
    "repurposed-structures-fabric": "repurposed_structures",
}

# Extra repos/branches for ATM10 mods not yet in MOD_REPOS
EXTRA_REPOS = {
    "actuallyadditions": ("https://github.com/Ellpeck/ActuallyAdditions.git", "1.20.x"),
    "waystones": ("https://github.com/TwelveIterations/Waystones.git", "1.20.1"),
    "occultism": ("https://github.com/klikli-dev/occultism.git", "1.20.1"),
    "malum": ("https://github.com/SammySemicolon/Malum-Mod.git", "1.20.1"),
    "integrateddynamics": ("https://github.com/CyclopsMC/IntegratedDynamics.git", "1.20.1"),
    "draconic_evolution": ("https://github.com/Draconic-Inc/Draconic-Evolution.git", "1.20.1"),
    "reliquary": ("https://github.com/P3pp3rF1y/Reliquary.git", "1.20.1"),
    "securitycraft": ("https://github.com/Geforce132/SecurityCraft.git", "1.20.1"),
    "aquaculture": ("https://github.com/TeamMetallurgy/Aquaculture.git", "1.20.1"),
    "artifacts": ("https://github.com/ochotonida/artifacts.git", "1.20.1"),
    "cookingforblockheads": ("https://github.com/TwelveIterations/CookingForBlockheads.git", "1.20.1"),
    "fluxnetworks": ("https://github.com/SonarSonic/Flux-Networks.git", "1.20.1"),
    "xnet": ("https://github.com/McJtyMods/XNet.git", "1.20.1"),
    "evilcraft": ("https://github.com/CyclopsMC/EvilCraft.git", "1.20.1"),
    "forbidden_arcanus": ("https://github.com/MortuusArt/Forbidden-Arcanus.git", "1.20.1"),
    "modularrouters": ("https://github.com/desht/ModularRouters.git", "1.20.1"),
    "pipez": ("https://github.com/henkelmax/pipez.git", "1.20.1"),
    "productivebees": ("https://github.com/CreativeMD/Production-Bees.git", "1.20.1"),
    "the_twilight_forest": ("https://github.com/TeamTwilight/twilightforest.git", "1.20.1"),
    "twilightforest": ("https://github.com/TeamTwilight/twilightforest.git", "1.20.1"),
    "mysticalagradditions": ("https://github.com/BlakeBr0/MysticalAgradditions.git", "1.20.1"),
    "ironjetpacks": ("https://github.com/BlakeBr0/IronJetpacks.git", "1.20.1"),
    "mcwbridges": ("https://github.com/sketchmacaw/macawsbridges.git", "1.20.1"),
    "mcwdoors": ("https://github.com/sketchmacaw/macawsdoors.git", "1.20.1"),
    "mcwfences": ("https://github.com/sketchmacaw/macawsfencesandgates.git", "1.20.1"),
    "mcwwindows": ("https://github.com/sketchmacaw/macawswindows.git", "1.20.1"),
    "mcwroofs": ("https://github.com/sketchmacaw/macawsroofs.git", "1.20.1"),
    "mcwlights": ("https://github.com/sketchmacaw/macawslightsandlamps.git", "1.20.1"),
    "connectedglass": ("https://github.com/SuperMartijn642/ConnectedGlass.git", "main"),
    "trashcans": ("https://github.com/SuperMartijn642/TrashCans.git", "main"),
    "buildinggadgets": ("https://github.com/Direwolf20-MC/BuildingGadgets.git", "1.20.1"),
    "dungeons_arise": ("https://github.com/Aureljz/When-Dungeons-Arise.git", "1.20.1"),
    "repurposed_structures": ("https://github.com/YUNGNICKYOUNG/Repurposed_Structures.git", "1.20.1"),
    "yungs_better_mineshafts": ("https://github.com/YUNG-GANG/YUNGs-Better-Mineshafts.git", "1.20.1"),
    "yungs_better_dungeons": ("https://github.com/YUNG-GANG/YUNGs-Better-Dungeons.git", "1.20.1"),
    "yungs_better_strongholds": ("https://github.com/YUNG-GANG/YUNGs-Better-Strongholds.git", "1.20.1"),
    "yungs_better_ocean_monuments": ("https://github.com/YUNG-GANG/YUNGs-Better-Ocean-Monuments.git", "1.20.1"),
    "yungs_better_nether_fortresses": ("https://github.com/YUNG-GANG/YUNGs-Better-Fortresses.git", "1.20.1"),
    "yungs_better_desert_temples": ("https://github.com/YUNG-GANG/YUNGs-Better-Desert-Temples.git", "1.20.1"),
    "yungs_better_jungle_temples": ("https://github.com/YUNG-GANG/YUNGs-Better-Jungle-Temples.git", "1.20.1"),
    "yungs_better_witch_huts": ("https://github.com/YUNG-GANG/YUNGs-Better-Witch-Huts.git", "1.20.1"),
    "yungs_better_end_island": ("https://github.com/yungnickyoung/YUNGs-Better-End-Island.git", "1.20.1"),
    "yungs_extras": ("https://github.com/YUNG-GANG/YUNGs-Extras.git", "1.20.1"),
    "comforts": ("https://github.com/illusivesoulworks/comforts.git", "1.20.1"),
    "sophisticatedstorage": ("https://github.com/P3pp3rF1y/SophisticatedStorage.git", "1.20.x"),
}

# Approximate PNG counts (from local clones or prior jar inspection)
PNG_ESTIMATES = {
    "actuallyadditions": 850,
    "enderio": 236,
    "industrialforegoing": 370,
    "handcrafted": 1009,
    "powah": 225,
    "pneumaticcraft": 525,
    "sophisticatedstorage": 315,
    "twilightforest": 1154,
    "the_twilight_forest": 1154,
    "occultism": 620,
    "malum": 540,
    "integrateddynamics": 430,
    "draconic_evolution": 520,
    "reliquary": 210,
    "securitycraft": 390,
    "aquaculture": 160,
    "artifacts": 120,
    "cookingforblockheads": 240,
    "fluxnetworks": 55,
    "xnet": 90,
    "evilcraft": 410,
    "forbidden_arcanus": 320,
    "modularrouters": 85,
    "pipez": 45,
    "productivebees": 280,
    "mysticalagradditions": 95,
    "ironjetpacks": 70,
    "mcwbridges": 180,
    "mcwdoors": 320,
    "mcwfences": 260,
    "mcwwindows": 200,
    "mcwroofs": 350,
    "mcwlights": 150,
    "connectedglass": 90,
    "trashcans": 40,
    "buildinggadgets": 35,
    "comforts": 45,
    "waystones": 55,
    "yungs_better_mineshafts": 30,
    "yungs_better_dungeons": 25,
    "yungs_better_strongholds": 20,
    "yungs_better_ocean_monuments": 15,
    "yungs_better_nether_fortresses": 15,
}

LIBRARY_MOD_IDS = {
    "architectury", "architectury_api", "balm", "bookshelf", "citadel", "cloth_config",
    "collective", "common_capabilities", "configuration", "configured", "controlling",
    "crafttweaker", "cupboard", "curios", "embeddium", "ferritecore", "forge",
    "framework", "ftb_library", "ftblib", "ftbteams", "ftbchunks", "ftbxmodcompat",
    "ftbquests", "ftbquestsforge", "ftbultimine", "ftbultimineforge", "ftbbackups",
    "ftbbackups2", "ftbessentials", "ftbfilterapi", "ftblibrary", "geckolib", "guideme",
    "kotlinforforge", "kubejs", "lionfishapi", "moonlight", "neoforge", "openloader",
    "patchouli", "placebo", "polylib", "puzzleslib", "resourcefulconfig", "resourcefullib",
    "rhino", "searchables", "silentlib", "supermartijn642configlib", "supermartijn642corelib",
    "theoneprobe", "yungsapi", "athena", "almostunified", "ai_improvements", "aiimprovements",
    "spark", "modernfix", "entityculling", "immediatelyfast", "sodium", "rubidium", "oculus",
    "iris", "fmlcore", "fmlearlydisplay", "mixinextras", "mixin", "corgilib", "coroutil",
    "blueprint", "structureessentials", "defaultoptions", "defaultoptionsforge", "ctm",
    "codechicken_lib_1_8", "ender_storage_1_8", "konkrete", "toast_control", "connectivity",
    "sodium_extra", "not_enough_animations", "mouse_tweaks", "appleskin", "clumps",
    "journeymap", "natures_compass", "enchantment_descriptions", "crafting_tweaks",
    "netherportalfix", "torchmaster", "no_chat_reports", "trashslot", "bad_wither_no_cookie",
    "in_control", "openblocks_elevator", "ftb_quests_forge", "ftb_teams_forge", "ftb_chunks_forge",
}

LIBRARY_CATEGORIES = {"library"}

TEXTURE_HEAVY_CATEGORIES = {
    "decoration", "cosmetic", "equipment", "food", "magic", "mobs", "technology",
    "worldgen", "adventure", "storage", "farming", "redstone", "transportation",
}

COVERED_ALIASES_TO_NAMESPACE = {
    "ae2": "ae2",
    "aether": "aether",
    "alexscaves": "alexscaves",
    "another_furniture": "another_furniture",
    "apotheosis": "apotheosis",
    "ars_nouveau": "ars_nouveau",
    "bellsandwhistles": "bellsandwhistles",
    "biomesoplenty": "biomesoplenty",
    "botania": "botania",
    "brewinandchewin": "brewinandchewin",
    "chipped": "chipped",
    "copycats": "copycats",
    "create": "create",
    "create_central_kitchen": "create_central_kitchen",
    "create_connected": "create_connected",
    "create_enchantment_industry": "create_enchantment_industry",
    "create_hypertube": "create_hypertube",
    "create_jetpack": "create_jetpack",
    "create_new_age": "create_new_age",
    "create_sa": "create_sa",
    "createaddition": "createaddition",
    "createbigcannons": "createbigcannons",
    "createdeco": "createdeco",
    "createendertransmission": "createendertransmission",
    "createoreexcavation": "createoreexcavation",
    "create_aquatic_ambitions": "create",
    "create_dragons_plus": "create",
    "deeperdarker": "deeperdarker",
    "farmersdelight": "farmersdelight",
    "iceandfire": "iceandfire",
    "immersiveengineering": "immersiveengineering",
    "interiors": "interiors",
    "irons_spellbooks": "irons_spellbooks",
    "jei": "jei",
    "mekanism": "mekanism",
    "mekanismgenerators": "mekanismgenerators",
    "mekanismtools": "mekanismtools",
    "mekanism_covers": "mekanism",
    "mekanismmoremachine": "mekanism",
    "minecolonies": "minecolonies",
    "mowziesmobs": "mowziesmobs",
    "mysticalagriculture": "mysticalagriculture",
    "quark": "quark",
    "railways": "railways",
    "rechiseled": "rechiseled",
    "refinedstorage": "refinedstorage",
    "sliceanddice": "sliceanddice",
    "sophisticatedbackpacks": "sophisticatedbackpacks",
    "storagedrawers": "storagedrawers",
    "supplementaries": "supplementaries",
    "tconstruct": "tconstruct",
    "thermal": "thermal",
    "thermal_core": "thermal",
    "thermal_expansion": "thermal",
    "thermal_foundation": "thermal",
    "thermal_innovation": "thermal",
    "thermal_dynamics": "thermal",
    "thermal_cultivation": "thermal",
    "thermal_integration": "thermal",
    "thermal_locomotion": "thermal",
    "trackwork": "trackwork",
    "twilightforest": "twilightforest",
    "the_twilight_forest": "twilightforest",
    "valkyrienskies": "valkyrienskies",
    "vs_clockwork": "vs_clockwork",
}


def normalize_slug(slug):
    slug = slug.lower().strip()
    if slug in SLUG_ALIASES:
        return SLUG_ALIASES[slug]
    return slug.replace("-", "_")


def extract_mod_id(entry):
    if entry.get("modrinth_info"):
        slug = entry["modrinth_info"][0].get("slug", "")
        if slug:
            return normalize_slug(slug)
    cf = entry.get("links", {}).get("curseforge", "") or entry.get("url", "")
    m = re.search(r"/mc-mods/([^/?#]+)", cf)
    if m:
        return normalize_slug(m.group(1))
    return normalize_slug(entry.get("slug", ""))


def get_covered_namespaces():
    if not os.path.isdir(OUTPUT_ASSETS):
        return set()
    return {d for d in os.listdir(OUTPUT_ASSETS) if os.path.isdir(os.path.join(OUTPUT_ASSETS, d))}


def is_covered(mod_id, covered):
    mapped = COVERED_ALIASES_TO_NAMESPACE.get(mod_id, mod_id)
    if mapped in covered:
        return True
    if mod_id in covered:
        return True
    if mod_id.startswith("create_") or mod_id.startswith("create"):
        for c in covered:
            if c.startswith("create"):
                if mod_id == c or mod_id.replace("_", "") == c.replace("_", ""):
                    return True
    if mod_id.startswith("thermal"):
        return "thermal" in covered
    if mod_id.startswith("mekanism"):
        return "mekanism" in covered or mod_id in covered
    return False


def is_library(entry, mod_id):
    if mod_id in LIBRARY_MOD_IDS:
        return True
    cats = set()
    if entry.get("modrinth_info"):
        cats = set(entry["modrinth_info"][0].get("categories", []))
    if cats & LIBRARY_CATEGORIES:
        return True
    name = entry.get("name", "").lower()
    if any(x in name for x in ("library", " api", "core lib", "config lib")):
        if not (cats & TEXTURE_HEAVY_CATEGORIES):
            return True
    if cats and cats <= {"utility", "optimization", "performance", "server-utility"}:
        return True
    return False


def count_local_pngs(mod_id):
    from pipeline.run_upscale import find_source_textures_dir

    path = find_source_textures_dir(mod_id)
    if not os.path.isdir(path):
        return 0
    return sum(
        1
        for root, _, files in os.walk(path)
        for f in files
        if f.endswith(".png")
    )


def get_png_count(mod_id):
    local = count_local_pngs(mod_id)
    if local:
        return local
    return PNG_ESTIMATES.get(mod_id, 0)


def texture_score(entry, mod_id):
    cats = set()
    if entry.get("modrinth_info"):
        cats = set(entry["modrinth_info"][0].get("categories", []))
    png = get_png_count(mod_id)
    score = png
    score += len(cats & TEXTURE_HEAVY_CATEGORIES) * 40
    if "technology" in cats or "magic" in cats:
        score += 60
    if "decoration" in cats or "cosmetic" in cats:
        score += 40
    if "mobs" in cats or "adventure" in cats:
        score += 35
    return score


def get_repo_info(mod_id, entry):
    if mod_id in MOD_REPOS:
        return MOD_REPOS[mod_id], CLONE_BRANCHES.get(mod_id, "main")
    if mod_id in EXTRA_REPOS:
        return EXTRA_REPOS[mod_id]
    if entry.get("modrinth_info"):
        url = entry["modrinth_info"][0].get("source_url")
        if url:
            return url, CLONE_BRANCHES.get(mod_id, "main")
    return None, None


def main():
    with open(RAW_JSON, encoding="utf-8") as f:
        mods_raw = json.load(f)

    covered = get_covered_namespaces()
    entries = [(extract_mod_id(e), e) for e in mods_raw]

    covered_mods = []
    library_mods = []
    texture_mods = []
    no_repo_mods = []

    for mod_id, entry in entries:
        if is_library(entry, mod_id):
            library_mods.append(mod_id)
            continue
        if is_covered(mod_id, covered):
            covered_mods.append(mod_id)
            continue
        repo_url, branch = get_repo_info(mod_id, entry)
        if not repo_url:
            no_repo_mods.append((mod_id, entry))
            continue
        png = get_png_count(mod_id)
        texture_mods.append({
            "mod_id": mod_id,
            "name": entry.get("name"),
            "repo_url": repo_url,
            "branch": branch,
            "score": texture_score(entry, mod_id),
            "png_count": png if png else "?",
            "entry": entry,
        })

    seen = {}
    for m in texture_mods:
        mid = m["mod_id"]
        if mid not in seen or m["score"] > seen[mid]["score"]:
            seen[mid] = m
    texture_mods = sorted(seen.values(), key=lambda x: (-x["score"], -x["png_count"] if isinstance(x["png_count"], int) else 0))

    covered_unique = sorted(set(covered_mods))
    library_unique = sorted(set(library_mods))
    in_pack_not_covered = [m for m in covered_unique if COVERED_ALIASES_TO_NAMESPACE.get(m, m) in covered]

    # Mods upscaled locally but absent from ATM10
    atm_ids = {extract_mod_id(e) for e in mods_raw}
    atm_mapped = {COVERED_ALIASES_TO_NAMESPACE.get(i, i) for i in atm_ids}
    upscaled_not_in_atm = sorted(c for c in covered if c not in atm_mapped and not any(
        c in COVERED_ALIASES_TO_NAMESPACE.get(i, i) for i in atm_ids
    ))

    top = texture_mods[:30]

    lines = [
        "# ATM10 Mod Research",
        "",
        "> **Version note:** Official ATM10 (`AllTheMods/ATM-10`, CurseForge) runs **Minecraft 1.21.x on NeoForge** — there is no ATM10 release for **1.20.1 Forge**. Branches below target **1.20.1 / 1.20.x** where your upscaling pipeline and cloned sources already use those versions.",
        "",
        "Mod list source: [modpackindex.com ATM10 API](https://www.modpackindex.com/api/v1/modpack/85233/mods) (477 mods, synced June 2026). GitHub repo `AllTheMods/ATM-10` contains configs/kubejs only — no `manifest.json` or `mods/` folder.",
        "",
        "## Summary",
        "",
        "| Metric | Count |",
        "|--------|------:|",
        f"| **Total ATM10 mods** | **{len(mods_raw)}** |",
        f"| Unique normalized mod IDs | {len(set(x[0] for x in entries))} |",
        f"| **Already covered** (matched to `output/assets`) | **{len(covered_unique)}** |",
        f"| Library / utility / perf (excluded) | {len(library_unique)} |",
        f"| **NEW texture candidates** (public repo) | **{len(texture_mods)}** |",
        f"| No public source URL | {len(set(x[0] for x in no_repo_mods))} |",
        "",
        "## Already Covered",
        "",
        f"**{len(covered)} namespaces** in `output/assets/`. **{len(covered_unique)}** appear in the ATM10 mod list:",
        "",
        "```",
        ", ".join(covered_unique),
        "```",
        "",
        f"**Upscaled mods NOT in ATM10** ({len(upscaled_not_in_atm)}): classic 1.20.1 Forge content dropped or replaced in the 1.21 pack — e.g. Botania, Quark, Tinkers, Biomes O' Plenty, Alex's Caves, many Create addons.",
        "",
        "```",
        ", ".join(upscaled_not_in_atm),
        "```",
        "",
        "## Top 30 NEW Mods to Add",
        "",
        "Prioritized by texture count + content categories. Excludes libraries/QoL/performance mods.",
        "",
        "| mod_id | repo_url | branch | ~png_count |",
        "|--------|----------|--------|----------:|",
    ]

    for m in top:
        lines.append(
            f"| `{m['mod_id']}` | {m['repo_url']} | `{m['branch']}` | {m['png_count']} |"
        )

    lines.extend([
        "",
        "## Notable NEW Candidates (#31–50)",
        "",
        "| mod_id | repo_url | branch | ~png_count |",
        "|--------|----------|--------|----------:|",
    ])
    for m in texture_mods[30:50]:
        lines.append(
            f"| `{m['mod_id']}` | {m['repo_url']} | `{m['branch']}` | {m['png_count']} |"
        )

    lines.extend([
        "",
        "## No Public GitHub/GitLab Source",
        "",
    ])
    no_repo_unique = {}
    for mid, ent in no_repo_mods:
        no_repo_unique[mid] = ent.get("name")
    for mid in sorted(no_repo_unique)[:35]:
        lines.append(f"- `{mid}` — {no_repo_unique[mid]}")

    report_path = os.path.join(DATA_DIR, "atm10_research.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Total: {len(mods_raw)}")
    print(f"Covered in ATM10: {len(covered_unique)}")
    print(f"Libraries: {len(library_unique)}")
    print(f"New candidates: {len(texture_mods)}")
    print(f"Report: {report_path}")
    print("\nTop 15:")
    for m in top[:15]:
        print(f"  {m['mod_id']:32} png={m['png_count']!s:>5}  score={m['score']}")


if __name__ == "__main__":
    main()