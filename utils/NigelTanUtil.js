const fs = require('fs').promises;
const path = require('path');
const TRANSACTIONS_FILE = path.join('utils', 'transactions.json');

// ===== Limits (same as Create) - all money in cents =====
const MAX_AMOUNT_CENTS = 1000000;   // $10,000.00 per transaction
const MAX_TOTAL_CENTS = 10000000;   // $100,000.00 total
const MAX_DESCRIPTION = 40;         // characters

// ===== Helpers =====
function toCents(value) {
    return Math.round(Number(value) * 100);
}

function formatMoney(cents) {
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Income adds to the total, expense subtracts
function effectCents(t) {
    const cents = toCents(t.amount);
    return t.type === 'income' ? cents : -cents;
}

// Send an error. field = 'amount' | 'description' | 'type' | null
function fail(res, status, field, message) {
    return res.status(status).json({ field: field, message: message });
}

async function updateTransaction(req, res) {
    try {
        const { id } = req.params;
        const { amount, type, description } = req.body;

        // ===== Error 1: Invalid input (400) =====

        // Amount: positive number
        if (amount === undefined || amount === null || String(amount).trim() === '' ||
            isNaN(Number(amount)) || Number(amount) <= 0) {
            return fail(res, 400, 'amount', 'Amount must be a positive number.');
        }

        // Amount: at most 2 decimal places
        if (!/^\d+(\.\d{1,2})?$/.test(String(amount).trim())) {
            return fail(res, 400, 'amount', 'Amount can have at most 2 decimal places.');
        }

        // Amount: at most $10,000.00
        const newCents = toCents(amount);
        if (newCents > MAX_AMOUNT_CENTS) {
            return fail(res, 400, 'amount', 'Amount cannot be more than ' + formatMoney(MAX_AMOUNT_CENTS) + '.');
        }

        // Type: income or expense
        if (type !== 'income' && type !== 'expense') {
            return fail(res, 400, 'type', 'Type must be income or expense.');
        }

        // Description: required, at most 40 characters
        if (typeof description !== 'string' || description.trim() === '') {
            return fail(res, 400, 'description', 'Description is required.');
        }
        const cleanDescription = description.trim();
        if (cleanDescription.length > MAX_DESCRIPTION) {
            return fail(res, 400, 'description', 'Description must be ' + MAX_DESCRIPTION + ' characters or less.');
        }

        // ===== Read the JSON data store =====
        let transactions = [];
        try {
            const data = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
            transactions = JSON.parse(data);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return fail(res, 404, null, 'No transactions found to update.');
            }
            throw err;
        }

        // ===== Error 2: Transaction not found (404) =====
        const index = transactions.findIndex(t => t.id == id);
        if (index === -1) {
            return fail(res, 404, null, 'Transaction not found.');
        }

        // ===== Error 3: No changes made (400) =====
        const existing = transactions[index];
        if (toCents(existing.amount) === newCents &&
            existing.type === type &&
            existing.description === cleanDescription) {
            return fail(res, 400, null, 'No changes were made.');
        }

        // ===== Error 4: Total would go over $100,000.00 (400) =====
        let oldTotal = 0;
        for (const t of transactions) {
            oldTotal += effectCents(t);
        }
        const baseTotal = oldTotal - effectCents(existing);           // total without this entry
        const newEffect = (type === 'income') ? newCents : -newCents;
        const newTotal = baseTotal + newEffect;

        // Only block if over the cap AND the edit makes the total go up
        if (newTotal > MAX_TOTAL_CENTS && newTotal > oldTotal) {
            // Highest total this edit is allowed to reach (cap, or the old total if old data was already over)
            const allowedTotal = Math.max(MAX_TOTAL_CENTS, oldTotal);
            let message = "You can't change this to " + formatMoney(newCents) +
                          " because your total would go over " + formatMoney(MAX_TOTAL_CENTS) + ".";

            if (type === 'income') {
                const maxAllowed = Math.min(allowedTotal - baseTotal, MAX_AMOUNT_CENTS);
                message += (maxAllowed > 0)
                    ? ' You can add up to ' + formatMoney(maxAllowed) + '.'
                    : " You can't add any more income right now.";
            } else {
                // Expense: a smaller expense raises the total, so there is a minimum instead
                const minAllowed = baseTotal - allowedTotal;
                message += ' The amount must be at least ' + formatMoney(minAllowed) + '.';
            }
            return fail(res, 400, 'amount', message);
        }

        // ===== Success: update and save =====
        transactions[index] = {
            ...existing,
            amount: newCents / 100,
            type: type,
            description: cleanDescription
        };

        await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2), 'utf8');
        return res.status(200).json({ message: 'Transaction updated successfully!', transaction: transactions[index] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ field: null, message: error.message });
    }
}

module.exports = { updateTransaction };