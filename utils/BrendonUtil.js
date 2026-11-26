// =====================================================================
// Brendon - CREATE (Add amount / Spend amount)  -  BACK END (server)
//
// This file runs on the SERVER (Node), not in the browser. That is why it
// can use "fs" (read/write files) and "req/res" (the request and reply).
//
// Job: handle POST /add-transaction (connected in index.js). When the browser
// sends a new transaction, this file:
//   1. Checks the data is valid          (validation)
//   2. Checks the total stays <= $100,000.00
//   3. Gives it a new id
//   4. Saves it into utils/transactions.json
//   5. Replies to the browser (201 = success, 400 = bad input, 500 = crash)
//
// Why check again when brendon.js already checked? Anyone can skip the
// browser and send data directly, so the server must never trust it.
// =====================================================================

const fs = require('fs').promises; // file reading/writing
const path = require('path');      // builds file paths that work on any computer


// ---------- SECTION 1: Settings ----------

// The JSON "database" file. Same file ViewTransactionUtil.js reads from.
const RESOURCES_FILE = path.join(__dirname, 'transactions.json');

// Limits, stored in CENTS (whole numbers) because decimals like 0.1 + 0.2
// give tiny errors in JavaScript. $10,000.00 = 1000000 cents.
const MAX_AMOUNT_CENTS = 1000000;       // biggest ONE transaction: $10,000.00
const MAX_TOTAL_CENTS = 10000000;       // biggest total balance: $100,000.00
const MAX_DESCRIPTION = 40;             // longest description (characters)

// Small helpers
const toCents = (dollars) => Math.round(Number(dollars) * 100);  // 4.90 -> 490
// 1500 (cents) -> "$15.00", with commas for big numbers
const formatMoney = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


// ---------- SECTION 2: Read the saved transactions ----------

// Returns the list of all saved transactions from the JSON file.
async function readTransactions() {
    try {
        const data = await fs.readFile(RESOURCES_FILE, 'utf8'); // read the file as text
        return JSON.parse(data);                                // text -> JavaScript array
    } catch (error) {
        // ENOENT = "file doesn't exist yet" -> just start with an empty list
        if (error.code === 'ENOENT') return [];
        throw error; // any other problem is a real error
    }
}


// ---------- SECTION 3: The main function (runs for every POST /add-transaction) ----------

// req = what the browser sent (req.body is the JSON from brendon.js)
// res = how we reply
async function addTransaction(req, res) {
    try {
        const { amount, type, description } = req.body; // pull out the 3 values

        // ----- Step 1: Validation (is the data allowed?) -----
        // Each failure replies "400 Bad Request" with {field, message}.
        // brendon.js uses "field" to show the message under the right box.

        // Amount: a positive number with at most 2 decimal places
        const amountStr = String(amount).trim();
        if (!/^\d+(\.\d{1,2})?$/.test(amountStr) || Number(amountStr) <= 0) {
            return res.status(400).json({ field: 'amount', message: 'Please enter a valid amount, e.g. 5 or 4.90' });
        }

        // Amount: not more than $10,000.00 in one go
        if (toCents(amountStr) > MAX_AMOUNT_CENTS) {
            return res.status(400).json({ field: 'amount', message: 'Amount can be at most $10,000.00.' });
        }

        // Type: only "income" (Add amount) or "expense" (Spend amount)
        if (type !== 'income' && type !== 'expense') {
            return res.status(400).json({ field: 'type', message: 'Type must be either "income" or "expense".' });
        }

        // Description: required, max 40 characters
        if (typeof description !== 'string' || description.trim() === '') {
            return res.status(400).json({ field: 'description', message: 'Please enter a short description.' });
        }
        if (description.trim().length > MAX_DESCRIPTION) {
            return res.status(400).json({ field: 'description', message: 'Description must be ' + MAX_DESCRIPTION + ' characters or fewer.' });
        }

        // ----- Step 2: Load the existing transactions -----
        const allTransactions = await readTransactions();

        // ----- Step 3: Total check -----
        // The total is not stored anywhere. We work it out from the history:
        // income adds, expense subtracts.
        let totalCents = 0;
        for (const t of allTransactions) {
            totalCents += (t.type === 'income' ? 1 : -1) * toCents(t.amount);
        }

        // Only "Add amount" can push the total up past the limit.
        if (type === 'income' && totalCents + toCents(amountStr) > MAX_TOTAL_CENTS) {
            // How much more is allowed (never below 0)
            const room = Math.max(MAX_TOTAL_CENTS - totalCents, 0);
            const message = room === 0
                ? 'Your total has reached the ' + formatMoney(MAX_TOTAL_CENTS) + ' limit, so no more money can be added.'
                : 'You can\'t add ' + formatMoney(toCents(amountStr)) + ' because your total would go over ' + formatMoney(MAX_TOTAL_CENTS) + '. You can add up to ' + formatMoney(room) + '.';
            return res.status(400).json({ field: 'amount', message: message });
        }

        // ----- Step 4: Make the new id -----
        // Ids are strings like "1", "2", "3". New id = biggest existing id + 1.
        let maxId = 0;
        for (const t of allTransactions) {
            const n = parseInt(t.id, 10); // "7" -> 7
            if (!isNaN(n) && n > maxId) maxId = n;
        }

        // ----- Step 5: Build the new transaction object -----
        const newTransaction = {
            id: String(maxId + 1),
            amount: Number(amountStr),
            type: type,
            description: description.trim()
        };

        // ----- Step 6: Save it -----
        allTransactions.push(newTransaction); // add to the end of the list
        // Write the whole list back to the file. The 4 makes it neatly indented.
        await fs.writeFile(RESOURCES_FILE, JSON.stringify(allTransactions, null, 4), 'utf8');

        // ----- Step 7: Reply "201 Created" with the new transaction -----
        return res.status(201).json(newTransaction);
    } catch (error) {
        // Something unexpected broke (e.g. the file couldn't be written)
        return res.status(500).json({ message: error.message });
    }
}

// Share the function so index.js can use it:
//   const { addTransaction } = require('./utils/BrendonUtil')
module.exports = { addTransaction };
