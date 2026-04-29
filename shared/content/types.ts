export interface GameContentBundle {
  version: string;
  exportedAt: string;
  tags: TagDefinitions;
  storageKeys: StorageKeyDef[];
  statusEffects: StatusEffectTemplate[];
  items: ItemTemplate[];
  itemClasses: ItemClassDef[];
  affixTables: AffixTableDef[];
  modifierStats: ModifierStatDef[];
  itemBases: ItemBase[];
  affixes: AffixDefinition[];
  itemQualityRules: ItemQualityRuleSet[];
  uniqueItems: UniqueItem[];
  itemSets: ItemSetDefinition[];
  skills: SkillTemplate[];
  combos: ComboRuleTemplate[];
  interactables: InteractableTemplate[];
  dialogues: DialogueTemplate[];
  cutscenes: CutsceneTemplate[];
  quests: QuestTemplate[];
  world: WorldTemplate;
  recipes: RecipeTemplate[];
  weathers: WeatherTemplate[];
}

export interface TagDefinitions {
  activityTags: ActivityTagDef[];
  abilityTags: AbilityTagDef[];
}

export interface ActivityTagDef {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface AbilityTagDef {
  id: string;
  label: string;
  description: string;
}

export interface StorageKeyDef {
  id: string;
  label: string;
  type: "flag" | "counter" | "value";
  defaultValue: boolean | number | string;
  description: string;
}

export type EquipmentSlot =
  | "head"
  | "shoulders"
  | "chest"
  | "hands"
  | "legs"
  | "feet"
  | "back"
  | "mainHand"
  | "offHand"
  | "rune";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic";

export type InventoryCategory =
  | "weapons"
  | "armor"
  | "consumables"
  | "fey_runes"
  | "materials"
  | "quest_items"
  | "misc";

export type ItemQuality = "common" | "uncommon" | "rare" | "set" | "unique";

export type ItemClassId = string;

export type ModifierOperation = "add" | "multiply";

export type ModifierStatCategory =
  | "resource"
  | "regen"
  | "resistance"
  | "damage"
  | "timing"
  | "cost"
  | "utility";

export type ModifierStatId = string;

export interface ModifierScope {
  system?: "gathering" | "combat";
  combatSchool?: CombatSchool;
  abilityTagIds?: string[];
  skillIds?: string[];
  targetTag?: string;
}

export interface ModifierPayload {
  statId: ModifierStatId;
  operation: ModifierOperation;
  value: number;
  scope?: ModifierScope;
}

export interface ModifierStatDef {
  id: ModifierStatId;
  label: string;
  category: ModifierStatCategory;
  supportsScope: boolean;
  supportedOperations: ModifierOperation[];
}

export interface ItemClassDef {
  id: ItemClassId;
  label: string;
  slot: EquipmentSlot;
  handedness?: "one_hand" | "two_hand";
  tags?: string[];
}

export interface AffixTableDef {
  id: string;
  label: string;
  description?: string;
}

export interface ItemRequirements {
  playerLevel?: number;
  skills?: Array<{
    skillId: string;
    level: number;
  }>;
}

export interface ItemImplicit {
  id: string;
  name: string;
  unlockItemLevel: number;
  modifiers: ModifierPayload[];
}

export interface ItemBase {
  id: string;
  name: string;
  description: string;
  additionalEffectsText?: string;
  folder?: string;
  slot: EquipmentSlot;
  inventoryCategory: InventoryCategory;
  itemClassId: ItemClassId;
  image?: string;
  requirements?: ItemRequirements;
  baseModifiers: ModifierPayload[];
  implicit?: ItemImplicit;
  affixTableIds: string[];
  tags?: string[];
}

export interface AffixTier {
  tier: number;
  itemLevelMin: number;
  itemLevelMax: number;
  rollMin: number;
  rollMax: number;
  weight?: number;
}

export interface AffixModifierTemplate {
  statId: ModifierStatId;
  operation: ModifierOperation;
  valueSource: "rolled_value";
  scope?: ModifierScope;
}

export interface AffixDefinition {
  id: string;
  kind: "prefix" | "suffix";
  nameTemplate: string;
  description?: string;
  folder?: string;
  tableId: string;
  weight: number;
  allowedSlots?: EquipmentSlot[];
  allowedItemClasses?: ItemClassId[];
  requiredTags?: string[];
  exclusiveGroup?: string;
  tiers: AffixTier[];
  modifiers: AffixModifierTemplate[];
}

export interface ItemQualityRuleBand {
  itemLevelMin: number;
  itemLevelMax: number;
  qualityWeights: {
    common: number;
    uncommon: number;
    rare: number;
  };
  rareAffixCountWeights?: Partial<Record<2 | 3 | 4 | 5, number>>;
}

export interface ItemQualityRuleSet {
  id: string;
  label: string;
  bands: ItemQualityRuleBand[];
}

export interface UniqueItem {
  id: string;
  name: string;
  description: string;
  additionalEffectsText?: string;
  folder?: string;
  baseId: string;
  image?: string;
  requirementsOverride?: ItemRequirements;
  modifiers: ModifierPayload[];
  tags?: string[];
}

export interface ItemSetBonus {
  piecesRequired: number;
  modifiers: ModifierPayload[];
}

export interface ItemSetDefinition {
  id: string;
  name: string;
  description?: string;
  itemIds: string[];
  bonuses: ItemSetBonus[];
}

export interface ItemStats {
  attack?: number;
  attackTags?: string[];
  activityPowerMultiplier?: number;
  backpackSlots?: number;
  defense?: number;
  energyRegen?: number;
  speedMultiplier?: number;
  energyCostMultiplier?: number;
}

export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  additionalEffectsText?: string;
  folder?: string;
  image?: string;
  rarity?: ItemRarity;
  inventoryCategory?: InventoryCategory;
  slot?: EquipmentSlot;
  stackable: boolean;
  stats: ItemStats;
  eventHooks: ItemEventHook[];
  placeable?: boolean;
  placementEffects?: PlacementEffect[];
  /** Cooldown in milliseconds for Quick Slot use. Applies after a successful
   *  USE_QUICK_SLOT (triggering on_use event hooks). Default 0 = no cooldown. */
  quickSlotCooldownMs?: number;
  /** One-shot sound played after a successful Quick Slot consume. */
  consumeSound?: string;
  /** Volume for consumeSound (0-1, default 1). */
  consumeSoundVolume?: number;
}

