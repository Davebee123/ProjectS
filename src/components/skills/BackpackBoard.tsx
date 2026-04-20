import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../../GameContext";
import {
  getItemDefs,
  getBundle,
  type InventoryCategory,
  type ItemDef,
} from "../../data/loader";
import { resolveEquipmentItem } from "../../data/bridge";
import { getBackpackSlotCapacity, type EquipmentSlot } from "../../state";

const CATEGORY_ORDER: InventoryCategory[] = [
  "weapons",
  "armor",
  "consumables",
  "fey_runes",
  "materials",
  "quest_items",
  "misc",
];

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  weapons: "Weapons",
  armor: "Armor",
  consumables: "Consumables",
  fey_runes: "Fey Runes",
  materials: "Materials",
  quest_items: "Quest Items",
  misc: "Misc",
};

type BackpackFilter = "all" | InventoryCategory;

interface SeenBackpackState {
  stackables: Record<string, number>;
  equipment: Record<string, true>;
}

interface ResolvedBackpackItem {
  id: string;
  entryType: "stackable" | "equipment";
  name: string;
  qty: number;
  slot?: ItemDef["slot"];
  description: string;
  image?: string;
  rarity: string;
  category: InventoryCategory;
  equipped: boolean;
  canEquip: boolean;
  runeSlotIndex: number;
  equippedRuneSlotIndex: number;
  rarityClass: "common" | "uncommon" | "rare";
  effectLines: Array<{
    label: string;
    value: string;
  }>;
  additionalEffects: string[];
  isNew: boolean;
}

interface ActiveBackpackTooltip {
  item: ResolvedBackpackItem;
  anchorEl: HTMLElement;
}

const BACKPACK_SEEN_STORAGE_KEY = "ifrpg.backpack.seen.v1";

function deriveCategory(def: ItemDef | undefined): InventoryCategory {
  if (def?.inventoryCategory) {
    return def.inventoryCategory;
  }
  if (def?.slot === "rune") {
    return "fey_runes";
  }
  if (def?.slot === "mainHand") {
    return "weapons";
  }
  if (def?.slot) {
    return "armor";
  }
  if ((def?.folder || "").toLowerCase().includes("resource")) {
    return "materials";
  }
  return "misc";
}

function normalizeRarityClass(rarity: string): "common" | "uncommon" | "rare" {
  if (rarity === "uncommon") return "uncommon";
  if (rarity === "rare" || rarity === "set" || rarity === "unique" || rarity === "epic") return "rare";
  return "common";
}

