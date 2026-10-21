import { bigint, boolean, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * 與 supabase/migrations/ 對應的 Drizzle schema。
 * 約束、RLS 與權限以 SQL migration 為準；這裡只描述欄位，讓查詢有型別。
 * 積木幣是 bigint，金額都在安全整數範圍內，所以用 number 讀寫。
 */
export const wealth = pgSchema("wealth");

const coins = (name: string) => bigint(name, { mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();

export const profiles = wealth.table("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  avatarKey: text("avatar_key"),
  preferredMode: text("preferred_mode", { enum: ["kids", "adult"] }).notNull().default("kids"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const families = wealth.table("families", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: uuid("created_by").notNull(),
  parentPinHash: text("parent_pin_hash"),
  pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true, mode: "string" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const familyMembers = wealth.table(
  "family_members",
  {
    familyId: uuid("family_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role", { enum: ["parent", "child"] }).notNull(),
    permissions: jsonb("permissions").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.userId] })],
);

export const children = wealth.table("children", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  displayName: text("display_name").notNull(),
  avatarKey: text("avatar_key").notNull().default("sun"),
  ageBand: text("age_band", { enum: ["6-8", "9-10", "11-12"] }).notNull(),
  authUserId: uuid("auth_user_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  archivedAt: timestamp("archived_at", { withTimezone: true, mode: "string" }),
});

export const gameProfiles = wealth.table("game_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  childId: uuid("child_id").notNull(),
  gameMode: text("game_mode", { enum: ["kids"] }).notNull().default("kids"),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const virtualWallets = wealth.table("virtual_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  gameProfileId: uuid("game_profile_id").notNull(),
  currencyCode: text("currency_code").notNull().default("BLOCK_COIN"),
  balance: coins("balance").notNull().default(0),
  updatedAt: updatedAt(),
});

export const TX_TYPES = [
  "initial_grant",
  "allowance",
  "quest_reward",
  "purchase",
  "goal_contribution",
  "goal_withdrawal",
  "admin_adjustment",
] as const;
export type TxType = (typeof TX_TYPES)[number];

export const REFERENCE_TYPES = ["quest", "shop_item", "savings_goal", "allowance_rule", "virtual_transaction"] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export const virtualTransactions = wealth.table("virtual_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
  familyId: uuid("family_id").notNull(),
  walletId: uuid("wallet_id").notNull(),
  type: text("type", { enum: TX_TYPES }).notNull(),
  amount: coins("amount").notNull(),
  balanceAfter: coins("balance_after").notNull(),
  referenceType: text("reference_type", { enum: REFERENCE_TYPES }),
  referenceId: uuid("reference_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  description: text("description").notNull(),
  createdAt: createdAt(),
});

export const buildingDefinitions = wealth.table("building_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  category: text("category", { enum: ["building", "deco", "terrain", "nature"] }).notNull(),
  assetKey: text("asset_key").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  unlockRule: jsonb("unlock_rule").notNull().default({}),
  cost: coins("cost").notNull().default(0),
  isMovable: boolean("is_movable").notNull().default(true),
  isFlat: boolean("is_flat").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description").notNull().default(""),
});

export const shopItems = wealth.table("shop_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category", { enum: ["deco", "building", "terrain", "wear"] }).notNull(),
  price: coins("price").notNull(),
  assetKey: text("asset_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isUnique: boolean("is_unique").notNull().default(false),
  minLevel: integer("min_level").notNull().default(1),
  buildingDefinitionId: uuid("building_definition_id"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const quests = wealth.table("quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  category: text("category", { enum: ["earn", "spend", "save", "plan", "share", "risk"] }).notNull(),
  description: text("description").notNull().default(""),
  ageMin: integer("age_min").notNull().default(6),
  ageMax: integer("age_max").notNull().default(12),
  minLevel: integer("min_level").notNull().default(1),
  rewardCoins: coins("reward_coins").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0),
  contentJson: jsonb("content_json").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const questCompletions = wealth.table("quest_completions", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  gameProfileId: uuid("game_profile_id").notNull(),
  questId: uuid("quest_id").notNull(),
  selectedOption: text("selected_option").notNull(),
  resultJson: jsonb("result_json").notNull().default({}),
  rewardTransactionId: uuid("reward_transaction_id"),
  rewarded: boolean("rewarded").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const savingsGoals = wealth.table("savings_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  gameProfileId: uuid("game_profile_id").notNull(),
  title: text("title").notNull(),
  targetAmount: coins("target_amount").notNull(),
  savedAmount: coins("saved_amount").notNull().default(0),
  rewardBuildingId: uuid("reward_building_id"),
  status: text("status", { enum: ["active", "completed", "archived"] }).notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
});

export const userInventory = wealth.table("user_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  gameProfileId: uuid("game_profile_id").notNull(),
  buildingDefinitionId: uuid("building_definition_id"),
  shopItemId: uuid("shop_item_id"),
  quantity: integer("quantity").notNull().default(0),
  acquiredAt: timestamp("acquired_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: updatedAt(),
});

export const purchases = wealth.table("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  gameProfileId: uuid("game_profile_id").notNull(),
  shopItemId: uuid("shop_item_id").notNull(),
  transactionId: uuid("transaction_id").notNull(),
  price: coins("price").notNull(),
  isUnique: boolean("is_unique").notNull(),
  createdAt: createdAt(),
});

export const islandObjects = wealth.table("island_objects", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  gameProfileId: uuid("game_profile_id").notNull(),
  buildingDefinitionId: uuid("building_definition_id").notNull(),
  gridX: integer("grid_x").notNull(),
  gridY: integer("grid_y").notNull(),
  rotation: integer("rotation").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const schema = {
  profiles,
  families,
  familyMembers,
  children,
  gameProfiles,
  virtualWallets,
  virtualTransactions,
  buildingDefinitions,
  shopItems,
  quests,
  questCompletions,
  savingsGoals,
  userInventory,
  purchases,
  islandObjects,
};
