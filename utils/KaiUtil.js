// Kai - DELETE (back end): DELETE /delete-transaction/:id
const fs = require('fs').promises;
const path = require('path');

// Same file the view-transactions and add-transaction utils use
const RESOURCES_FILE = path.join(__dirname, 'transactions.json');

async function readTransactions() {
    try {
        const data = await fs.readFile(RESOURCES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // File doesn't exist yet -> start with an empty list
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function deleteTransaction(req, res) {
    try {
        // id can be missing (DELETE /delete-transaction) so default to ''
        const id = String(req.params.id ?? '').trim();

        // ---- Validation (400) ----
        // id is required, and must be a positive whole number, e.g. "3"
        if (id === '') {
            return res.status(400).json({ field: 'id', message: 'Transaction id is required.' });
        }
        if (!/^\d+$/.test(id) || Number(id) < 1) {
            return res.status(400).json({ field: 'id', message: 'Invalid transaction id. It must be a positive whole number.' });
        }

        const allTransactions = await readTransactions();

        // ---- Not found (404) ----
        // The transaction must exist (ids are stored as strings, e.g. "1", "2")
        const index = allTransactions.findIndex(t => String(t.id) === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        // Remove it and save the file
        const deletedTransaction = allTransactions.splice(index, 1)[0];
        await fs.writeFile(RESOURCES_FILE, JSON.stringify(allTransactions, null, 4), 'utf8');

        return res.status(200).json(deletedTransaction);
    } catch (error) {
        // ---- Unexpected error (500) ----
        return res.status(500).json({ message: error.message });
    }
}

module.exports = { deleteTransaction };