function humanizeId(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDisplayNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
  return rounded.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function buildModifierLabel(
  statId: string,
  scope: { combatSchool?: string; skillIds?: string[] } | undefined,
  statLabels: Map<string, string>,
  skillNames: Map<string, string>
): string {
  const baseLabel = (() => {
    switch (statId) {
      case "flat_weapon_damage":
        return "Damage";
      case "physical_resist":
        return "Physical Resistance";
      case "string_resist":
        return "String Resistance";
      case "entropy_resist":
        return "Entropy Resistance";
      case "genesis_resist":
        return "Genesis Resistance";
      case "chaos_resist":
        return "Chaos Resistance";
      case "all_damage_multiplier":
        return "Damage";
      case "backpack_slots":
        return "Backpack Slots";
      case "string_damage_multiplier":
        return "String Damage";
      case "entropy_damage_multiplier":
        return "Entropy Damage";
      case "genesis_damage_multiplier":
        return "Genesis Damage";
      case "chaos_damage_multiplier":
        return "Chaos Damage";
      case "cast_time_multiplier":
        return "Cast Time";
      case "recharge_rate_multiplier":
        return "Recharge Rate";
      case "energy_cost_multiplier":
        return "Energy Cost";
      case "mana_cost_multiplier":
        return "Mana Cost";
      default: {
        const registryLabel = statLabels.get(statId);
        if (!registryLabel) return humanizeId(statId);
        return registryLabel.replace(/\bResist\b/g, "Resistance");
      }
    }
  })();

  if (scope?.skillIds?.length === 1) {
    const skillName = skillNames.get(scope.skillIds[0]) ?? humanizeId(scope.skillIds[0]);
    return `${skillName} ${baseLabel}`;
  }

  if (scope?.combatSchool && !baseLabel.toLowerCase().includes(scope.combatSchool.toLowerCase())) {
    return `${humanizeId(scope.combatSchool)} ${baseLabel}`;
  }

  return baseLabel;
}

function getModifierValueMode(statId: string, operation: string): "raw" | "percent_flat" | "percent_delta" {
  if (operation === "multiply") return "percent_delta";
  if (statId.endsWith("_resist")) return "percent_flat";
  return "raw";
}

function buildEffectLines(
  modifiers: Array<{ statId: string; operation: string; value: number; scope?: { combatSchool?: string; skillIds?: string[] } }>,
  statLabels: Map<string, string>,
  skillNames: Map<string, string>
): Array<{ label: string; value: string }> {
  const aggregates = new Map<
    string,
    { label: string; mode: "raw" | "percent_flat" | "percent_delta"; order: number; rawTotal: number; multTotal: number }
  >();

  modifiers.forEach((modifier, index) => {
    const label = buildModifierLabel(modifier.statId, modifier.scope, statLabels, skillNames);
    const mode = getModifierValueMode(modifier.statId, modifier.operation);
    const key = `${label}__${mode}`;
    const existing = aggregates.get(key);
    const aggregate = existing ?? {
      label,
      mode,
      order: index,
      rawTotal: 0,
      multTotal: 1,
    };

    if (mode === "percent_delta" && modifier.operation === "multiply") {
      aggregate.multTotal *= modifier.value;
    } else {
      aggregate.rawTotal += modifier.value;
    }

    aggregates.set(key, aggregate);
  });

  return [...aggregates.values()]
    .sort((a, b) => a.order - b.order)
    .map((aggregate) => {
      if (aggregate.mode === "percent_delta") {
        const deltaPercent = (aggregate.multTotal - 1) * 100;
        return {
          label: aggregate.label,
          value: `${deltaPercent < 0 ? "-" : ""}${formatDisplayNumber(Math.abs(deltaPercent))}%`,
        };
      }
      if (aggregate.mode === "percent_flat") {
        return {
          label: aggregate.label,
          value: `${formatDisplayNumber(aggregate.rawTotal)}%`,
        };
      }
      return {
        label: aggregate.label,
        value: formatDisplayNumber(aggregate.rawTotal),
      };
    });
}

function buildLegacyModifiers(def: ItemDef | undefined): Array<{
  statId: string;
  operation: string;
  value: number;
}> {
  if (!def) return [];
  const modifiers: Array<{ statId: string; operation: string; value: number }> = [];
  if (def.stats.attack !== undefined) modifiers.push({ statId: "flat_weapon_damage", operation: "add", value: def.stats.attack });
  if (def.stats.defense !== undefined) modifiers.push({ statId: "physical_resist", operation: "add", value: def.stats.defense });
  if (def.stats.energyRegen !== undefined) modifiers.push({ statId: "energy_regen", operation: "add", value: def.stats.energyRegen });
  if (def.stats.activityPowerMultiplier !== undefined) {
    modifiers.push({ statId: "all_damage_multiplier", operation: "multiply", value: def.stats.activityPowerMultiplier });
  }
  if (def.stats.backpackSlots !== undefined) {
    modifiers.push({ statId: "backpack_slots", operation: "add", value: def.stats.backpackSlots });
  }
  if (def.stats.speedMultiplier !== undefined) {
    modifiers.push({ statId: "cast_time_multiplier", operation: "multiply", value: def.stats.speedMultiplier });
  }
  if (def.stats.energyCostMultiplier !== undefined) {
    modifiers.push({ statId: "energy_cost_multiplier", operation: "multiply", value: def.stats.energyCostMultiplier });
  }
  return modifiers;
}

function loadSeenBackpackState(initialState: SeenBackpackState): SeenBackpackState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.sessionStorage.getItem(BACKPACK_SEEN_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<SeenBackpackState>;
    return {
      stackables: parsed.stackables && typeof parsed.stackables === "object" ? parsed.stackables : initialState.stackables,
      equipment: parsed.equipment && typeof parsed.equipment === "object" ? parsed.equipment as Record<string, true> : initialState.equipment,
    };
  } catch {
    return initialState;
  }
}

function saveSeenBackpackState(state: SeenBackpackState): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(BACKPACK_SEEN_STORAGE_KEY, JSON.stringify(state));
}

function createInitialSeenState(
  stackables: Array<{ id: string; qty: number }>,
  equipmentItems: Array<{ instanceId: string }>
): SeenBackpackState {
  return {
    stackables: Object.fromEntries(stackables.map((item) => [item.id, item.qty])),
    equipment: Object.fromEntries(equipmentItems.map((item) => [item.instanceId, true])),
  };
}

