# Node Core deprecation migration — MC 1.20.1 / Forge 47.3.7

Surfaced by the now-live `forge-mod-v1` LSP gate (JDT.LS) during the post-improvement
re-validation sweep. 14 distinct warnings; the old no-op LSP let them through.
Policy (per owner): **deprecation = broken code → migrate to the modern alternative.**
Research-confirmed exceptions (override-only deprecations with NO replacement) get
`@Deprecated` on the override — NOT `@SuppressWarnings` (CLAUDE002).

## A. Real deprecations — MIGRATE to modern API

### A1. `ExtractorOutputCatalog.java` — BuiltInRegistries → ForgeRegistries
Forge deprecates direct `BuiltInRegistries` access for modded lookups ("Forge: Use ForgeRegistries.ITEMS instead").
- Remove import: `import net.minecraft.core.registries.BuiltInRegistries;`
- Add import:    `import net.minecraftforge.registries.ForgeRegistries;`
- `BuiltInRegistries.ITEM.get(location)`  → `ForgeRegistries.ITEMS.getValue(location)`
- `BuiltInRegistries.BLOCK.get(location)` → `ForgeRegistries.BLOCKS.getValue(location)`
- Keep the existing `== null || == AIR` guards (ForgeRegistries getValue returns the AIR default for unknown keys).

### A2. `LiquidFireBlock.java` — vanilla LiquidBlock ctor → Forge Supplier ctor
The `LiquidBlock(FlowingFluid, Properties)` ctor is deprecated; Forge adds `LiquidBlock(Supplier<? extends FlowingFluid>, Properties)` for registration-order safety.
- Add import: `import java.util.function.Supplier;`
- Change ctor signature + super call:
  ```java
  public LiquidFireBlock(Supplier<? extends FlowingFluid> fluid, Properties properties) {
      super(fluid, properties);
  }
  ```
- RIPPLE — `ModBlocks.java` line ~40 registration:
  `new LiquidFireBlock(ModFluids.LIQUID_FIRE_SOURCE.get(), ...)`
  → `new LiquidFireBlock(ModFluids.LIQUID_FIRE_SOURCE, ...)`   (RegistryObject<FlowingFluid> IS a Supplier; drop `.get()`)

### A3. `ModItems.java` — vanilla BucketItem ctor → Forge Supplier ctor
`BucketItem(Fluid, Properties)` deprecated; use `BucketItem(Supplier<? extends Fluid>, Properties)`.
- `new BucketItem(ModFluids.LIQUID_FIRE_SOURCE.get(), props)`
  → `new BucketItem(ModFluids.LIQUID_FIRE_SOURCE, props)`   (drop `.get()`)

## B. Unused imports — DELETE

- `event/OreNodeHandler.java`              → remove `import com.mrwizard94.nodecore.node.ResourceNode;`
- `blockentity/OreExtractorCoreBlockEntity.java` → remove `import net.minecraftforge.fluids.FluidStack;`
- `block/extractor/OreExtractorCoreBlock.java`   → remove `import net.minecraft.network.chat.Component;`
- `block/extractor/OreExtractorCoreBlock.java`   → remove `import net.minecraft.world.level.block.Block;`

## C. onPlace/onRemove overrides — ANNOTATE @Deprecated (NOT a bug)

Research (Forge maintainer, forums.minecraftforge.net/topic/120309): `BlockBehaviour.onPlace`/`onRemove`
are deprecated to discourage **calling directly** (call via `BlockState`), **not** overriding —
"if you are overriding the method there is no issue." There is NO replacement override hook in 1.20.1.
The warnings fire on the `super.onPlace(...)`/`super.onRemove(...)` chain calls inside the overrides,
which are required to preserve vanilla behavior. Per JLS 9.6.4.6, marking the enclosing override
`@Deprecated` suppresses the in-body deprecation warning without `@SuppressWarnings`.

Add `@Deprecated` (alongside the existing `@Override`) to all six overrides:
- `block/extractor/OreExtractorCoreBlock.java` — onPlace, onRemove
- `block/node/OreNodeBlock.java`               — onPlace, onRemove
- `block/NodeMarkerBlock.java`                 — onPlace, onRemove

## Done criteria
`forge-mod-v1` gate (lsp + ast + rules + build) PASSES with **zero** LSP warnings on these files.

## Sources
- Forge 1.20.1 deprecated list: https://lexxie.dev/forge/1.20.1/deprecated-list.html
- Forge registries doc: https://docs.minecraftforge.net/en/1.20.1/concepts/registries/
- BlockBehaviour override deprecation: https://forums.minecraftforge.net/topic/120309-what-to-use-instead-of-deprecated-use-in-blockbehivour/
