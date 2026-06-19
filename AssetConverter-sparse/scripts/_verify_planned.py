from run_upscale import find_source_texture_roots, find_source_textures_dir

mods = [
    "mekanism",
    "mekanismgenerators",
    "mekanismtools",
    "ae2",
    "refinedstorage",
    "thermal",
    "twilightforest",
    "ars_nouveau",
    "botania",
    "sophisticatedbackpacks",
    "storagedrawers",
    "jei",
]

for mod in mods:
    roots = find_source_texture_roots(mod)
    primary = find_source_textures_dir(mod)
    print(f"{mod}:")
    print(f"  primary: {primary}")
    print(f"  roots ({len(roots)}): {roots}")