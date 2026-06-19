import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import os
import re
import shutil
import zipfile

MODS_DIR = r"C:\Users\Bulkl\curseforge\minecraft\Instances\Base-Wars_Stripped\mods"

SKIP_MODS = {
    "controlling",
    "searchables",
    "embeddium",
    "ferritecore",

    "theoneprobe",
    "ritchiesprojectilelib",
    "kotlinforforge",
}

MOD_REPOS = {
    "bellsandwhistles": "https://github.com/sudoLev/BellsAndWhistlesMod.git",
    "copycats": "https://github.com/copycats-plus/copycats.git",
    "create": "https://github.com/Creators-of-Create/Create.git",
    "create_connected": "https://github.com/hlysine/create_connected.git",
    "create_central_kitchen": "https://github.com/DragonsPlusMinecraft/CreateCentralKitchen.git",
    "create_enchantment_industry": "https://github.com/DragonsPlusMinecraft/CreateEnchantmentIndustry.git",
    "create_hypertube": "https://github.com/PedroRok/CreateHypertubes.git",
    "create_jetpack": "https://github.com/PssbleTrngle/CreateJetpack.git",
    "create_new_age": "https://gitlab.com/antarcticgardens/create-new-age.git",
    "createaddition": "https://github.com/mrh0/createaddition.git",
    "createbigcannons": "https://github.com/Cannoneers-of-Create/CreateBigCannons.git",
    "createdeco": "https://github.com/talrey/CreateDeco.git",
    "createendertransmission": "https://github.com/Forsteri123/CreateEnderTransmission.git",
    "createoreexcavation": "https://github.com/tom5454/Create-Ore-Excavation.git",
    "farmersdelight": "https://github.com/vectorwing/FarmersDelight.git",
    "interiors": "https://github.com/sudolev/CreateInteriorsMod.git",
    "minecolonies": "https://github.com/ldtteam/minecolonies.git",
    "railways": "https://github.com/Layers-of-Railways/Railway.git",
    "sliceanddice": "https://github.com/PssbleTrngle/SliceAndDice.git",
    "trackwork": "https://github.com/Endalion/trackwork.git",
    "valkyrienskies": "https://github.com/ValkyrienSkies/Valkyrien-Skies-2.git",
    "vs_clockwork": "https://github.com/ValkyrienSkies/Clockwork.git",
    "mekanism": "https://github.com/mekanism/Mekanism.git",
    "ae2": "https://github.com/AppliedEnergistics/Applied-Energistics-2.git",
    "refinedstorage": "https://github.com/refinedmods/refinedstorage2.git",
    "thermal_core": "https://github.com/CoFH/ThermalCore.git",
    "thermal_foundation": "https://github.com/CoFH/ThermalFoundation.git",
    "thermal_expansion": "https://github.com/CoFH/ThermalExpansion.git",
    "thermal_innovation": "https://github.com/CoFH/ThermalInnovation.git",
    "twilightforest": "https://github.com/TeamTwilight/twilightforest.git",
    "ars_nouveau": "https://github.com/baileyholl/Ars-Nouveau.git",
    "botania": "https://github.com/VazkiiMods/Botania.git",
    "sophisticatedbackpacks": "https://github.com/P3pp3rF1y/SophisticatedBackpacks.git",
    "storagedrawers": "https://github.com/jaquadro/StorageDrawers.git",
    "jei": "https://github.com/mezz/JustEnoughItems.git",
    # Popular Forge 1.20.1 mods (high CurseForge downloads)
    "tconstruct": "https://github.com/SlimeKnights/TinkersConstruct.git",
    "chipped": "https://github.com/terrarium-earth/Chipped.git",
    "supplementaries": "https://github.com/MehVahdJukaar/Supplementaries.git",
    "quark": "https://github.com/VazkiiMods/Quark.git",
    "biomesoplenty": "https://github.com/Glitchfiend/BiomesOPlenty.git",
    "immersiveengineering": "https://github.com/BluSunrize/ImmersiveEngineering.git",
    "iceandfire": "https://github.com/AlexModGuy/Ice_and_Fire.git",
    "alexscaves": "https://github.com/AlexModGuy/AlexsCaves.git",
    "apotheosis": "https://github.com/Shadows-of-Fire/Apotheosis.git",
    "irons_spellbooks": "https://github.com/iron431/Irons-Spells-n-Spellbooks.git",
    "mysticalagriculture": "https://github.com/BlakeBr0/MysticalAgriculture.git",
    "aether": "https://github.com/The-Aether-Team/The-Aether.git",
    "another_furniture": "https://github.com/crispytwig/AnotherFurniture.git",
    "rechiseled": "https://github.com/SuperMartijn642/Rechiseled.git",
    "mowziesmobs": "https://github.com/BobMowzie/MowziesMobs-Public.git",
    "brewinandchewin": "https://github.com/MerchantCalico/BrewinAndChewin.git",
    "deeperdarker": "https://github.com/KyaniteMods/DeeperAndDarker.git",
    "enderio": "https://github.com/Team-EnderIO/EnderIO.git",
    "industrialforegoing": "https://github.com/InnovativeOnlineIndustries/Industrial-Foregoing.git",
    "pneumaticcraft": "https://github.com/TeamPneumatic/pnc-repressurized.git",
    "powah": "https://github.com/Technici4n/Powah.git",
    "sophisticatedstorage": "https://github.com/P3pp3rF1y/SophisticatedStorage.git",
    "handcrafted": "https://github.com/terrarium-earth/Handcrafted.git",
    # ATM10 texture-heavy mods (1.20.1 branches)
    "actuallyadditions": "https://github.com/Ellpeck/ActuallyAdditions.git",
    "occultism": "https://github.com/klikli-dev/occultism.git",
    "draconicevolution": "https://github.com/Draconic-Inc/Draconic-Evolution.git",
    "securitycraft": "https://github.com/Geforce132/SecurityCraft.git",
    "forbidden_arcanus": "https://github.com/stal111/Forbidden-Arcanus.git",
    "evilcraft": "https://github.com/CyclopsMC/EvilCraft.git",
    "integrateddynamics": "https://github.com/CyclopsMC/IntegratedDynamics.git",
    "mcwroofs": "https://github.com/sketchmacaw/macawsroofs.git",
    "mcwdoors": "https://github.com/sketchmacaw/MacawsDoors.git",
    "mcwfences": "https://github.com/sketchmacaw/Fences.git",
    "mcwwindows": "https://github.com/sketchmacaw/macawswindows.git",
    "mcwbridges": "https://github.com/sketchmacaw/Bridges.git",
    "mcwlights": "https://github.com/sketchmacaw/macawslightsandlamps.git",
    "reliquary": "https://github.com/P3pp3rF1y/Reliquary.git",
    "productivebees": "https://github.com/JDKDigital/productive-bees.git",
    "cookingforblockheads": "https://github.com/TwelveIterations/CookingForBlockheads.git",
    "aquaculture": "https://github.com/TeamMetallurgy/Aquaculture.git",
    "mysticalagradditions": "https://github.com/BlakeBr0/MysticalAgradditions.git",
    "waystones": "https://github.com/TwelveIterations/Waystones.git",
    "trashcans": "https://github.com/SuperMartijn642/TrashCans.git",
    "ironjetpacks": "https://github.com/BlakeBr0/IronJetpacks.git",
    "artifacts": "https://github.com/ochotonida/artifacts.git",
    "xnet": "https://github.com/McJtyMods/XNet.git",
    "fluxnetworks": "https://github.com/SonarSonic/Flux-Networks.git",
    "comforts": "https://github.com/illusivesoulworks/comforts.git",
}

