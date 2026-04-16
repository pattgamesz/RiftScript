// Combat simulation engine for RiftScript
// Based on the Ironwood RPG combat simulator spreadsheet

function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

function mulberry32(seed) {
    return function () {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export function simulate(config) {
    const simulationTime = (config.simHours || 1) * 3600;
    const seedString = config.seed || String(Date.now());
    const isOutskirts = config.isOutskirts || false;

    const seed = cyrb128(seedString);
    const prng = mulberry32(seed);

    const player = {
        maxHealth: config.playerHealth || 100,
        currentHealth: config.playerHealth || 100,
        attack: config.playerAttack || 0,
        attackDelay: config.playerSpeed || 2.5,
        damageIncrease: (config.damagePercent || 0) / 100,
        damageReduction: (config.blockPercent || 0) / 100,
        healAmount: config.foodHp || 0,
        accuracy: (config.accuracy || 90) / 100,
        evasion: (config.evasion || 0) / 100,
    };

    const monster = {
        maxHealth: config.monsterHealth || 100,
        currentHealth: config.monsterHealth || 100,
        attack: config.monsterAttack || 0,
        attackDelay: config.monsterSpeed || 2.0,
        damageIncrease: (config.monsterDamage || 0) / 100,
        damageReduction: (config.monsterBlock || 0) / 100,
    };

    const regionAdvantage = config.regionAdvantage || 1;
    const reviveSpeed = config.reviveSpeed || 900;
    const outskirtsDelay = config.outskirtsDelay || 1200;

    const timeStep = 0.5;
    const HEAL_THRESHOLD = player.maxHealth * 0.33;
    const HEAL_COOLDOWN_DURATION = 15;
    const MONSTER_RESPAWN_PAUSE = 1;

    let currentTime = 0;
    let playerAttackTimer = player.attackDelay;
    let monsterAttackTimer = monster.attackDelay;
    let playerHealCooldown = 0;

    let monstersDefeated = 0;
    let playerDefeats = 0;
    let healsUsed = 0;

    while (currentTime < simulationTime) {
        // Player attacks
        if (playerAttackTimer <= 0) {
            if (prng() < player.accuracy) {
                const baseDamage = player.attack * (1 + player.damageIncrease) * (1 - monster.damageReduction);
                const randomMultiplier = prng() * 0.25 + 0.75;
                const actualDamage = baseDamage * randomMultiplier * regionAdvantage;
                monster.currentHealth -= actualDamage;
            }
            playerAttackTimer = player.attackDelay;
        }

        // Monster attacks
        if (monsterAttackTimer <= 0) {
            if (prng() >= player.evasion) {
                const baseDamage = monster.attack * (1 + monster.damageIncrease) * (1 - player.damageReduction);
                const randomMultiplier = prng() * 0.25 + 0.75;
                const actualDamage = baseDamage * randomMultiplier;
                player.currentHealth -= actualDamage;
            }
            monsterAttackTimer = monster.attackDelay;
        }

        // Healing (disabled in Outskirts)
        if (!isOutskirts && player.currentHealth < HEAL_THRESHOLD && playerHealCooldown <= 0 && player.healAmount > 0) {
            player.currentHealth = Math.min(player.maxHealth, player.currentHealth + player.healAmount);
            healsUsed++;
            playerHealCooldown = HEAL_COOLDOWN_DURATION;
        }

        // Monster defeated
        if (monster.currentHealth <= 0) {
            monstersDefeated++;
            currentTime += MONSTER_RESPAWN_PAUSE;

            if (isOutskirts) {
                currentTime += outskirtsDelay;
                player.currentHealth = player.maxHealth;
            }

            monster.currentHealth = monster.maxHealth;
            monsterAttackTimer = monster.attackDelay;
            playerAttackTimer = player.attackDelay;
        }

        // Player defeated
        if (player.currentHealth <= 0) {
            playerDefeats++;
            currentTime += reviveSpeed;

            if (isOutskirts) {
                currentTime += outskirtsDelay;
            }

            if (currentTime >= simulationTime) break;

            player.currentHealth = player.maxHealth;
            monster.currentHealth = monster.maxHealth;
            playerAttackTimer = player.attackDelay;
            monsterAttackTimer = monster.attackDelay;
        }

        // Advance time
        currentTime += timeStep;
        if (playerAttackTimer > 0) playerAttackTimer -= timeStep;
        if (monsterAttackTimer > 0) monsterAttackTimer -= timeStep;
        if (playerHealCooldown > 0) playerHealCooldown -= timeStep;
    }

    const hours = simulationTime / 3600;
    const baseKPH = monstersDefeated / hours;
    const finalKPH = baseKPH * (1 + (config.efficiency || 0) / 100);
    const foodPerHour = healsUsed / hours;

    return {
        monstersDefeated,
        playerDefeats,
        healsUsed,
        baseKPH,
        finalKPH,
        foodPerHour,
        canSurvive: true,
    };
}

export function calculateResults(config, simResult) {
    const lootMod = (config.lootBonus || 0) / 100;
    const xpMod = (config.xpBonus || 0) / 100;
    const baseXp = config.baseXpPerKill || 0;
    const lootPerKill = config.lootValuePerKill || 0;
    const foodCost = config.foodCost || 0;
    const otherCostPerHour = config.otherCostPerHour || 0;

    const { finalKPH, foodPerHour } = simResult;

    const xpPerHour = baseXp * (1 + xpMod) * finalKPH;
    const lootPerHour = lootPerKill * (1 + lootMod) * finalKPH;
    const foodCostPerHour = foodPerHour * foodCost;
    const totalCostPerHour = foodCostPerHour + otherCostPerHour;
    const profitPerHour = lootPerHour - totalCostPerHour;

    return {
        xpPerHour,
        lootPerHour,
        foodCostPerHour,
        totalCostPerHour,
        profitPerHour,
    };
}