export type ItemEventType =
  | "on_equip"
  | "on_unequip"
  | "on_hit"
  | "on_kill"
  | "on_interact"
  | "on_explore"
  | "on_damage_taken"
  | "on_tick"
  | "on_use";

export interface ItemEventHook {
  id: string;
  event: ItemEventType;
  condition?: string;
  actions: EventAction[];
}

export type EventActionType =
  | "apply_status"
  | "remove_status"
  | "transform_interactable"
  | "spawn_interactable"
  | "show_emote"
  | "complete_quest"
  | "damage"
  | "deal_bonus_damage"
  | "heal"
  | "restore_mana"
  | "restore_energy"
  | "damage_mana"
  | "damage_energy"
  | "grant_xp"
  | "grant_item"
  | "grant_quest"
  | "travel_to_room"
  | "start_cutscene"
  | "set_storage"
  | "custom";

export type EventActionTarget = "player" | "bearer" | "target";

export interface EventAction {
  type: EventActionType;
  target?: EventActionTarget;
  condition?: string;
  statusEffectId?: string;
  targetSkillId?: string;
  storageKeyId?: string;
  storageOperation?: "set" | "increment" | "decrement" | "toggle";
  itemId?: string;
  interactableId?: string;
  questId?: string;
  roomId?: string;
  cutsceneId?: string;
  quantity?: number;
  value?: number | string | boolean;
  durationMs?: number;
  emoteText?: string;
  emoteChance?: number;
  customScript?: string;
}

export type StatusRemovalType = "timed" | "conditional" | "both";

export type StatusEffectEventType =
  | "on_hit"
  | "on_damage_taken"
  | "on_kill"
  | "on_interval";

export interface StatusEffectEventHook {
  id: string;
  event: StatusEffectEventType;
  intervalMs?: number;
  condition?: string;
  actions: EventAction[];
}

export interface StatusEffectTemplate {
  id: string;
  name: string;
  description: string;
  folder?: string;
  iconImage?: string;
  removalType: StatusRemovalType;
  durationMs?: number;
  removeCondition?: string;
  statModifiers: StatModifier[];
  preventsSpellCasting?: boolean;
  preventsWeaponAbilities?: boolean;
  stackable: boolean;
  maxStacks: number;
  color: string;
  eventHooks?: StatusEffectEventHook[];
}