CLONE_BRANCHES = {
    "tconstruct": "1.20.1",
    "another_furniture": "1.20.1",
    "rechiseled": "forge-1.20",
    "irons_spellbooks": "1.20.1-legacy",
    "brewinandchewin": "1.20.1",
    "deeperdarker": "forge-1.20",
    "aether": "1.20.1-develop",
    "apotheosis": "1.20",
    "enderio": "1.20.1",
    "industrialforegoing": "release-1.20",
    "pneumaticcraft": "1.20.1",
    "powah": "1.20.1",
    "sophisticatedstorage": "1.20.x",
    "handcrafted": "1.20.1",
    "actuallyadditions": "1.20.1",
    "occultism": "version/1.20.1",
    "draconicevolution": "1.20",
    "securitycraft": "1.20.1",
    "forbidden_arcanus": "1.20.x",
    "evilcraft": "master-1.20-lts",
    "integrateddynamics": "master-1.20-lts",
    "mcwdoors": "main",
    "mcwfences": "main",
    "mcwbridges": "main",
    "reliquary": "1.20.x",
    "productivebees": "dev-1.20.0",
    "cookingforblockheads": "1.20.1",
    "aquaculture": "AQ2-1.20.1",
    "mysticalagradditions": "1.20",
    "waystones": "1.20.1",
    "ironjetpacks": "1.20",
    "artifacts": "1.20.1",
    "xnet": "1.20",
    "fluxnetworks": "1.20",
    "comforts": "1.20.x",
}

