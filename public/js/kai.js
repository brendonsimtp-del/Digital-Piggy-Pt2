// Kai - DELETE (Delete button on a row -> confirm in the right panel)
// viewTransactions() lives in view-transactions.js

// id of the transaction waiting to be deleted
var transactionToDelete = null;

// Show an error under the delete form
function showDeleteError(text) {
    document.getElementById('deleteError').innerHTML = text;
}

// An id must be a positive whole number, e.g. "3" (same rule as the server)
function isValidId(id) {
    var text = String(id).trim();
    return /^\d+$/.test(text) && Number(text) >= 1;
}

// Look for a transaction in the list the page already loaded
function findTransaction(id) {
    var list = window.allTransactions || [];
    for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) {
            return list[i];
        }
    }
    return null;
}

// Called by the red "Delete" button on each row (see view-transactions.js)
function deleteTransaction(id) {
    var transaction = findTransaction(id);
    if (transaction == null) {
        viewTransactions(); // list is out of date -> refresh it
        return;
    }

    transactionToDelete = id;

    // Fill in the details (read only): type, amount, description
    var isIncome = transaction.type == 'income';
    document.getElementById('deleteBtnIncome').classList.toggle('active-income', isIncome);
    document.getElementById('deleteBtnExpense').classList.toggle('active-expense', !isIncome);
    document.getElementById('deleteAmount').textContent = Number(transaction.amount).toFixed(2);
    document.getElementById('deleteDescription').value = transaction.description;
    showDeleteError('');

    // Right column: swap the Add form for the Delete view
    document.getElementById('addCol').classList.add('d-none');
    document.getElementById('formCol').classList.remove('d-none');
    showOnlyForm('deleteForm');
}

// Back arrow -> back to the Add form, nothing is deleted
function hideDeleteForm() {
    transactionToDelete = null;
    showDeleteError('');
    document.getElementById('deleteForm').classList.add('d-none');

    var createForm = document.getElementById('createForm');
    if (createForm) {
        createForm.classList.remove('d-none'); // Add form shows again
    } else {
        // Add form not merged yet -> just go back to the home page
        document.getElementById('formCol').classList.add('d-none');
        document.getElementById('addCol').classList.remove('d-none');
    }
}

// Red bin button -> delete from the JSON file, then refresh list + balance
function confirmDelete() {
    // ---- Check before sending anything to the server ----
    if (transactionToDelete == null || String(transactionToDelete).trim() == '') {
        showDeleteError('Please select a transaction to delete.');
        return;
    }
    if (!isValidId(transactionToDelete)) {
        showDeleteError('Invalid transaction id.');
        return;
    }
    if (findTransaction(transactionToDelete) == null) {
        showDeleteError('This transaction no longer exists.');
        viewTransactions(); // refresh the out of date list
        return;
    }

    var deleteButton = document.querySelector('.btn-confirm-delete');
    deleteButton.disabled = true; // stop double clicks

    var request = new XMLHttpRequest();
    request.open('DELETE', '/delete-transaction/' + encodeURIComponent(transactionToDelete), true);

    request.onload = function () {
        deleteButton.disabled = false;

        // Don't crash if the response isn't JSON
        var response = {};
        try {
            response = JSON.parse(request.responseText);
        } catch (e) { }

        if (request.status == 200) {
            hideDeleteForm();
            viewTransactions(); // shared - refresh history + total
        } else {
            if (request.status == 404) {
                viewTransactions(); // already gone -> refresh the list
            }
            // 400 / 404 / 500 messages from the server show here
            showDeleteError(response.message || 'Unable to delete transaction.');
        }
    };

    request.onerror = function () {
        deleteButton.disabled = false;
        showDeleteError('Could not reach the server.');
    };

    request.send();
}