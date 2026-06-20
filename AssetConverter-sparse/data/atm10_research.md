# ATM10 Mod Research

> **Version note:** Official ATM10 (`AllTheMods/ATM-10`, CurseForge) runs **Minecraft 1.21.x on NeoForge** — there is no ATM10 release for **1.20.1 Forge**. Branches below target **1.20.1 / 1.20.x** where your upscaling pipeline and cloned sources already use those versions.

Mod list source: [modpackindex.com ATM10 API](https://www.modpackindex.com/api/v1/modpack/85233/mods) (477 mods, synced June 2026). GitHub repo `AllTheMods/ATM-10` contains configs/kubejs only — no `manifest.json` or `mods/` folder.

## Summary

| Metric | Count |
|--------|------:|
| **Total ATM10 mods** | **477** |
| Unique normalized mod IDs | 477 |
| **Already covered** (matched to `output/assets`) | **79** |
| Library / utility / perf (excluded) | 136 |
| **NEW texture candidates** (public repo) | **150** |
| No public source URL | 112 |

## Already Covered

**159 namespaces** in `output/assets/`. **79** appear in the ATM10 mod list:

```
actuallyadditions, ae2, aether, apotheosis, aquaculture, ars_additions, ars_nouveau, ars_ocultas, artifacts, bellsandwhistles, buildinggadgets, chipped, comforts, connectedglass, cookingforblockheads, create, create_aquatic_ambitions, create_dragons_plus, create_enchantment_industry, create_hypertube, createaddition, deeperdarker, dimstorage, enderio, entangled, eternal_starlight, evilcraft, extended_industrialization, extrastorage, farmersdelight, fluxnetworks, forbidden_arcanus, handcrafted, iceandfire, immersiveengineering, industrialforegoing, integrateddynamics, ironjetpacks, irons_spellbooks, mcwbridges, mcwdoors, mcwfences, mcwlights, mcwroofs, mcwwindows, mekanism, mekanism_covers, mekanismgenerators, mekanismmoremachine, mekanismtools, merequester, minecolonies, modern_industrialization, modularrouters, mysticalagradditions, mysticalagriculture, not_enough_glyphs, occultism, oritech, pipez, pneumaticcraft, productivebees, productivetrees, rechiseled, refinedstorage, reliquary, restrictions, securitycraft, sophisticatedbackpacks, sophisticatedstorage, supplementaries, tempad, theurgy, trashcans, twilightforest, variants_and_ventures, villages_and_pillages, waystones, xnet
```

**Upscaled mods NOT in ATM10** (79): classic 1.20.1 Forge content dropped or replaced in the 1.21 pack — e.g. Botania, Quark, Tinkers, Biomes O' Plenty, Alex's Caves, many Create addons.

```
advanced_ae, ae2importexportcard, alexscaves, another_furniture, appmek, arseng, betterdeserttemples, betterdungeons, betterendisland, betterfortresses, betterjungletemples, bettermineshafts, betteroceanmonuments, betterstrongholds, betterwitchhuts, bhc, bigreactors, biomesoplenty, biomeswevegone, blue_skies, botania, brewinandchewin, cabletiers, compactmachines, copycats, create_central_kitchen, create_connected, create_jetpack, create_new_age, create_sa, createbigcannons, createdeco, createendertransmission, createoreexcavation, creativewirelesstransmitter, creeperoverhaul, draconicevolution, explorerscompass, extradisks, functionalstorage, industrialforegoingsouls, integratedcrafting, integratedscripting, integratedterminals, integratedtunnels, interiors, ironfurnaces, itemcollectors, livingthings, malum, megacells, mekanisticrouters, morered, mostructures, mowziesmobs, naturesaura, quark, railways, rangedpumps, rftoolsbase, rftoolsbuilder, rftoolspower, rftoolsstorage, rftoolsutility, sereneseasons, silentgems, simplemagnets, sliceanddice, stevescarts, storagedelight, storagedrawers, tconstruct, thermal, trackwork, universalgrid, valkyrienskies, vs_clockwork, wirelesschargers, yungsextras
```

## Top 30 NEW Mods to Add

Prioritized by texture count + content categories. Excludes libraries/QoL/performance mods.

| mod_id | repo_url | branch | ~png_count |
|--------|----------|--------|----------:|
| `oh_the_biomes_weve_gone` | https://github.com/Potion-Studios/Oh-The-Biomes-Weve-Gone.git | `main` | 1114 |
| `railcraft_reborn` | https://github.com/railcraft-reborn/railcraft.git | `main` | 1084 |
| `the_undergarden` | https://github.com/quek04/The-Undergarden.git | `main` | 546 |
| `draconic_evolution` | https://github.com/Draconic-Inc/Draconic-Evolution.git | `1.20.1` | 520 |
| `creeperhost_presents_steves_carts` | https://github.com/CreeperHost/StevesCarts2.git | `1.20` | 420 |
| `storage_delight` | https://github.com/axperty/storagedelight.git | `main` | 436 |
| `relics_mod` | https://github.com/SSKirillSS/relics.git | `main` | 348 |
| `extreme_reactors` | https://github.com/ZeroNoRyouki/ExtremeReactors2.git | `main` | 293 |
| `silents_gems` | https://github.com/SilentChaos512/SilentGems.git | `1.20.x` | 283 |
| `natures_aura` | https://github.com/Ellpeck/NaturesAura.git | `1.20` | 219 |
| `iron_furnaces` | https://github.com/Qelifern/IronFurnaces.git | `main` | 168 |
| `rftools_utility` | https://github.com/McJtyMods/RFToolsUtility.git | `1.20` | 139 |
| `advancedae` | https://github.com/pedroksl/AdvancedAE.git | `main` | 130 |
| `cable_tiers` | https://github.com/starforcraft/Cable-Tiers.git | `main` | 91 |
| `simple_magnets` | https://github.com/SuperMartijn642/SimpleMagnets.git | `forge-1.20` | 16 |
| `mega` | https://github.com/62832/MEGACells.git | `main` | 90 |
| `wireless_chargers` | https://github.com/SuperMartijn642/WirelessChargers.git | `main` | 9 |
| `reliquified_artifacts` | https://github.com/Octo-Studios/rar-compat.git | `main` | ? |
| `extra_disks` | https://github.com/ChaoticTrials/ExtraDisks.git | `main` | 62 |
| `yungs_better_strongholds` | https://github.com/YUNG-GANG/YUNGs-Better-Strongholds.git | `1.20` | 4 |
| `yungs_better_dungeons` | https://github.com/YUNG-GANG/YUNGs-Better-Dungeons.git | `1.20` | 4 |
| `yungs_better_desert_temples` | https://github.com/YUNG-GANG/YUNGs-Better-Desert-Temples.git | `1.20` | 4 |
| `yungs_better_witch_huts` | https://github.com/YUNG-GANG/YUNGs-Better-Witch-Huts.git | `1.20` | 4 |
| `yungs_better_ocean_monuments` | https://github.com/YUNG-GANG/YUNGs-Better-Ocean-Monuments.git | `1.20` | 4 |
| `yungs_better_nether_fortresses` | https://github.com/YUNG-GANG/YUNGs-Better-Fortresses.git | `1.20` | 4 |
| `yungs_better_jungle_temples` | https://github.com/YUNG-GANG/YUNGs-Better-Jungle-Temples.git | `1.20` | 4 |
| `yungs_better_end_island` | https://github.com/yungnickyoung/YUNGs-Better-End-Island.git | `1.20` | 4 |
| `yungs_better_mineshafts` | https://github.com/YUNG-GANG/YUNGs-Better-Mineshafts.git | `1.20` | 4 |
| `yungs_extras` | https://github.com/YUNG-GANG/YUNGs-Extras.git | `1.20` | 3 |
| `integrated_tunnels` | https://github.com/CyclopsMC/IntegratedTunnels.git | `master-1.20-lts` | 97 |

## Notable NEW Candidates (#31–50)

| mod_id | repo_url | branch | ~png_count |
|--------|----------|--------|----------:|
| `mo_structures` | https://github.com/frqnny/mostructures.git | `1.20.x` | 1 |
| `structory` | https://github.com/Stardust-Labs-MC/Structory.git | `main` | ? |
| `moogs_voyager_structures` | https://github.com/Moog-s-Mods/MoogsVoyagerStructures.git | `main` | ? |
| `structory_towers` | https://github.com/Stardust-Labs-MC/Structory-Towers.git | `main` | ? |
| `mes_moogs_end_structures` | https://github.com/FinnSetchell/MoogsEndStructures.git | `main` | ? |
| `ars_energistique` | https://github.com/62832/ArsEnergistique.git | `main` | 12 |
| `integrated_terminals` | https://github.com/CyclopsMC/IntegratedTerminals.git | `main` | 11 |
| `universal_grid` | https://github.com/starforcraft/Universal-Grid.git | `main` | 5 |
| `more_red` | https://github.com/Commoble/morered.git | `1.20.1` | 83 |
| `living_things` | https://github.com/tristankechlo/LivingThings.git | `1.20.1` | 62 |
| `rftools_power` | https://github.com/McJtyMods/RFToolsPower.git | `1.20` | 75 |
| `apothic_spawners` | https://github.com/Shadows-of-Fire/Apothic-Spawners | `main` | ? |
| `rftools_storage` | https://github.com/McJtyMods/RFToolsStorage.git | `1.20` | 30 |
| `rftools_base` | https://github.com/McJtyMods/RFToolsBase.git | `1.20` | 29 |
| `rftools_builder` | https://github.com/McJtyMods/RFToolsBuilder.git | `1.20` | 68 |
| `creeper_overhaul` | https://github.com/bonsaistudi0s/Creeper-Overhaul.git | `main` | 51 |
| `cpm_fabric` | https://github.com/AlphaMode/CompactMachines.git | `1.20` | 25 |
| `interdimensional_wireless_transmitter` | https://github.com/starforcraft/Interdimensional-Wireless-Transmitter.git | `1.20.1` | 18 |
| `applied_mekanistics` | https://github.com/AppliedEnergistics/Applied-Mekanistics.git | `main` | 14 |
| `ae2_import_export_card` | https://github.com/starforcraft/AE2-Insert-Export-Card.git | `main` | 8 |

## No Public GitHub/GitLab Source

- `additional_lights` — Additional Lights
- `ae2_crafting_tree` — AE2: Crafting Tree
- `ae2_jei_integration` — AE2 JEI Integration
- `ae2_network_analyser` — AE2 Network Analyser
- `all_the_arcanist_gear` — All The Arcanist Gear
- `all_the_tweaks` — All The Tweaks
- `all_the_wizard_gear` — All the Wizard Gear
- `allthecompressed` — AllTheCompressed
- `alltheleaks` — AllTheLeaks (Memory Leak Fix)
- `allthemodium` — Allthemodium
- `amendments` — Amendments
- `apothic_enchanting` — Apothic Enchanting
- `applied_flux` — Applied Flux
- `ars_elemancy` — Ars Elemancy
- `ars_elemental` — Ars Elemental
- `ars_technica` — Ars Technica
- `ato` — ATO - All the Ores
- `auroras` — Auroras
- `blockui` — BlockUI
- `byzantine_styles_pack_for_minecolonies` — Byzantine Styles Pack for Minecolonies
- `camol` — Camol
- `cat_jammies` — Cat Jammies
- `cc_tweaked_remastered` — CC: Tweaked (Unofficial)
- `charging_gadgets` — Charging Gadgets
- `chroma_carvings` — Chroma Carvings
- `clean_swing_through_grass` — Clean Swing Through Grass
- `cobblegen_galore` — Cobblegen Galore
- `corail_tombstone` — Corail Tombstone
- `cosmetic_armor_reworked` — Cosmetic Armor Reworked
- `crash_utilities` — Crash Utilities
- `deimos_fabric_forge_neoforge` — Deimos Lib
- `domum_ornamentum` — Domum Ornamentum
- `dyenamics` — Dyenamics
- `dyson_cube_project` — Dyson Cube Project
- `ex_pattern_provider` — ExtendedAE