JAR_ONLY_MODS = {
    "create_sa": "create-stuff-additions1.20.1_v2.1.2.jar",
}

JAR_FALLBACK_MODS = {
    "create_central_kitchen": "create_central_kitchen-1.20.1-for-create-6.0.8-1.5.0.jar",
    "create_enchantment_industry": "create_enchantment_industry-1.4.0-for-create-6.0.8.jar",
    "createoreexcavation": "createoreexcavation-1.20-1.6.5.jar",
    "sliceanddice": "sliceanddice-forge-3.6.0.jar",
}

# Closed-source Macaw's mods (and code-only sketchmacaw repos) — 1.20.1 Forge jars.
MODRINTH_JAR_MODS = {
    "mcwroofs": (
        "https://cdn.modrinth.com/data/B8jaH3P1/versions/31e80GhE/mcw-roofs-2.3.2-mc1.20.1forge.jar",
        "mcw-roofs-2.3.2-mc1.20.1forge.jar",
    ),
    "mcwdoors": (
        "https://cdn.modrinth.com/data/kNxa8z3e/versions/n8BlIUm3/mcw-doors-1.1.5-mc1.20.1forge.jar",
        "mcw-doors-1.1.5-mc1.20.1forge.jar",
    ),
    "mcwfences": (
        "https://cdn.modrinth.com/data/GmwLse2I/versions/HnyfcyJ9/mcw-mcwfences-1.2.1-mc1.20.1forge.jar",
        "mcw-mcwfences-1.2.1-mc1.20.1forge.jar",
    ),
    "mcwwindows": (
        "https://cdn.modrinth.com/data/C7I0BCni/versions/SSIlzrPf/mcw-mcwwindows-2.4.2-mc1.20.1forge.jar",
        "mcw-mcwwindows-2.4.2-mc1.20.1forge.jar",
    ),
    "mcwbridges": (
        "https://cdn.modrinth.com/data/GURcjz8O/versions/KImk0Oo1/mcw-bridges-3.1.2-mc1.20.1forge.jar",
        "mcw-bridges-3.1.2-mc1.20.1forge.jar",
    ),
    "mcwlights": (
        "https://cdn.modrinth.com/data/w4an97C2/versions/H1a9Tx4h/mcw-lights-1.1.5-mc1.20.1forge.jar",
        "mcw-lights-1.1.5-mc1.20.1forge.jar",
    ),
}


