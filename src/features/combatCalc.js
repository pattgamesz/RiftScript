// Combat simulation engine for RiftScript
// Deterministic average-damage model

export function simulate(config) {
    const pAtk = config.playerAttack || 0;
    const pSpd = config.playerSpeed || 2.5;
    const dmg = (config.damagePercent || 0) / 100;
    const blk = (config.blockPercent || 0) / 100;
    const acc = (config.accuracy || 90) / 100;
    const eva = (config.evasion || 0) / 100;
    const pHp = config.playerHealth || 100;
    const foodHp = config.foodHp || 0;

    const mHp = config.monsterHealth || 100;
    const mAtk = config.monsterAttack || 0;
    const mSpd = config.monsterSpeed || 2.0;
    const mDmg = (config.monsterDamage || 0) / 100;
    const mBlk = (config.monsterBlock || 0) / 100;

    const eff = (config.efficiency || 0) / 100;

    const playerDmgPerHit = pAtk * (1 + dmg) * acc * (1 - mBlk);
    const monsterDmgPerHit = mAtk * (1 + mDmg) * (1 - blk) * (1 - eva);

    if (playerDmgPerHit <= 0) {
        return { baseKPH: 0, finalKPH: 0, foodPerHour: 0, canSurvive: true, timePerKill: Infinity };
    }

    // Simulate one kill using turn-based timing
    let hp = pHp;
    let monsterHp = mHp;
    let time = 0;
    let pNext = pSpd;
    let mNext = mSpd;
    let heals = 0;
    const healThreshold = monsterDmgPerHit > 0 ? monsterDmgPerHit * 2 : 0;

    while (monsterHp > 0 && time < 600) {
        if (pNext <= mNext) {
            time = pNext;
            if (foodHp > 0 && hp <= healThreshold && monsterHp > playerDmgPerHit * 0.5) {
                hp = Math.min(hp + foodHp, pHp);
                heals++;
            } else {
                monsterHp -= playerDmgPerHit;
            }
            pNext += pSpd;
        } else {
            time = mNext;
            hp -= monsterDmgPerHit;
            if (hp <= 0) {
                return { baseKPH: 0, finalKPH: 0, foodPerHour: 0, canSurvive: false, timePerKill: Infinity };
            }
            mNext += mSpd;
        }
    }

    if (time >= 600) {
        return { baseKPH: 0, finalKPH: 0, foodPerHour: 0, canSurvive: true, timePerKill: Infinity };
    }

    const timePerKill = time;
    const baseKPH = 3600 / timePerKill;
    const finalKPH = baseKPH * (1 + eff);
    // Food only consumed during actual fights, not efficiency bonus kills
    const foodPerHour = heals * baseKPH;

    return {
        baseKPH,
        finalKPH,
        foodPerHour,
        timePerKill,
        healsPerKill: heals,
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