export interface StatModifier {
  stat: string;
  operation: "add" | "multiply";
  value: number;
}

export type CombatSchool = "string" | "entropy" | "genesis" | "chaos";
export type AbilityCastMode = "instant" | "cast" | "channel" | "passive";
export type AbilityTargetPattern =
  | "single"
  | "self"
  | "ground"
  | "cone"
  | "line"
  | "aoe"
  | "cleave"
  | "chain"
  | "random_secondary"
  | "zone";
export type AbilityUsageContext = "combat" | "non_combat" | "both";

export type StatusInteractionTarget = "self" | "target";

export interface SkillUsageProfile {
  castMode?: AbilityCastMode;
  interruptible?: boolean;
  hitCount?: number;
  castTickIntervalMs?: number;
  maxTargets?: number;
  targetPattern?: AbilityTargetPattern;
  usageContext?: AbilityUsageContext;
  weaponRequirement?: string;
  summonSlotCost?: number;
  rangeNotes?: string;
}

export type SkillEffectTrigger =
  | "on_cast_start"
  | "on_cast_complete"
  | "on_hit"
  | "on_tick"
  | "on_expire"
  | "on_receive_hit"
  | "on_recast"
  | "passive";

export type SkillEffectTarget =
  | "self"
  | "target"
  | "secondary_targets"
  | "random_enemy"
  | "all_enemies"
  | "zone"
  | "summon";

export type SkillEffectType =
  | "damage"
  | "heal"
  | "apply_status"
  | "remove_status"
  | "modify_stat"
  | "interrupt"
  | "change_weather"
  | "spawn_summon"
  | "show_emote"
  | "consume_resource"
  | "grant_resource"
  | "teleport"
  | "reveal_info"
  | "custom";

export interface SkillEffectTemplate {
  id: string;
  trigger: SkillEffectTrigger;
  target: SkillEffectTarget;
  type: SkillEffectType;
  condition?: string;
  value?: number;
  durationMs?: number;
  hitCount?: number;
  maxTargets?: number;
  statusEffectId?: string;
  weatherId?: string;
  resourceLabel?: string;
  resourceAmount?: number;
  statName?: string;
  emoteChance?: number;
  customText?: string;
}

export interface SkillStatusInteraction {
  id: string;
  condition?: string;
  consumeStatusEffectId?: string;
  consumeStatusTarget?: StatusInteractionTarget;
  applyStatusEffectId?: string;
  applyStatusTarget?: StatusInteractionTarget;
  powerMultiplier?: number;
  powerBonus?: number;
  durationMultiplier?: number;
  durationBonusMs?: number;
  energyMultiplier?: number;
  energyBonus?: number;
  note?: string;
}

export type PerkMilestoneEffect =
  | { type: "apply_status"; statusEffectId: string; chance?: number }
  | { type: "power_bonus"; value: number }
  | { type: "power_multiplier"; value: number }
  | { type: "duration_multiplier"; value: number }
  | { type: "energy_cost_modifier"; value: number };

export interface SkillPerkMilestone {
  level: number;
  description: string;
  effects?: PerkMilestoneEffect[];
}

export interface SkillTemplate {
  id: string;
  name: string;
  folder?: string;
  kind: "passive" | "active";
  system?: "gathering" | "combat";
  usableByInteractables?: boolean;
  combatSchool?: CombatSchool;
  image?: string;
  baseManaCost?: number;
  bioboardSubcategory?: string;
  bioboardPrimaryText?: string;
  bioboardSecondaryText?: string;
  activityTags: string[];
  abilityTags: string[];
  linkedPassiveId?: string;
  baseDurationMs: number;
  baseEnergyCost: number;
  basePower: number;
  basePowerMax?: number;
  powerPerLevel: number;
  powerPerLevelMax?: number;
  baseXpToNext: number;
  xpScaling: number;
  barColor: string;
  accentColor: string;
  description: string;
  perkMilestones?: SkillPerkMilestone[];
  unlockCondition?: string;
  castSound?: string;
  castSoundVolume?: number;
  /** If true, castSound plays on cast completion instead of cast start. */
  castSoundOnComplete?: boolean;
  hitSound?: string;
  hitSoundVolume?: number;
  /** If true, this skill cannot be toggled into auto-cast; it only fires single casts. */
  disableAutoCast?: boolean;
  usageProfile?: SkillUsageProfile;
  effects?: SkillEffectTemplate[];
  statusInteractions?: SkillStatusInteraction[];
}

