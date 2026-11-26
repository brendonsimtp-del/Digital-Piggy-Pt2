// ===== Limits (same as Create) - prefixed so they don't clash with brendon.js =====
var UPDATE_MAX_AMOUNT_CENTS = 1000000;   // $10,000.00
var UPDATE_MAX_TOTAL_CENTS = 10000000;   // $100,000.00
var UPDATE_MAX_DESCRIPTION = 40;

// ===== Helpers =====
function updateToCents(value) {
    return Math.round(Number(value) * 100);
}

function updateFormatMoney(cents) {
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updateEffectCents(t) {
    var cents = updateToCents(t.amount);
    return t.type == 'income' ? cents : -cents;
}

// Stop text like "<b>" in a description from breaking the form HTML
function escapeUpdateHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Put a message under the right field ('amount' / 'description'), or in the general spot
function showUpdateFieldError(field, message) {
    if (field == 'amount') {
        document.getElementById('updateAmountError').innerHTML = message;
    } else if (field == 'description') {
        document.getElementById('updateDescriptionError').innerHTML = message;
    } else {
        var msg = document.getElementById('updateMessage');
        msg.innerHTML = message;
        msg.className = 'form-message error';
    }
}

// Check amount + description. Returns true if there was an error.
function validateUpdateFields(amountText, descriptionText) {
    var hasError = false;
    var amount = String(amountText).trim();
    var description = String(descriptionText).trim();

    if (amount == '' || isNaN(Number(amount)) || Number(amount) <= 0) {
        showUpdateFieldError('amount', 'Please enter a valid amount, e.g. 5 or 4.90');
        hasError = true;
    } else if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
        showUpdateFieldError('amount', 'Amount can have at most 2 decimal places.');
        hasError = true;
    } else if (updateToCents(amount) > UPDATE_MAX_AMOUNT_CENTS) {
        showUpdateFieldError('amount', 'Amount cannot be more than ' + updateFormatMoney(UPDATE_MAX_AMOUNT_CENTS) + '.');
        hasError = true;
    }

    if (description == '') {
        showUpdateFieldError('description', 'Please enter a short description.');
        hasError = true;
    } else if (description.length > UPDATE_MAX_DESCRIPTION) {
        showUpdateFieldError('description', 'Description must be ' + UPDATE_MAX_DESCRIPTION + ' characters or less.');
        hasError = true;
    }

    return hasError;
}

function updateTransaction(id) {
    // 1. Find the transaction that was clicked
    var t = allTransactions.find(x => x.id == id);
    if (!t) {
        viewTransactions(); // list is out of date -> refresh it
        return;
    }

    // 2. Build the form HTML (toggle → amount → description → buttons)
    var html =
        '<div class="type-toggle">' +
            '<button type="button" id="updateBtnIncome" class="toggle-btn" onclick="setType(\'income\')">Add amount</button>' +
            '<button type="button" id="updateBtnExpense" class="toggle-btn" onclick="setType(\'expense\')">Spend amount</button>' +
        '</div>' +
        '<input type="hidden" id="updateType">' +

        '<p class="label">Amount:</p>' +
        '<div class="amount-row">$<input type="number" step="0.01" id="updateAmount" class="amount-input" value="' + Number(t.amount).toFixed(2) + '"></div>' +
        '<p id="updateAmountError" class="field-error"></p>' +

        '<p class="label">Description:</p>' +
        '<textarea id="updateDescription" class="form-control" rows="5" maxlength="' + UPDATE_MAX_DESCRIPTION + '">' +
            escapeUpdateHtml(t.description) +
        '</textarea>' +
        '<p id="updateDescriptionError" class="field-error"></p>' +

        '<p id="updateMessage" class="form-message"></p>' +

        '<div class="form-buttons">' +
            '<button type="button" class="btn btn-back" onclick="closeForm()">' +
                '<img src="images/back-icon.png" alt="Back" class="btn-icon">' +
            '</button>' +
            '<button type="button" class="btn btn-update" onclick="saveUpdate(\'' + id + '\')">' +
                '<img src="images/edit-icon.png" alt="Save changes" class="btn-icon btn-icon-edit">' +
            '</button>' +
        '</div>';

    // 3. Put the form into its own container, show only the update form
    document.getElementById('updateForm').innerHTML = html;
    showOnlyForm('updateForm');

    // 4. Highlight the current type on the toggle
    setType(t.type);

    // 5. Show the right panel, hide the green "+" bar
    document.getElementById('formCol').classList.remove('d-none');
    document.getElementById('addCol').classList.add('d-none');

    // 6. Edge case: old entry already breaks a limit -> show it under the field
    validateUpdateFields(t.amount, t.description);
}