export function BackpackBoard() {
  const { state, dispatch } = useGame();
  const backpackSlotCapacity = getBackpackSlotCapacity(state);
  const [filterCategory, setFilterCategory] = useState<BackpackFilter>("all");
  const [seenState, setSeenState] = useState<SeenBackpackState>(() =>
    loadSeenBackpackState(createInitialSeenState(state.inventory, state.inventoryEquipment))
  );
  const [activeTooltip, setActiveTooltip] = useState<ActiveBackpackTooltip | null>(null);

  useEffect(() => {
    setSeenState((prev) => {
      const next: SeenBackpackState = {
        stackables: { ...prev.stackables },
        equipment: { ...prev.equipment },
      };
      let changed = false;

      for (const item of state.inventory) {
        const seenQty = next.stackables[item.id] ?? 0;
        if (seenQty > item.qty) {
          next.stackables[item.id] = item.qty;
          changed = true;
        }
      }

      if (changed) {
        saveSeenBackpackState(next);
        return next;
      }
      return prev;
    });
  }, [state.inventory]);

  useEffect(() => {
    if (!activeTooltip) return;

    const clearTooltip = () => setActiveTooltip(null);
    window.addEventListener("resize", clearTooltip);
    window.addEventListener("scroll", clearTooltip, true);
    return () => {
      window.removeEventListener("resize", clearTooltip);
      window.removeEventListener("scroll", clearTooltip, true);
    };
  }, [activeTooltip]);

  const allItems = useMemo(() => {
    const bundle = getBundle();
    const defs = new Map(getItemDefs().map((item) => [item.id, item]));
    const statLabels = new Map((bundle?.modifierStats ?? []).map((stat) => [stat.id, stat.label]));
    const skillNames = new Map((bundle?.skills ?? []).map((skill) => [skill.id, skill.name]));
    const items: ResolvedBackpackItem[] = [];

    for (const item of state.inventory) {
      const def = defs.get(item.id);
      const category = deriveCategory(def);
      items.push({
        id: item.id,
        entryType: "stackable",
        name: def?.name ?? item.name,
        qty: item.qty,
        slot: def?.slot,
        description: def?.description || "",
        image: def?.image,
        rarity: def?.rarity ?? "common",
        category,
        equipped: false,
        canEquip: false,
        runeSlotIndex: -1,
        equippedRuneSlotIndex: -1,
        rarityClass: normalizeRarityClass(def?.rarity ?? "common"),
        effectLines: buildEffectLines(buildLegacyModifiers(def), statLabels, skillNames),
        additionalEffects: def?.additionalEffectsText ? [def.additionalEffectsText] : [],
        isNew: (seenState.stackables[item.id] ?? 0) < item.qty,
      });
    }

    if (bundle) {
      for (const item of state.inventoryEquipment) {
        const resolved = resolveEquipmentItem(item, bundle);
        if (!resolved) continue;

        const category = resolved.slot === "rune"
          ? "fey_runes"
          : resolved.slot === "mainHand"
            ? "weapons"
            : resolved.slot
              ? "armor"
              : "misc";

        const equippedRuneSlotIndex = resolved.slot === "rune"
          ? state.feyRunes.findIndex((slotId) => slotId === item.instanceId)
          : -1;
        const runeSlotIndex = resolved.slot === "rune"
          ? state.feyRunes.findIndex((slotId) => slotId === null)
          : -1;
        const equipped = resolved.slot === "rune"
          ? equippedRuneSlotIndex >= 0
          : Boolean(resolved.slot && state.equipment[resolved.slot as EquipmentSlot] === item.instanceId);

        if (equipped) {
          continue;
        }

        items.push({
          id: item.instanceId,
          entryType: "equipment",
          name: resolved.name,
          qty: 1,
          slot: resolved.slot,
          description: resolved.description,
          image: resolved.image,
          rarity: resolved.quality,
          category,
          equipped: false,
          canEquip: Boolean(resolved.slot),
          runeSlotIndex,
          equippedRuneSlotIndex: -1,
          rarityClass: normalizeRarityClass(resolved.quality),
          effectLines: buildEffectLines(resolved.modifiers, statLabels, skillNames),
          additionalEffects: resolved.additionalEffectsText ? [resolved.additionalEffectsText] : [],
          isNew: !seenState.equipment[item.instanceId],
        });
      }
    }

    items.sort((a, b) => {
      if (a.isNew !== b.isNew) {
        return a.isNew ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [state.inventory, state.inventoryEquipment, state.equipment, state.feyRunes, seenState]);

  const filteredItems = useMemo(() => {
    if (filterCategory === "all") return allItems;
    return allItems.filter((item) => item.category === filterCategory);
  }, [allItems, filterCategory]);

  const displayedItems = filteredItems.slice(0, backpackSlotCapacity);
  const occupiedSlots = allItems.length;

  const markItemSeen = (item: ResolvedBackpackItem) => {
    if (!item.isNew) return;
    setSeenState((prev) => {
      const next: SeenBackpackState = {
        stackables: { ...prev.stackables },
        equipment: { ...prev.equipment },
      };

      if (item.entryType === "stackable") {
        next.stackables[item.id] = item.qty;
      } else {
        next.equipment[item.id] = true;
      }

      saveSeenBackpackState(next);
      return next;
    });
  };

  const activateItem = (item: ResolvedBackpackItem) => {
    if (!item.canEquip || !item.slot) return;

    if (item.slot === "rune") {
      if (item.equipped && item.equippedRuneSlotIndex >= 0) {
        dispatch({ type: "REMOVE_RUNE", slot: item.equippedRuneSlotIndex as 0 | 1 | 2 | 3 | 4 | 5 });
        return;
      }
      if (item.runeSlotIndex >= 0) {
        dispatch({
          type: "SET_RUNE",
          slot: item.runeSlotIndex as 0 | 1 | 2 | 3 | 4 | 5,
          instanceId: item.id,
        });
      }
      return;
    }

    if (item.equipped) {
      dispatch({ type: "UNEQUIP_SLOT", slot: item.slot as EquipmentSlot });
      return;
    }

    if (item.entryType === "equipment") {
      dispatch({ type: "EQUIP_ITEM", instanceId: item.id });
    }
  };

  const gridItems = Array.from({ length: backpackSlotCapacity }, (_, index) => displayedItems[index] ?? null);

  return (
    <div className="backpack-board">
      <div className="backpack-filter-row">
        <select
          className="backpack-filter-control"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as BackpackFilter)}
        >
          <option value="all">All Items</option>
          {CATEGORY_ORDER.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </div>

      <p className="backpack-space-label">
        Backpack Space <span>{occupiedSlots} / {backpackSlotCapacity}</span>
      </p>

      <div className="backpack-slot-grid">
        {gridItems.map((item, index) => {
          return item ? (
            <article
              key={item.id}
              className={`backpack-slot-card backpack-rarity-${item.rarityClass}${item.equipped ? " is-equipped" : ""}${item.isNew ? " is-new" : ""}`}
              role="button"
              tabIndex={0}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={(e) => {
                markItemSeen(item);
                setActiveTooltip({ item, anchorEl: e.currentTarget });
              }}
              onMouseLeave={() => setActiveTooltip((prev) => (prev?.item.id === item.id ? null : prev))}
              onFocus={(e) => {
                markItemSeen(item);
                setActiveTooltip({ item, anchorEl: e.currentTarget });
              }}
              onBlur={() => setActiveTooltip((prev) => (prev?.item.id === item.id ? null : prev))}
              onDoubleClick={() => activateItem(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activateItem(item);
                }
              }}
            >
              <div className="backpack-slot-image">
                {item.image ? <img src={item.image} alt={item.name} /> : null}
              </div>
            </article>
          ) : (
            <div key={`empty_slot_${index}`} className="backpack-slot-card is-empty" aria-hidden="true" />
          );
        })}
      </div>

      {activeTooltip && typeof document !== "undefined"
        ? createPortal(
            (() => {
              const rect = activeTooltip.anchorEl.getBoundingClientRect();
              const tooltipWidth = Math.min(408, window.innerWidth - 48);
              const preferredLeft = rect.left;
              const clampedLeft = Math.max(16, Math.min(preferredLeft, window.innerWidth - tooltipWidth - 16));
              const top = rect.bottom + 8;
              const item = activeTooltip.item;

              return (
                <div
                  className={`backpack-floating-tooltip backpack-rarity-${item.rarityClass}`}
                  role="tooltip"
                  style={{ top, left: clampedLeft, width: tooltipWidth }}
                >
                  <div className="backpack-tooltip-header">
                    <div className="backpack-tooltip-image">
                      {item.image ? <img src={item.image} alt={item.name} /> : <span className="backpack-tooltip-image-placeholder">{item.name[0]?.toUpperCase() ?? "?"}</span>}
                    </div>
                    <div className="backpack-tooltip-heading">
                      <p className="backpack-tooltip-name">{item.name}</p>
                      {item.slot ? <p className="backpack-tooltip-slot">{humanizeId(item.slot)}</p> : null}
                      {item.qty > 1 ? <p className="backpack-tooltip-qty">x{item.qty}</p> : null}
                    </div>
                  </div>

                  {item.description ? (
                    <div className="backpack-tooltip-description">
                      <p className="backpack-item-description">{item.description}</p>
                    </div>
                  ) : null}

                  {item.effectLines.length > 0 ? (
                    <div className="backpack-tooltip-effects">
                      {item.effectLines.map((line) => (
                        <div key={`${item.id}_${line.label}_${line.value}`} className="backpack-tooltip-effect-row">
                          <span className="backpack-tooltip-effect-label">{line.label}</span>
                          <span className="backpack-tooltip-effect-value">{line.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {item.additionalEffects.length > 0 ? (
                    <div className="backpack-tooltip-section">
                      <p className="backpack-tooltip-section-label">Additional Effects</p>
                      {item.additionalEffects.map((text, effectIndex) => (
                        <p key={`${item.id}_additional_${effectIndex}`} className="backpack-item-description">
                          {text}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })(),
            document.body
          )
        : null}
    </div>
  );
}