export interface ComboRuleTemplate {
  id: string;
  folder?: string;
  fromSkillId: string;
  toSkillId: string;
  activityTag: string;
  windowMs: number;
  timeMultiplier: number;
  energyMultiplier: number;
  label: string;
}

export interface InteractableTemplate {
  id: string;
  name: string;
  description: string;
  folder?: string;
  activityTag: string;
  abilityBehaviorMode?: "priority" | "sequence";
  allowedAbilityTags: string[];
  requiredLevel: number;
  effectiveHealth: { min: number; max: number };
  barColor: string;
  accentColor: string;
  meterLabel: string;
  lootTable: LootTableEntry[];
  xpRewards: XpReward[];
  spawnCondition?: string;
  formRules?: InteractableFormRule[];
  initialAbilityDelayMs?: number;
  abilities: InteractableAbility[];
  onInteractEffects: EventAction[];
  onDestroyEffects: EventAction[];
  /**
   * Quest IDs this interactable can offer (grant) to the player. If any listed
   * quest is not currently granted and not completed, the UI shows a "!" badge
   * on this interactable as a hint it has something new for the player.
   */
  offersQuestIds?: string[];
  image?: string;
  imagePositionX?: number;
  imagePositionY?: number;
  npc?: NpcTemplate;
  sounds?: {
    onHit?: string;
    onHitVolume?: number;
    onDestroy?: string;
    onDestroyVolume?: number;
    onAbilityCast?: string;
    onAbilityCastVolume?: number;
  };
}

export interface InteractableFormRule {
  id: string;
  condition: string;
  interactableId: string;
}

export interface NpcDialogueRoute {
  dialogueId: string;
  condition?: string;
}

export interface NpcTemplate {
  dialogueId?: string;
  dialogues?: NpcDialogueRoute[];
  portraitImage?: string;
}

export type InteractableAbilityTargetMode =
  | "player"
  | "friendly_or_player"
  | "selected_enemy"
  | "random_enemy"
  | "lowest_hp_enemy"
  | "highest_hp_enemy"
  | "random_friendly"
  | "lowest_hp_friendly"
  | "highest_hp_friendly"
  | "specific_interactable";

export interface InteractableAbility {
  skillId?: string;
  name?: string;
  castTimeMs?: number;
  cooldownMs: number;
  targetMode?: InteractableAbilityTargetMode;
  targetInteractableId?: string;
  damage?: number;
  effect?: string;
  resistedByPassiveId?: string;
  resistChancePerLevel: number;
}

export interface LootTableEntry {
  id: string;
  dropType?: "item" | "item_base";
  itemId?: string;
  itemBaseId?: string;
  itemLevelMin?: number;
  itemLevelMax?: number;
  qualityRuleSetId?: string;
  quantityMin: number;
  quantityMax: number;
  dropChance: number;
  weight: number;
  condition?: string;
}

export interface XpReward {
  skillId: string;
  amount: number;
}

export interface StorageEffect {
  storageKeyId: string;
  operation: "set" | "increment" | "decrement" | "toggle";
  value?: boolean | number | string;
  condition?: string;
}

export interface WorldTemplate {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  rooms: RoomTemplate[];
  startingRoomId: string;
  startingCutsceneId?: string;
  defaultSlotCount: number;
  startingItemIds: string[];
  startingEquipmentBaseIds?: string[];
}

export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
  level?: number;
  gridX: number;
  gridY: number;
  slotCount: number;
  entryCondition?: string;
  backgroundMusic?: string;
  ambientSound?: string;
  backgroundImage?: string;
  spawnTable: SpawnTableEntry[];
  fixedInteractables: FixedInteractable[];
  specialConnections: RoomConnection[];
  seedOverrides: SeedOverride[];
}

export interface SpawnTableEntry {
  id: string;
  interactableId: string;
  spawnChance: number;
  minCount: number;
  maxCount: number;
  neverRespawnAfterDefeat?: boolean;
  condition?: string;
}

export interface FixedInteractable {
  interactableId: string;
  condition?: string;
}

export interface RoomConnection {
  targetRoomId: string;
  label: string;
  condition?: string;
}

export interface SeedOverride {
  condition: string;
  seed: number | string;
  priority: number;
}

