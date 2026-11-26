// =====================================================================
// Brendon - CREATE (Add amount / Spend amount)  -  FRONT END
//
// This file runs in the BROWSER. It handles everything the user sees and
// clicks in the "add transaction" form:
//   1. Remembering which button is selected (Add amount / Spend amount)
//   2. Checking what the user typed BEFORE sending it
//   3. Sending the data to the server (POST /add-transaction)
//   4. Showing error messages under the right box
//
// NOT in this file: opening/closing the panel (showAddForm / hideAddForm)
// and refreshing the history list (viewTransactions). Those are shared and
// live in view-transactions.js.
//
// The server (utils/BrendonUtil.js) checks the same rules again. The checks
// here are for a fast, friendly message; the server's checks are the real
// protection, because anyone can bypass the browser.
// =====================================================================


// ---------- SECTION 1: Settings and variables ----------

// Which toggle is selected right now.
// "income"  = Add amount (+)    "expense" = Spend amount (-)
var selectedType = 'income';

// The limits. Keep these the same as in BrendonUtil.js.
var MAX_AMOUNT = 10000.00;   // biggest amount for ONE transaction
var MAX_DESCRIPTION = 40;   // longest description (characters)


// ---------- SECTION 2: Toggle buttons (Add amount / Spend amount) ----------

// Called by the two toggle buttons in index.html: onclick="selectType('income')"
function selectType(type) {
    selectedType = type; // remember the choice, used when we submit
    showSuccess('');     // hide the old success message
    // Colour the chosen button (green for income, red for expense) and
    // un-colour the other. The colours come from styles.css.
    document.getElementById('btnIncome').classList.toggle('active-income', type == 'income');
    document.getElementById('btnExpense').classList.toggle('active-expense', type == 'expense');
}


// ---------- SECTION 3: Error message helpers ----------

// Show an error under ONE box. field is 'amount' or 'description'.
// It finds <p id="amountError"> or <p id="descriptionError"> in index.html.
function showFieldError(field, text) {
    document.getElementById(field + 'Error').innerHTML = text;
}

// Show the green success message (pass '' to hide it).
function showSuccess(text) {
    document.getElementById('addSuccess').innerHTML = text;
}

// Remove both error messages.
function clearErrors() {
    showFieldError('amount', '');
    showFieldError('description', '');
}

// Put the form back to how it looks when first opened.
function resetAddForm() {
    selectType('income'); // default is "Add amount"
    document.getElementById('amountInput').value = '';
    document.getElementById('descriptionInput').value = '';
    clearErrors();
    showSuccess('');
}

// Back button: clear the form, then close the panel (hideAddForm is shared)
function closeAddForm() {
    resetAddForm();
    hideAddForm();
}


// ---------- SECTION 4: Submit (the green + button) ----------

// Called by the green button: onclick="addTransaction()"
function addTransaction() {
    // Read what the user typed. trim() removes spaces at the start and end.
    var amountText = document.getElementById('amountInput').value.trim();
    var description = document.getElementById('descriptionInput').value.trim();
    var hasError = false;

    clearErrors();   // wipe old messages first
    showSuccess('');

    // --- Step A: check the form in the browser ---
    // We check BOTH boxes (not stop at the first problem) so the user sees
    // every mistake at once.

    // Amount must look like 5 or 4.90 (max 2 decimals) and be more than 0
    if (!/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) {
        showFieldError('amount', 'Please enter a valid amount, e.g. 5 or 4.90');
        hasError = true;
    } else if (Number(amountText) > MAX_AMOUNT) {
        showFieldError('amount', 'Amount can be at most $10,000.00.');
        hasError = true;
    }

    // Description must not be empty and must not be too long
    if (description == '') {
        showFieldError('description', 'Please enter a short description.');
        hasError = true;
    } else if (description.length > MAX_DESCRIPTION) {
        showFieldError('description', 'Description must be ' + MAX_DESCRIPTION + ' characters or fewer.');
        hasError = true;
    }

    if (hasError) {
        return; // stop here, nothing is sent to the server
    }

    // --- Step B: package the data to send ---
    // This becomes JSON like {"amount":"5","type":"income","description":"Lunch"}
    var jsonData = {
        amount: amountText,
        type: selectedType,
        description: description
    };

    // --- Step C: send it to the server ---
    var request = new XMLHttpRequest();
    request.open('POST', '/add-transaction', true); // matches app.post('/add-transaction') in index.js
    request.setRequestHeader('Content-Type', 'application/json');

    // Runs when the server has replied
    request.onload = function () {
        var response = JSON.parse(request.responseText);

        if (request.status == 201) {
            // 201 = "created" = success
            // Keep the panel open, empty the boxes and show a green message
            var addedType = selectedType; // remember before the reset
            resetAddForm();
            selectType(addedType);        // stay on the same toggle
            showSuccess(addedType == 'income' ? 'Successfully added amount!' : 'Successfully added spending!');
            viewTransactions(); // shared (view-transactions.js): refresh history + total
        } else if (response.field == 'amount') {
            // The server rejected the amount (e.g. total would pass $100,000)
            showFieldError('amount', response.message);
        } else {
            // Any other problem goes under the description box
            showFieldError('description', response.message || 'Unable to add transaction.');
        }
    };

    // Runs if the server could not be reached at all (e.g. server is off)
    request.onerror = function () {
        showFieldError('description', 'Could not reach the server.');
    };

    request.send(JSON.stringify(jsonData)); // actually send it
}


// ---------- SECTION 5: Set up the input boxes (runs once, when the page loads) ----------
window.addEventListener('load', function () {
    var amountInput = document.getElementById('amountInput');
    var descriptionInput = document.getElementById('descriptionInput');

    // A number box still lets you type the letter "e" and + / - (for example
    // "1e5"). Block those keys so only digits and the decimal point work.
    amountInput.addEventListener('keydown', function (event) {
        if (['e', 'E', '+', '-'].indexOf(event.key) != -1) {
            event.preventDefault();
        }
    });

    // When the user starts typing again, hide that box's old error message.
    // Also hide the green success message once they start a new entry.
    amountInput.addEventListener('input', function () {
        showFieldError('amount', '');
        showSuccess('');
    });
    descriptionInput.addEventListener('input', function () {
        showFieldError('description', '');
        showSuccess('');
    });
});
