import os
import re
import shutil
import zipfile

from config.paths import JARS_DIR, MODS_DIR, PROJECT_ROOT, SOURCES_DIR

# Registry mod_id -> Minecraft asset namespace (when they differ)
MOD_NAMESPACES = {
    "oh_the_biomes_weve_gone": "biomeswevegone",
    "railcraft_reborn": "railcraft",
    "relics_mod": "relics",
    "extreme_reactors": "bigreactors",
    "reliquified_artifacts": "relics",
    "iron_furnaces": "ironfurnaces",
    "the_undergarden": "undergarden",
    "storage_delight": "storagedelight",
    "integrated_terminals": "integratedterminals",
    "rftools_utility": "rftoolsutility",
    "rftools_base": "rftoolsbase",
    "rftools_storage": "rftoolsstorage",
    "ars_energistique": "arseng",
    "wireless_chargers": "wirelesschargers",
    "functional_storage": "functionalstorage",
    "creeper_overhaul": "creeperoverhaul",
    "yungs_better_mineshafts": "bettermineshafts",
    "yungs_better_dungeons": "betterdungeons",
    "yungs_better_strongholds": "betterstrongholds",
    "yungs_better_ocean_monuments": "betteroceanmonuments",
    "yungs_better_nether_fortresses": "betterfortresses",
    "yungs_extras": "yungsextras",
    "yungs_better_desert_temples": "betterdeserttemples",
    "yungs_better_witch_huts": "betterwitchhuts",
    "yungs_better_jungle_temples": "betterjungletemples",
    "yungs_better_end_island": "betterendisland",
    "mo_structures": "mostructures",
    "simple_magnets": "simplemagnets",
    "creeperhost_presents_steves_carts": "stevescarts",
    "mega": "megacells",
    "cable_tiers": "cabletiers",
    "extra_disks": "extradisks",
    "applied_mekanistics": "appmek",
    "ranged_pumps": "rangedpumps",
    "ae2_import_export_card": "ae2importexportcard",
    "item_collectors": "itemcollectors",
    "universal_grid": "universalgrid",
    "interdimensional_wireless_transmitter": "creativewirelesstransmitter",
    "silents_gems": "silentgems",
    "advancedae": "advanced_ae",
    "rftools_power": "rftoolspower",
    "rftools_builder": "rftoolsbuilder",
    "living_things": "livingthings",
    "baubley_heart_canisters": "bhc",
    "cpm_fabric": "compactmachines",
    "mekanistic_routers": "mekanisticrouters",
    "natures_aura": "naturesaura",
    "more_red": "morered",
    "integrated_tunnels": "integratedtunnels",
    "integrated_crafting": "integratedcrafting",
    "integrated_scripting": "integratedscripting",
    "explorers_compass": "explorerscompass",
    "industrial_foregoing_souls": "industrialforegoingsouls",
    "laser_bridges_and_doors": "laserbridges",
    "thermal_core": "thermal",
    "thermal_foundation": "thermal",
    "thermal_expansion": "thermal",
    "thermal_innovation": "thermal",
    "mekanismgenerators": "mekanism",
    "mekanismtools": "mekanism",
}


def texture_namespace(mod_id):
    return MOD_NAMESPACES.get(mod_id, mod_id)


SKIP_MODS = {
    "controlling",
    "searchables",
    "embeddium",
    "ferritecore",

    "theoneprobe",
    "ritchiesprojectilelib",
    "kotlinforforge",
}