function setType(type) {
    // Save the chosen type in the hidden input (saveUpdate will read this)
    document.getElementById('updateType').value = type;

    var btnIncome = document.getElementById('updateBtnIncome');
    var btnExpense = document.getElementById('updateBtnExpense');

    // Clear both, then colour the selected one
    btnIncome.classList.remove('active-income');
    btnExpense.classList.remove('active-expense');

    if (type == 'income') {
        btnIncome.classList.add('active-income');
    } else {
        btnExpense.classList.add('active-expense');
    }
}

function closeForm() {
    // Clear and hide the update form, bring back the create form
    var updateForm = document.getElementById('updateForm');
    updateForm.innerHTML = '';
    updateForm.classList.add('d-none');
    document.getElementById('createForm').classList.remove('d-none');

    // Hide the right panel, show the green "+" bar again
    document.getElementById('formCol').classList.add('d-none');
    document.getElementById('addCol').classList.remove('d-none');
}

// Clear all messages before checking again
function clearUpdateMessages() {
    document.getElementById('updateAmountError').innerHTML = '';
    document.getElementById('updateDescriptionError').innerHTML = '';
    document.getElementById('updateMessage').innerHTML = '';
    document.getElementById('updateMessage').className = 'form-message';
}

// Function to send updated transaction data to the backend API
function saveUpdate(id) {
    var jsonData = {
        amount: document.getElementById('updateAmount').value,
        type: document.getElementById('updateType').value,
        description: document.getElementById('updateDescription').value
    };

    clearUpdateMessages();

    // ===== Front-end checks: amount + description =====
    if (validateUpdateFields(jsonData.amount, jsonData.description)) {
        return; // Stop - don't send to backend
    }

    var existing = allTransactions.find(x => x.id == id);
    var newCents = updateToCents(jsonData.amount);

    if (existing) {
        // ===== No changes made =====
        if (updateToCents(existing.amount) === newCents &&
            existing.type === jsonData.type &&
            existing.description === jsonData.description.trim()) {
            showUpdateFieldError(null, 'No changes were made.');
            return;
        }

        // ===== Total cap (same maths as the server) =====
        var oldTotal = 0;
        for (var i = 0; i < allTransactions.length; i++) {
            oldTotal += updateEffectCents(allTransactions[i]);
        }
        var baseTotal = oldTotal - updateEffectCents(existing);
        var newTotal = baseTotal + (jsonData.type == 'income' ? newCents : -newCents);

        if (newTotal > UPDATE_MAX_TOTAL_CENTS && newTotal > oldTotal) {
            var allowedTotal = Math.max(UPDATE_MAX_TOTAL_CENTS, oldTotal);
            var message = "You can't change this to " + updateFormatMoney(newCents) +
                          " because your total would go over " + updateFormatMoney(UPDATE_MAX_TOTAL_CENTS) + ".";
            if (jsonData.type == 'income') {
                var maxAllowed = Math.min(allowedTotal - baseTotal, UPDATE_MAX_AMOUNT_CENTS);
                message += (maxAllowed > 0)
                    ? ' You can add up to ' + updateFormatMoney(maxAllowed) + '.'
                    : " You can't add any more income right now.";
            } else {
                message += ' The amount must be at least ' + updateFormatMoney(baseTotal - allowedTotal) + '.';
            }
            showUpdateFieldError('amount', message);
            return;
        }
    }

    // ===== Send PUT request (server checks everything again) =====
    var request = new XMLHttpRequest();
    request.open('PUT', '/update-transaction/' + encodeURIComponent(id), true);
    request.setRequestHeader('Content-Type', 'application/json');

    request.onload = function () {
        var response = {};
        try {
            response = JSON.parse(request.responseText);
        } catch (e) { }

        if (request.status == 200) {
            var msg = document.getElementById('updateMessage');
            msg.innerHTML = response.message || 'Transaction updated successfully!';
            msg.className = 'form-message success';
            viewTransactions(); // reload the list and total (form stays open)
        } else {
            // 400 -> under the matching field; 404 / 500 -> general message
            showUpdateFieldError(response.field, response.message || 'Unable to update transaction.');
            if (request.status == 404) {
                viewTransactions(); // entry is gone -> refresh the list
            }
        }
    };

    request.onerror = function () {
        showUpdateFieldError(null, 'Could not reach the server.');
    };

    request.send(JSON.stringify(jsonData));
}