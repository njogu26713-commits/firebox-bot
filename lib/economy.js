/**
 * Firebox Bot Economy / RPG System Configuration
 */

const items = [
    { id: "pickaxe", name: "⛏️ Iron Pickaxe", price: 500, description: "Boosts your earnings in !work.", multiplier: 1.2 },
    { id: "gold_pickaxe", name: "✨ Golden Pickaxe", price: 2500, description: "Greatly boosts your earnings in !work.", multiplier: 2.0 },
    { id: "diamond_pickaxe", name: "💎 Diamond Pickaxe", price: 10000, description: "The ultimate tool for massive !work earnings.", multiplier: 5.0 },
    { id: "fast_pass", name: "🏎️ Fast Pass", price: 1500, description: "Reduces your work cooldown significantly.", cooldownReduce: 0.5 },
    { id: "mask", name: "🎭 Bandit Mask", price: 1000, description: "Increases your success rate in !crime.", successBoost: 0.1 },
    { id: "gloves", name: "🧤 Silk Gloves", price: 800, description: "Reduces the chance of being caught in !rob.", robProtection: 0.2 },
    { id: "shield", name: "🛡️ Guardian Shield", price: 3000, description: "Protects 50% of your wallet from being robbed.", protection: 0.5 },
    { id: "cape", name: "👑 Royal Cape", price: 50000, description: "A status symbol for the richest of the rich.", badge: "KING" },
];

/**
 * Get an item by ID
 * @param {string} id 
 */
function getItem(id) {
    return items.find(i => i.id === id);
}

/**
 * Calculate multi-item effects
 * @param {Array} inventory 
 * @param {string} property 
 */
function getEffect(inventory, property) {
    let total = 0;
    inventory.forEach(invItem => {
        const item = getItem(invItem.id);
        if (item && item[property]) {
            total += item[property];
        }
    });
    return total;
}

module.exports = { items, getItem, getEffect };