# Datapack / structure mods with no assets/<ns>/textures (pack icon only).
TEXTURELESS_MODS = {
    "structory",
    "structory_towers",
    "moogs_voyager_structures",
    "mes_moogs_end_structures",
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
    # MOD_QUEUE top-15 (ATM10 priority, not yet upscaled)
    "oh_the_biomes_weve_gone": "https://github.com/Potion-Studios/Oh-The-Biomes-Weve-Gone.git",
    "railcraft_reborn": "https://github.com/railcraft-reborn/railcraft.git",
    "eternal_starlight": "https://github.com/LeoMinecraftModding/eternal-starlight.git",
    "the_undergarden": "https://github.com/quek04/The-Undergarden.git",
    "productivetrees": "https://github.com/JDKDigital/productivetrees.git",
    "extreme_reactors": "https://github.com/ZeroNoRyouki/ExtremeReactors2.git",
    "relics_mod": "https://github.com/SSKirillSS/relics.git",
    "modern_industrialization": "https://github.com/AztechMC/Modern-Industrialization.git",
    "storage_delight": "https://github.com/axperty/storagedelight.git",
    "iron_furnaces": "https://github.com/Qelifern/IronFurnaces.git",
    "rftools_utility": "https://github.com/McJtyMods/RFToolsUtility.git",
    "integrated_terminals": "https://github.com/CyclopsMC/IntegratedTerminals.git",
    "rftools_base": "https://github.com/McJtyMods/RFToolsBase.git",
    "reliquified_artifacts": "https://github.com/Octo-Studios/rar-compat.git",
    "extrastorage": "https://github.com/Edivad99/ExtraStorage.git",
    # MOD_QUEUE runners-up
    "ars_energistique": "https://github.com/62832/ArsEnergistique.git",
    "rftools_storage": "https://github.com/McJtyMods/RFToolsStorage.git",
    "wireless_chargers": "https://github.com/SuperMartijn642/WirelessChargers.git",
    "functional_storage": "https://github.com/Buuz135/FunctionalStorage.git",
    "creeper_overhaul": "https://github.com/bonsaistudi0s/Creeper-Overhaul.git",
    "modularrouters": "https://github.com/desht/ModularRouters.git",
    # ATM10 runners-up (structure/QoL mods)
    "sereneseasons": "https://github.com/Glitchfiend/SereneSeasons.git",
    "yungs_better_mineshafts": "https://github.com/YUNG-GANG/YUNGs-Better-Mineshafts.git",
    "yungs_better_dungeons": "https://github.com/YUNG-GANG/YUNGs-Better-Dungeons.git",
    "yungs_better_strongholds": "https://github.com/YUNG-GANG/YUNGs-Better-Strongholds.git",
    "simple_magnets": "https://github.com/SuperMartijn642/SimpleMagnets.git",
    # ATM10 top-20 runners-up (structure mods)
    "yungs_better_ocean_monuments": "https://github.com/YUNG-GANG/YUNGs-Better-Ocean-Monuments.git",
    "yungs_better_nether_fortresses": "https://github.com/YUNG-GANG/YUNGs-Better-Fortresses.git",
    "mo_structures": "https://github.com/frqnny/mostructures.git",
    "yungs_extras": "https://github.com/YUNG-GANG/YUNGs-Extras.git",
    "yungs_better_desert_temples": "https://github.com/YUNG-GANG/YUNGs-Better-Desert-Temples.git",
    # ATM10 batch-2 (structure + texture mods)
    "connectedglass": "https://github.com/SuperMartijn642/ConnectedGlass.git",
    "pipez": "https://github.com/henkelmax/pipez.git",
    "blue_skies": "https://gitlab.com/modding-legacy/blue-skies.git",
    "yungs_better_witch_huts": "https://github.com/YUNG-GANG/YUNGs-Better-Witch-Huts.git",
    "yungs_better_jungle_temples": "https://github.com/YUNG-GANG/YUNGs-Better-Jungle-Temples.git",
    "yungs_better_end_island": "https://github.com/yungnickyoung/YUNGs-Better-End-Island.git",
    "structory": "https://github.com/Stardust-Labs-MC/Structory.git",
    "moogs_voyager_structures": "https://github.com/Moog-s-Mods/MoogsVoyagerStructures.git",
    "structory_towers": "https://github.com/Stardust-Labs-MC/Structory-Towers.git",
    "mes_moogs_end_structures": "https://github.com/FinnSetchell/MoogsEndStructures.git",
    "villages_and_pillages": "https://github.com/Faboslav/villages-and-pillages.git",
    "dimstorage": "https://github.com/Edivad99/DimStorage.git",
    "entangled": "https://github.com/SuperMartijn642/Entangled.git",
    "variants_and_ventures": "https://github.com/Faboslav/variants-and-ventures.git",
    # ATM10 batch-3 (AE2/Ars/MI addons + Steves Carts)
    "creeperhost_presents_steves_carts": "https://github.com/CreeperHost/StevesCarts2.git",
    "mega": "https://github.com/62832/MEGACells.git",
    "extended_industrialization": "https://github.com/Swedz/Extended-Industrialization.git",
    "ars_additions": "https://github.com/Jarva/Ars-Additions.git",
    "cable_tiers": "https://github.com/starforcraft/Cable-Tiers.git",
    "extra_disks": "https://github.com/ChaoticTrials/ExtraDisks.git",
    "applied_mekanistics": "https://github.com/AppliedEnergistics/Applied-Mekanistics.git",
    "merequester": "https://github.com/AlmostReliable/merequester.git",
    "ranged_pumps": "https://github.com/refinedmods/rangedpumps.git",
    "ae2_import_export_card": "https://github.com/starforcraft/AE2-Insert-Export-Card.git",
    "item_collectors": "https://github.com/SuperMartijn642/ItemCollectors.git",
    "ars_ocultas": "https://github.com/dphaldes/Ars-Ocultas.git",
    "universal_grid": "https://github.com/starforcraft/Universal-Grid.git",
    "interdimensional_wireless_transmitter": "https://github.com/starforcraft/Interdimensional-Wireless-Transmitter.git",
    # ATM10 batch-4 (magic, AE2, RFTools, structures)
    "malum": "https://github.com/SammySemicolon/Malum-Mod.git",
    "silents_gems": "https://github.com/SilentChaos512/SilentGems.git",
    "theurgy": "https://github.com/klikli-dev/theurgy.git",
    "advancedae": "https://github.com/pedroksl/AdvancedAE.git",
    "rftools_power": "https://github.com/McJtyMods/RFToolsPower.git",
    "rftools_builder": "https://github.com/McJtyMods/RFToolsBuilder.git",
    "living_things": "https://github.com/tristankechlo/LivingThings.git",
    "baubley_heart_canisters": "https://github.com/Traverse-Joe/Baubley-Heart-Canisters.git",
    "cpm_fabric": "https://github.com/AlphaMode/CompactMachines.git",
    "mekanistic_routers": "https://github.com/MatyrobbrtMods/MekanisticRouters.git",
    # ATM10 batch-5 (tech, integrated dynamics, exploration)
    "oritech": "https://github.com/Rearth/Oritech.git",
    "natures_aura": "https://github.com/Ellpeck/NaturesAura.git",
    "integrated_tunnels": "https://github.com/CyclopsMC/IntegratedTunnels.git",
    "more_red": "https://github.com/Commoble/morered.git",
    "buildinggadgets": "https://github.com/Direwolf20-MC/BuildingGadgets.git",
    "not_enough_glyphs": "https://github.com/Alexthw46/NotEnoughGlyphs.git",
    "explorers_compass": "https://github.com/MattCzyr/ExplorersCompass.git",
    "tempad": "https://github.com/terrarium-earth/Tempad.git",
    "integrated_crafting": "https://github.com/CyclopsMC/IntegratedCrafting.git",
    "industrial_foregoing_souls": "https://github.com/InnovativeOnlineIndustries/Industrial-Foregoing-Souls.git",
    "integrated_scripting": "https://github.com/CyclopsMC/IntegratedScripting.git",
    "restrictions": "https://github.com/McJtyMods/Restrictions.git",
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
    "modularrouters": "MC1.20.1-master",
    "rftools_utility": "1.20",
    "rftools_base": "1.20",
    "rftools_storage": "1.20",
    "sereneseasons": "1.20.1",
    "yungs_better_mineshafts": "1.20",
    "yungs_better_dungeons": "1.20",
    "yungs_better_strongholds": "1.20",
    "simple_magnets": "forge-1.20",
    "yungs_better_ocean_monuments": "1.20",
    "yungs_better_nether_fortresses": "1.20",
    "mo_structures": "1.20.x",
    "yungs_extras": "1.20",
    "yungs_better_desert_temples": "1.20",
    "pipez": "outdated/1.20.1",
    "yungs_better_witch_huts": "1.20",
    "yungs_better_jungle_temples": "1.20",
    "yungs_better_end_island": "1.20",
    "creeperhost_presents_steves_carts": "1.20",
    "extended_industrialization": "1.20.4",
    "interdimensional_wireless_transmitter": "1.20.1",
    "malum": "1.20.1",
    "silents_gems": "1.20.x",
    "theurgy": "version/1.20.1",
    "rftools_power": "1.20",
    "rftools_builder": "1.20",
    "living_things": "1.20.1",
    "baubley_heart_canisters": "1.20",
    "cpm_fabric": "1.20",
    "oritech": "1.21",
    "natures_aura": "1.20",
    "integrated_tunnels": "master-1.20-lts",
    "integrated_crafting": "master-1.20-lts",
    "integrated_scripting": "master-1.20-lts",
    "more_red": "1.20.1",
    "buildinggadgets": "master",
    "not_enough_glyphs": "1.20",
    "tempad": "1.20.1",
    "industrial_foregoing_souls": "1.20",
    "restrictions": "1.20",
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
    "blue_skies": (
        "https://cdn.modrinth.com/data/DOSy3C4M/versions/YGq4rvX4/blue_skies-1.20.1-1.3.31.jar",
        "blue_skies-1.20.1-1.3.31.jar",
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
    jar_path = os.path.join(JARS_DIR, jar_name)
    if not os.path.isfile(jar_path):
        jar_path = os.path.join(MODS_DIR, jar_name)
    if not os.path.isfile(jar_path):
        return 0
    namespace = texture_namespace(mod_id)
    prefix = f"assets/{namespace}/textures/"
    with zipfile.ZipFile(jar_path) as archive:
        return sum(
            1
            for name in archive.namelist()
            if name.startswith(prefix) and name.endswith(".png")
        )


def ensure_best_source(mod_id, repo_url=None):
    from pipeline.run_upscale import find_source_textures_dir

    if mod_id in JAR_ONLY_MODS:
        return extract_textures_from_jar(mod_id, JAR_ONLY_MODS[mod_id])

    repo_count = count_pngs(find_source_textures_dir(mod_id)) if os.path.isdir(
        os.path.join(SOURCES_DIR, mod_id)
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
    os.makedirs(JARS_DIR, exist_ok=True)
    jar_path = os.path.join(JARS_DIR, jar_name)
    if not os.path.isfile(jar_path):
        print(f"[*] {mod_id}: downloading jar from modrinth")
        urllib.request.urlretrieve(url, jar_path)
    return jar_name


def extract_textures_from_jar(mod_id, jar_name):
    jar_path = os.path.join(JARS_DIR, jar_name)
    if not os.path.isfile(jar_path):
        jar_path = os.path.join(MODS_DIR, jar_name)
    namespace = texture_namespace(mod_id)
    dest_root = os.path.join(
        SOURCES_DIR,
        mod_id,
        "src",
        "main",
        "resources",
        "assets",
        namespace,
        "textures",
    )
    prefix = f"assets/{namespace}/textures/"

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