const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_FILE = path.join(__dirname, "../database/dashboard-registry.json");
const STATUSES = new Set(["online", "offline", "maintenance"]);
const ENVIRONMENTS = new Set(["production", "staging", "development", "other"]);

function now() {
    return new Date().toISOString();
}

function safeText(value, maxLength) {
    if (typeof value !== "string") return null;
    const cleaned = value.trim();
    return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

class DashboardStore {
    constructor(filePath = DEFAULT_FILE) {
        this.filePath = filePath;
        this.data = { users: [], servers: [] };
        this.load();
    }

    load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                this.persist();
                return;
            }
            const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
            this.data = {
                users: Array.isArray(parsed.users) ? parsed.users : [],
                servers: Array.isArray(parsed.servers) ? parsed.servers : [],
            };
        } catch (error) {
            console.error("[DashboardStore] Failed to load registry:", error.message);
            this.data = { users: [], servers: [] };
        }
    }

    persist() {
        const directory = path.dirname(this.filePath);
        fs.mkdirSync(directory, { recursive: true });
        const tempPath = `${this.filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf8");
        fs.renameSync(tempPath, this.filePath);
    }

    publicUser(user) {
        return user ? { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } : null;
    }

    findUserByEmail(email) {
        return this.data.users.find(user => user.email === email.toLowerCase()) || null;
    }

    findUserById(id) {
        return this.data.users.find(user => user.id === id) || null;
    }

    async createUser({ name, email, password }) {
        const cleanName = safeText(name, 120);
        const cleanEmail = safeText(email, 320)?.toLowerCase();
        if (!cleanName || !cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
            throw new Error("Provide a valid name and email address.");
        }
        if (typeof password !== "string" || password.length < 10 || password.length > 200) {
            throw new Error("Use a password between 10 and 200 characters.");
        }
        if (this.findUserByEmail(cleanEmail)) throw new Error("An account with this email already exists.");

        const user = {
            id: crypto.randomUUID(),
            name: cleanName,
            email: cleanEmail,
            passwordHash: await bcrypt.hash(password, 12),
            createdAt: now(),
        };
        this.data.users.push(user);
        this.persist();
        return this.publicUser(user);
    }

    async authenticate(email, password) {
        const user = this.findUserByEmail(String(email || ""));
        if (!user || typeof password !== "string") return null;
        return (await bcrypt.compare(password, user.passwordHash)) ? this.publicUser(user) : null;
    }

    publicServer(server) {
        if (!server) return null;
        const { ownerId, ...publicServer } = server;
        return publicServer;
    }

    validateServer(input, partial = false) {
        const clean = {};
        const fields = [
            ["instanceName", 160],
            ["provider", 120],
            ["endpoint", 500],
            ["region", 120],
        ];

        for (const [field, maxLength] of fields) {
            if (input[field] === undefined && partial) continue;
            const value = safeText(input[field], maxLength);
            if (!value) throw new Error(`${field} is required.`);
            clean[field] = value;
        }

        if (input.environment === undefined && partial) {
            // No change requested.
        } else if (!ENVIRONMENTS.has(input.environment)) {
            throw new Error("Choose a valid environment.");
        } else {
            clean.environment = input.environment;
        }

        if (input.status === undefined && partial) {
            // No change requested.
        } else if (!STATUSES.has(input.status)) {
            throw new Error("Choose a valid status.");
        } else {
            clean.status = input.status;
        }

        if (input.notes === undefined && partial) {
            // No change requested.
        } else if (input.notes === null || input.notes === "") {
            clean.notes = "";
        } else {
            const notes = safeText(input.notes, 4000);
            if (!notes) throw new Error("Notes must be text with 4,000 characters or fewer.");
            clean.notes = notes;
        }

        return clean;
    }

    listServers(ownerId) {
        return this.data.servers
            .filter(server => server.ownerId === ownerId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(server => this.publicServer(server));
    }

    getServer(ownerId, id) {
        const server = this.data.servers.find(record => record.ownerId === ownerId && record.id === id);
        return this.publicServer(server);
    }

    createServer(ownerId, input) {
        const server = {
            id: crypto.randomUUID(),
            ownerId,
            ...this.validateServer(input),
            createdAt: now(),
            updatedAt: now(),
        };
        this.data.servers.push(server);
        this.persist();
        return this.publicServer(server);
    }

    updateServer(ownerId, id, input) {
        const server = this.data.servers.find(record => record.ownerId === ownerId && record.id === id);
        if (!server) return null;
        Object.assign(server, this.validateServer(input, true), { updatedAt: now() });
        this.persist();
        return this.publicServer(server);
    }

    deleteServer(ownerId, id) {
        const index = this.data.servers.findIndex(record => record.ownerId === ownerId && record.id === id);
        if (index === -1) return false;
        this.data.servers.splice(index, 1);
        this.persist();
        return true;
    }

    overview(ownerId) {
        const records = this.listServers(ownerId);
        return {
            total: records.length,
            online: records.filter(record => record.status === "online").length,
            offline: records.filter(record => record.status === "offline").length,
            maintenance: records.filter(record => record.status === "maintenance").length,
            recent: records.slice(0, 5),
        };
    }
}

function createDashboardStore(filePath) {
    return new DashboardStore(filePath);
}

module.exports = { DashboardStore, createDashboardStore, STATUSES: [...STATUSES], ENVIRONMENTS: [...ENVIRONMENTS] };
