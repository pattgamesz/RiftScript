// Combat modifier calculations for RiftScript
// Based on Ironwood RPG combat simulator spreadsheet by Rivea

export function calculateEfficiency(config) {
    const levelDiff = (config.primaryLevel || 0) - (config.monsterLevel || 0);
    const level = Math.max(levelDiff, 0) * 0.5;
    const guild = (config.guildLibraryLevel || 0) * 2;
    const ring = config.efficiencyChance || 0;
    const effRune = config.relicEfficiency || 0;
    const insatiable = config.insatiableTomeEffect || 0;
    const trait = config.traitEfficiency || 0;
    const marks = config.markBonus || 0;
    const regionRuneMastery = config.regionRuneMastery || 0;
    const extraDoubleAction = config.extraDoubleAction || 0;
    const potionMultiKill = config.potionMultiKill || 0;
    const total = level + guild + ring + effRune + insatiable + trait + marks + regionRuneMastery + extraDoubleAction + potionMultiKill;
    return {
      level,
      guild,
      ring,
      effRune,
      insatiable,
      trait,
      marks,
      regionRuneMastery,
      extraDoubleAction,
      potionMultiKill,
      total
    };
  }
export function calculateXpModifiers(config) {
    const potion = config.potionType === "xp" ? config.potionEffect || 0 : 0;
    const brew = config.brewType === "xp" ? config.brewEffect || 0 : 0;
    const relicDoubleXP = config.relicDoubleXP || 0;
    const trait = config.traitXP || 0;
    const mark = config.markBonus || 0;
    const savageTome = config.savageTomeEffect || 0;
    const bracelet = config.doubleExpChance || 0;
    const weapon = config.weaponXpBonus || 0;
    const skillXpBonus = config.skillXpBonus || 0;
    const adventureXp = config.adventureMode === "t10xp" ? config.adventureEffect || 0 : 0;
    const contractXp = config.contractActive ? config.doubleContractTrigger || 0 : 0;
    const total = potion + brew + relicDoubleXP + trait + mark + savageTome + bracelet + weapon + skillXpBonus + adventureXp + contractXp;
    return {
      potion,
      brew,
      relicDoubleXP,
      trait,
      mark,
      savageTome,
      bracelet,
      weapon,
      skillXpBonus,
      adventureXp,
      contractXp,
      total
    };
  }
export function calculateLootModifiers(config) {
    const amulet = config.doubleLootChance || 0;
    const potion = config.potionType === "loot" ? config.potionEffect || 0 : 0;
    const trait = config.traitLoot || 0;
    const adventureLoot = config.adventureMode === "t10loot" ? config.adventureEffect || 0 : 0;
    const total = amulet + potion + trait + adventureLoot;
    return { amulet, potion, trait, adventureLoot, total };
  }
export function calculateDamageBlock(config) {
    const weaponAttack = config.playerAttack || 0;
    const weaponDamage = config.damagePercent || 0;
    const regionDamageRune = config.regionDamageRune || 0;
    const eliteDamageRune = config.contentType === "elite" ? config.eliteDamageRune || 0 : 0;
    const petAttackBonus = config.petAttack || 0;
    const totalDamage = weaponDamage + regionDamageRune + eliteDamageRune;
    const baseArmor = config.blockPercent || 0;
    const regionBlockRune = config.regionBlockRune || 0;
    const eliteBlockRune = config.contentType === "elite" ? config.eliteBlockRune || 0 : 0;
    const petDefenseBonus = config.petDefense || 0;
    const petHealthBonus = config.petHealth || 0;
    const reducedMonsterHealth = config.reducedMonsterHealth || 0;
    const uncappedAccuracy = config.uncappedAccuracy || 0;
    const uncappedEvasion = config.uncappedEvasion || 0;
    const totalBlock = baseArmor + regionBlockRune + eliteBlockRune + petDefenseBonus;
    return {
      weaponAttack,
      weaponDamage,
      regionDamageRune,
      eliteDamageRune,
      petAttackBonus,
      petDefenseBonus,
      petHealthBonus,
      reducedMonsterHealth,
      uncappedAccuracy,
      uncappedEvasion,
      totalDamage,
      baseArmor,
      regionBlockRune,
      eliteBlockRune,
      totalBlock
    };
  }
export function calculateConsumableCosts(config, killsPerHour, foodPerHour) {
    const preserveFoodMult = 1 - (config.preserveFood || 0) / 100;
    const food = foodPerHour * (config.foodCost || 0) * preserveFoodMult;
    const potionsPerHour = config.potionCost ? 4 : 0;
    const preservePotionMult = 1 - (config.preservePotion || 0) / 100;
    const potion = potionsPerHour * (config.potionCost || 0) * preservePotionMult;
    const brewsPerHour = config.brewCost ? 6 : 0;
    const brew = brewsPerHour * (config.brewCost || 0);
    const sigilsPerHour = config.sigilCost ? 2 : 0;
    const preserveSigilMult = 1 - (config.preserveSigil || 0) / 100;
    const sigil = sigilsPerHour * (config.sigilCost || 0) * preserveSigilMult;
    const key2 = config.contentType === "elite" ? killsPerHour * (config.keyCost || 0) : 0;
    const preserveContractMult = 1 - (config.preserveContract || 0) / 100;
    const contract = config.contractActive ? killsPerHour * (config.contractCost || 0) * preserveContractMult : 0;
    const total = food + potion + brew + sigil + key2 + contract;
    return { food, potion, brew, sigil, key: key2, contract, total };
  }
export function calculateGuildContribution(killsPerHour, simHours, isGuildEventActive) {
    if (!isGuildEventActive) return 0;
    const baseContribution = killsPerHour * simHours;
    return Math.floor(baseContribution);
  }

  // src/ui/combatSimPage.js