export type PlacementEffectType = "stat_aura" | "spawn_modifier";

export interface PlacementEffect {
  id: string;
  type: PlacementEffectType;
  stat?: keyof ItemStats;
  value?: number;
  targetTag?: string;
  spawnChanceMultiplier?: number;
}

export interface RecipeIngredient {
  itemId: string;
  qty: number;
}

export interface RecipeTemplate {
  id: string;
  name: string;
  description?: string;
  folder?: string;
  stationTag?: string;
  unlockCondition?: string;
  craftTimeMs?: number;
  ingredients: RecipeIngredient[];
  outputItemId: string;
  outputQty: number;
}

export interface DialogueTemplate {
  id: string;
  name: string;
  description?: string;
  folder?: string;
  startNodeId: string;
  nodes: DialogueNode[];
}

export interface DialogueNode {
  id: string;
  text: string;
  continueLabel?: string;
  nextNodeId?: string;
  onEnterEffects?: EventAction[];
  options: DialogueOption[];
}

export type DialogueResponseTag = "quest" | "trade" | "hostile" | "exit";

export interface DialogueOption {
  id: string;
  text: string;
  tags?: DialogueResponseTag[];
  condition?: string;
  nextNodeId?: string;
  closeDialogue?: boolean;
  effects?: EventAction[];
}

export type CutsceneStepKind = "text" | "dialogue";

export interface CutsceneTemplate {
  id: string;
  name: string;
  description?: string;
  folder?: string;
  startStepId: string;
  onStartEffects?: EventAction[];
  onCompleteEffects?: EventAction[];
  steps: CutsceneStep[];
}

export interface CutsceneStep {
  id: string;
  kind: CutsceneStepKind;
  text?: string;
  dialogueId?: string;
  speakerName?: string;
  portraitImage?: string;
  backgroundImage?: string;
  ambientSound?: string;
  soundEffect?: string;
  continueLabel?: string;
  nextStepId?: string;
  onEnterEffects?: EventAction[];
  onContinueEffects?: EventAction[];
}

export type QuestCategory = "main_story" | "side_quest" | "task";

export interface QuestTemplate {
  id: string;
  name: string;
  description: string;
  completedDescription?: string;
  folder?: string;
  category: QuestCategory;
  level: number;
  unlockCondition?: string;
  completeCondition?: string;
  objectives: QuestObjective[];
}

export interface QuestObjective {
  id: string;
  title: string;
  description: string;
  unlockCondition?: string;
  completeCondition?: string;
  progress: QuestProgress;
  /**
   * UI highlight targets: when this objective is the active step of a visible
   * quest, elements matching these IDs receive a "!" indicator in-game.
   */
  highlightTargets?: QuestHighlightTargets;
}

export interface QuestHighlightTargets {
  interactableIds?: string[];
  roomIds?: string[];
}

export type QuestProgress =
  | StructuredQuestProgress
  | FreeformQuestProgress;

export interface StructuredQuestProgress {
  kind: "structured";
  label: string;
  source: QuestProgressSource;
  requiredValue: number;
}

export interface FreeformQuestProgress {
  kind: "freeform";
  text: string;
}

export type QuestProgressSource =
  | StorageCounterQuestProgressSource
  | ItemCountQuestProgressSource
  | InteractableDefeatQuestProgressSource;

export interface StorageCounterQuestProgressSource {
  type: "storage_counter";
  storageKeyId: string;
}

export interface ItemCountQuestProgressSource {
  type: "item_count";
  itemId: string;
}

export interface InteractableDefeatQuestProgressSource {
  type: "interactable_defeat_count";
  interactableId: string;
}

// ── Weather ──

export interface WeatherTemplate {
  id: string;
  name: string;
  description: string;
  folder?: string;
  icon: string;
  /** Probability weight (relative to other weathers) */
  weight: number;
  /** Multiplier for energy regen rate (1.0 = normal) */
  energyRegenMult: number;
  /** Multiplier for mana regen rate (1.0 = normal) */
  manaRegenMult: number;
  /** Additive modifier to success chance (e.g. -5 means 5% less likely) */
  successChanceMod: number;
  /** Ambient sound file path */
  ambientSound?: string;
  /** Volume for ambient sound (0–1, default 1) */
  ambientSoundVolume?: number;
  /** Whether ambient sound should loop (default true) */
  ambientSoundLoop?: boolean;
}