def count_pngs(path):
    if not os.path.isdir(path):
        return 0
    return sum(
        1
        for root, _, files in os.walk(path)
        for file in files
        if file.endswith(".png")
    )


def count_mcmeta(path):
    if not os.path.isdir(path):
        return 0
    return sum(
        1
        for root, _, files in os.walk(path)
        for file in files
        if file.endswith(".png.mcmeta")
    )


def jar_texture_count(mod_id, jar_name):
    jar_path = os.path.join(MODS_DIR, jar_name)
    if not os.path.isfile(jar_path):
        return 0
    prefix = f"assets/{mod_id}/textures/"
    with zipfile.ZipFile(jar_path) as archive:
        return sum(
            1
            for name in archive.namelist()
            if name.startswith(prefix) and name.endswith(".png")
        )


def ensure_best_source(mod_id, repo_url=None):
    from run_upscale import find_source_textures_dir

    if mod_id in JAR_ONLY_MODS:
        return extract_textures_from_jar(mod_id, JAR_ONLY_MODS[mod_id])

    repo_count = count_pngs(find_source_textures_dir(mod_id)) if os.path.isdir(
        os.path.join(PROJECT_ROOT, mod_id)
    ) else 0

    jar_name = JAR_FALLBACK_MODS.get(mod_id)
    if jar_name:
        jar_count = jar_texture_count(mod_id, jar_name)
        if jar_count > repo_count:
            return extract_textures_from_jar(mod_id, jar_name)

    return repo_count


def list_instance_mods():
    mods = {}
    for jar in sorted(os.listdir(MODS_DIR)):
        if not jar.endswith(".jar"):
            continue
        path = os.path.join(MODS_DIR, jar)
        with zipfile.ZipFile(path) as archive:
            tomls = [
                name
                for name in archive.namelist()
                if name.endswith("mods.toml") or name.endswith("neoforge.mods.toml")
            ]
            if not tomls:
                continue
            data = archive.read(tomls[0]).decode("utf-8", errors="replace")
            mod_id = re.search(r'modId\s*=\s*"([^"]+)"', data)
            if not mod_id:
                continue
            mod_id = mod_id.group(1)
            if mod_id in SKIP_MODS:
                continue
            texture_count = sum(
                1
                for name in archive.namelist()
                if f"assets/{mod_id}/textures/" in name and name.endswith(".png")
            )
            if texture_count == 0:
                continue
            mods[mod_id] = {"jar": jar, "textures": texture_count}
    return mods


def download_modrinth_jar(mod_id):
    import urllib.request

    entry = MODRINTH_JAR_MODS.get(mod_id)
    if not entry:
        return None
    url, jar_name = entry
    os.makedirs(MODS_DIR, exist_ok=True)
    jar_path = os.path.join(MODS_DIR, jar_name)
    if not os.path.isfile(jar_path):
        print(f"[*] {mod_id}: downloading jar from modrinth")
        urllib.request.urlretrieve(url, jar_path)
    return jar_name


def extract_textures_from_jar(mod_id, jar_name):
    jar_path = os.path.join(MODS_DIR, jar_name)
    dest_root = os.path.join(
        PROJECT_ROOT,
        mod_id,
        "src",
        "main",
        "resources",
        "assets",
        mod_id,
        "textures",
    )
    prefix = f"assets/{mod_id}/textures/"

    if os.path.isdir(dest_root):
        shutil.rmtree(dest_root)

    extracted = 0
    with zipfile.ZipFile(jar_path) as archive:
        for name in archive.namelist():
            if not name.startswith(prefix):
                continue
            if not (name.endswith(".png") or name.endswith(".png.mcmeta")):
                continue
            rel_path = name[len(prefix) :]
            dest_path = os.path.join(dest_root, rel_path)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with archive.open(name) as src, open(dest_path, "wb") as dst:
                dst.write(src.read())
            if name.endswith(".png"):
                extracted += 1

    return extracted