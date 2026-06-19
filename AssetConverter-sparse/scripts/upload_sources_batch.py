"""Create and push an upload/sources-* branch for a mod batch.

Reads batch definitions from references/git-branch-strategy.md tables.
Coordinator merges branches to main separately.
"""
import argparse
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import PROJECT_ROOT

BATCH_PATHS = {
    "01": ["sources/mowziesmobs/"],
    "02": ["sources/minecolonies/", "sources/railways/"],
    "03": [
        "sources/alexscaves/",
        "sources/aether/",
        "sources/mcwdoors/",
        "sources/mcwbridges/",
        "sources/mcwfences/",
        "sources/mcwwindows/",
        "sources/mcwroofs/",
        "sources/mcwlights/",
    ],
    "04": ["sources/eternal_starlight/", "sources/rechiseled/"],
    "05": ["sources/twilightforest/", "sources/botania/"],
    "06": ["sources/create/", "sources/refinedstorage/"],
    "07": ["sources/mekanism/", "sources/biomesoplenty/"],
    "08": [
        "sources/tconstruct/",
        "sources/iceandfire/",
        "sources/oh_the_biomes_weve_gone/",
    ],
    "09": [
        "sources/quark/",
        "sources/pneumaticcraft/",
        "sources/immersiveengineering/",
        "sources/ars_nouveau/",
        "sources/irons_spellbooks/",
        "sources/handcrafted/",
        "sources/deeperdarker/",
    ],
    "10": [
        "sources/chipped/",
        "sources/supplementaries/",
        "sources/createbigcannons/",
        "sources/create_connected/",
        "sources/createaddition/",
        "sources/create_central_kitchen/",
        "sources/create_enchantment_industry/",
        "sources/create_hypertube/",
        "sources/create_new_age/",
        "sources/createoreexcavation/",
        "sources/create_jetpack/",
        "sources/create_sa/",
        "sources/createendertransmission/",
        "sources/copycats/",
        "sources/sliceanddice/",
        "sources/trackwork/",
        "sources/bellsandwhistles/",
        "sources/interiors/",
        "sources/createdeco/",
    ],
    "11": [
        "sources/ae2/",
        "sources/actuallyadditions/",
        "sources/another_furniture/",
        "sources/apotheosis/",
        "sources/aquaculture/",
        "sources/artifacts/",
        "sources/brewinandchewin/",
        "sources/comforts/",
        "sources/cookingforblockheads/",
        "sources/draconicevolution/",
        "sources/enderio/",
        "sources/evilcraft/",
        "sources/farmersdelight/",
        "sources/fluxnetworks/",
        "sources/forbidden_arcanus/",
        "sources/industrialforegoing/",
        "sources/integrateddynamics/",
        "sources/jei/",
        "sources/mysticalagriculture/",
        "sources/mysticalagradditions/",
        "sources/occultism/",
        "sources/powah/",
        "sources/productivebees/",
        "sources/railcraft_reborn/",
        "sources/reliquary/",
        "sources/securitycraft/",
        "sources/sophisticatedbackpacks/",
        "sources/sophisticatedstorage/",
        "sources/storagedrawers/",
        "sources/thermal_core/",
        "sources/thermal_expansion/",
        "sources/thermal_foundation/",
        "sources/thermal_innovation/",
        "sources/trashcans/",
        "sources/valkyrienskies/",
        "sources/vs_clockwork/",
        "sources/waystones/",
        "sources/xnet/",
        "sources/ironjetpacks/",
        "sources/the_undergarden/",
    ],
}

BATCH_BRANCH = {
    "01": "upload/sources-01-mowziesmobs",
    "02": "upload/sources-02-minecolonies-railways",
    "03": "upload/sources-03-alexscaves-aether-mcw",
    "04": "upload/sources-04-eternal-rechiseled",
    "05": "upload/sources-05-twilight-botania",
    "06": "upload/sources-06-create-refined",
    "07": "upload/sources-07-mekanism-biomes",
    "08": "upload/sources-08-tconstruct-iceandfire-otbwg",
    "09": "upload/sources-09-tech-magic-mid",
    "10": "upload/sources-10-create-ecosystem",
    "11": "upload/sources-11-remaining-mods",
}

BATCH_MSG = {
    "01": "data(sources): add mowziesmobs (~142 MB)",
    "02": "data(sources): add minecolonies, railways",
    "03": "data(sources): add alexscaves, aether, mcw* set",
    "04": "data(sources): add eternal_starlight, rechiseled",
    "05": "data(sources): add twilightforest, botania",
    "06": "data(sources): add create, refinedstorage",
    "07": "data(sources): add mekanism, biomesoplenty",
    "08": "data(sources): add tconstruct, iceandfire, oh_the_biomes_weve_gone",
    "09": "data(sources): add quark, pneumaticcraft, IE, ars, irons, handcrafted, deeperdarker",
    "10": "data(sources): add create ecosystem + chipped + supplementaries",
    "11": "data(sources): add remaining mod trees",
}


def run(cmd, check=True):
    print(f"[*] {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=PROJECT_ROOT, check=check)


def branch_exists(name):
    r = subprocess.run(
        ["git", "rev-parse", "--verify", name],
        cwd=PROJECT_ROOT,
        capture_output=True,
    )
    return r.returncode == 0


def remote_branch_exists(name):
    r = subprocess.run(
        ["git", "ls-remote", "--heads", "origin", name],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    return bool(r.stdout.strip())


def missing_paths(paths):
    missing = []
    for path in paths:
        full = os.path.join(PROJECT_ROOT, path.rstrip("/"))
        if not os.path.isdir(full):
            missing.append(path)
    return missing


def main():
    parser = argparse.ArgumentParser(description="Push a sources upload batch branch")
    parser.add_argument("batch", choices=sorted(BATCH_PATHS), help="Batch number 01-11")
    parser.add_argument("--push", action="store_true", help="Push branch to origin")
    parser.add_argument("--force-recreate", action="store_true", help="Delete local branch and recreate")
    args = parser.parse_args()

    paths = BATCH_PATHS[args.batch]
    branch = BATCH_BRANCH[args.batch]
    msg = BATCH_MSG[args.batch]

    absent = missing_paths(paths)
    if absent:
        print(f"[-] Missing paths on disk: {', '.join(absent)}")
        sys.exit(1)

    run(["git", "fetch", "origin"], check=False)
    run(["git", "switch", "main"])
    run(["git", "pull", "origin", "main"], check=False)

    if branch_exists(branch):
        if remote_branch_exists(branch) and not args.force_recreate:
            print(f"[=] Branch {branch} already exists locally and on origin — skipping")
            if args.push:
                run(["git", "switch", branch])
                run(["git", "push", "-u", "origin", branch], check=False)
            return
        if args.force_recreate:
            run(["git", "branch", "-D", branch], check=False)
        else:
            run(["git", "switch", branch])
            run(["git", "add", "--", *paths])
            run(["git", "commit", "-m", msg], check=False)
            if args.push:
                run(["git", "push", "-u", "origin", branch])
            return

    run(["git", "switch", "-c", branch])
    run(["git", "add", "--", *paths])
    result = run(["git", "commit", "-m", msg], check=False)
    if result.returncode != 0:
        print("[-] Commit failed (maybe empty?)")
        sys.exit(1)
    if args.push:
        run(["git", "push", "-u", "origin", branch])
    print(f"[+] Batch {args.batch} ready on {branch}")


if __name__ == "__main__":
    main()