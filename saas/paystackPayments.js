const crypto = require("crypto");

const PLANS = Object.freeze({
    7: Object.freeze({ days: 7, amount: 29 }),
    14: Object.freeze({ days: 14, amount: 49 }),
    30: Object.freeze({ days: 30, amount: 99 }),
});
const PAYSTACK_API = "https://api.paystack.co";

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!/^[1-9]\d{6,14}$/.test(digits)) {
        throw httpError(400, "Enter a WhatsApp number with country code, for example +254712345678.");
    }
    return digits;
}

function normalizeMpesaPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!/^254[17]\d{8}$/.test(digits)) {
        throw httpError(400, "Enter a Kenyan M-PESA number with country code, for example +254712345678.");
    }
    return digits;
}

function normalizeAirtelPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!/^254[17]\d{8}$/.test(digits)) {
        throw httpError(400, "Enter a Kenyan Airtel Money number with country code, for example +254712345678.");
    }
    return digits;
}

function normalizeEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw httpError(400, "Enter a valid email address for the payment receipt.");
    }
    return email;
}

function parseMetadata(value) {
    if (value && typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

function verifyWebhookSignature(rawBody, signature, secret) {
    if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !secret) return false;
    const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    const supplied = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
}

function createPaystackService({
    tokenRegistry,
    fetchImpl = globalThis.fetch,
    getSecret = () => process.env.PAYSTACK_SECRET_KEY,
    isEnabled = () => String(process.env.PAYSTACK_ENABLED || "false").toLowerCase() === "true",
} = {}) {
    if (!tokenRegistry) throw new TypeError("tokenRegistry is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

    function requireSecret() {
        if (!getSecret()) {
            throw httpError(503, "Payments are not configured. Please try again later.");
        }
        return getSecret();
    }

    function requireEnabled() {
        const secret = requireSecret();
        if (!isEnabled()) throw httpError(503, "Payments are not configured. Please try again later.");
        return secret;
    }

    async function paystackRequest(path, { method = "GET", body } = {}) {
        const secret = requireSecret();
        let response;
        try {
            response = await fetchImpl(`${PAYSTACK_API}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${secret}`,
                    "Content-Type": "application/json",
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
                signal: AbortSignal.timeout(15000),
            });
        } catch {
            throw httpError(502, "Payment service is temporarily unavailable. Please retry shortly.");
        }
        const result = await response.json().catch(() => null);
        if (!response.ok || !result || result.status !== true) {
            throw httpError(502, "The payment request could not be processed. Please retry or contact support.");
        }
        return result.data;
    }

    async function initializeCharge({ token: tokenInput, phone: phoneInput, payerPhone: payerPhoneInput, email: emailInput, days: daysInput, paymentMethod: paymentMethodInput }) {
        requireEnabled();
        let phone;
        if (tokenInput) {
            if (typeof tokenRegistry.resolveForPayment !== "function") throw httpError(503, "Token payment lookup is not available.");
            try {
                const resolved = await tokenRegistry.resolveForPayment(String(tokenInput).trim().toUpperCase());
                phone = normalizePhone(resolved.phone);
            } catch (error) {
                throw httpError(400, error.message || "Enter a valid Firebox token.");
            }
        } else phone = normalizePhone(phoneInput);
        const email = normalizeEmail(emailInput);
        const days = Number(daysInput);
        const plan = PLANS[days];
        if (!plan) throw httpError(400, "Select one of the available access plans.");
        const paymentMethod = String(paymentMethodInput || "mpesa").toLowerCase();
        if (!['mpesa', 'airtel', 'card'].includes(paymentMethod)) throw httpError(400, "Select M-PESA, Airtel Money, or Visa/Mastercard.");
        const isCard = paymentMethod === "card";
        const payerPhone = isCard ? "" : (paymentMethod === "airtel" ? normalizeAirtelPhone(payerPhoneInput) : normalizeMpesaPhone(payerPhoneInput));

        if (typeof tokenRegistry.canPurchase === "function") {
            const eligibility = await tokenRegistry.canPurchase(phone);
            if (!eligibility.allowed) throw httpError(409, eligibility.message);
        }

        // References are server-generated and restricted to Paystack's documented
        // alphanumeric/hyphen character set.
        const reference = `fb-${crypto.randomBytes(16).toString("hex")}`;
        const metadata = {
            application: "firebox-bot",
            plan_days: plan.days,
            plan_amount_kes: plan.amount,
            whatsapp_phone: phone,
            payer_phone: payerPhone,
            payment_method: paymentMethod,
            mobile_money_provider: isCard ? "" : paymentMethod === "airtel" ? "atl" : "mpesa",
            email,
        };
        const body = {
            email,
            amount: plan.amount * 100,
            currency: "KES",
            reference,
            metadata,
        };
        const path = isCard ? "/transaction/initialize" : "/charge";
        if (isCard) {
            body.callback_url = process.env.PAYSTACK_CALLBACK_URL || undefined;
        } else {
            body.mobile_money = { phone: `+${payerPhone}`, provider: paymentMethod === "airtel" ? "atl" : "mpesa" };
        }
        const charge = await paystackRequest(path, {
            method: "POST",
            body,
        });
        if (!charge || charge.reference !== reference) {
            throw httpError(502, "The payment service returned an unexpected reference. No token was issued.");
        }
        return {
            reference,
            paymentMethod,
            accessCode: isCard ? String(charge.access_code || "") : "",
            authorizationUrl: isCard ? String(charge.authorization_url || "") : "",
            status: String(charge.status || (isCard ? "redirect" : "pending")),
            displayText: isCard
                ? "Continue to Paystack Checkout to pay with Visa or Mastercard."
                : String(charge.display_text || `Approve the ${paymentMethod === "airtel" ? "Airtel Money" : "M-PESA"} prompt sent to +${payerPhone}, then check payment status.`),
            message: isCard ? "Secure card checkout created." : `${paymentMethod === "airtel" ? "Airtel Money" : "M-PESA"} payment request sent.`,
        };
    }

    async function verifyAndGrant(referenceInput) {
        requireSecret();
        const reference = String(referenceInput || "").trim();
        if (!/^fb-[a-f0-9]{32}$/.test(reference)) throw httpError(400, "Invalid payment reference.");

        const transaction = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
        if (!transaction || transaction.reference !== reference) {
            throw httpError(400, "Payment reference could not be verified.");
        }

        const metadata = parseMetadata(transaction.metadata);
        const days = Number(metadata && metadata.plan_days);
        const plan = PLANS[days];
        // Accept the old single-number metadata for any payment that was already
        // in flight when this separate-payer checkout was deployed.
        const phone = metadata && String(metadata.whatsapp_phone || metadata.phone || "");
        const payerPhone = metadata && String(metadata.payer_phone || metadata.phone || "");
        const paymentMethod = String(metadata && metadata.payment_method || (transaction.channel === "card" ? "card" : "mpesa")).toLowerCase();
        const expectedProvider = paymentMethod === "airtel" ? "atl" : "mpesa";
        const email = metadata && String(metadata.email || "").trim().toLowerCase();
        const customerEmail = String(transaction.customer && transaction.customer.email || "").trim().toLowerCase();
        const transactionProvider = String(transaction.mobile_money && transaction.mobile_money.provider || transaction.authorization && transaction.authorization.mobile_money_provider || "").toLowerCase();
        const channelMatches = paymentMethod === "card"
            ? transaction.channel === "card"
            : transaction.channel === "mobile_money" && (!transactionProvider || transactionProvider === expectedProvider);
        if (!metadata || metadata.application !== "firebox-bot" || !plan ||
            Number(metadata.plan_amount_kes) !== plan.amount ||
            !/^[1-9]\d{6,14}$/.test(phone) || (paymentMethod !== "card" && !/^254[17]\d{8}$/.test(payerPhone)) ||
            !email || customerEmail !== email ||
            Number(transaction.amount) !== plan.amount * 100 || transaction.currency !== "KES" ||
            !['mpesa', 'airtel', 'card'].includes(paymentMethod) || !channelMatches ||
            (paymentMethod !== "card" && metadata.mobile_money_provider && metadata.mobile_money_provider !== expectedProvider)) {
            throw httpError(400, "Verified payment does not match a Firebox access plan.");
        }

        if (transaction.status !== "success") {
            const status = ["pending", "ongoing", "processing"].includes(String(transaction.status).toLowerCase())
                ? "pending" : "failed";
            return {
                status,
                reference,
                days: plan.days,
                message: status === "pending"
                    ? "Payment is still awaiting M-PESA approval. Approve the prompt and check again shortly."
                    : "Payment has not been confirmed. No token was issued.",
            };
        }

        const entitlement = await tokenRegistry.applyPaidPlan({ phone, days: plan.days, reference });
        return {
            status: "success",
            reference,
            days: plan.days,
            token: entitlement.token,
            expiresAt: entitlement.expiresAt,
        };
    }

    async function handleWebhook({ rawBody, signature }) {
        const secret = requireSecret();
        if (!verifyWebhookSignature(rawBody, signature, secret)) {
            throw httpError(401, "Invalid Paystack webhook signature.");
        }
        let event;
        try { event = JSON.parse(rawBody.toString("utf8")); }
        catch { throw httpError(400, "Invalid Paystack webhook JSON."); }

        if (event.event !== "charge.success") return { acknowledged: true, ignored: true };
        const reference = event.data && event.data.reference;
        if (!reference) throw httpError(400, "Paystack success webhook is missing its reference.");
        const result = await verifyAndGrant(reference);
        // Do not acknowledge a success event while the API still reports pending;
        // Paystack will retry the webhook and the grant is reference-idempotent.
        if (result.status !== "success") throw httpError(503, "Paystack webhook transaction is not yet verifiably successful.");
        return { acknowledged: true, ignored: false };
    }

    return { initializeCharge, verifyAndGrant, handleWebhook };
}

module.exports = {
    PAYSTACK_API,
    PLANS,
    createPaystackService,
    normalizeEmail,
    normalizeAirtelPhone,
    normalizePhone,
    parseMetadata,
    verifyWebhookSignature,
};
