function viewTransactions() {
    var request = new XMLHttpRequest();
    request.open('GET', '/view-transactions', true);
    request.setRequestHeader('Content-Type', 'application/json');

    request.onload = function () {
        var response = JSON.parse(request.responseText);
        allTransactions = response;

        var html = '';
        var total = 0;

        for (var i = 0; i < response.length; i++) {
            var t = response[i];
            var amount = Number(t.amount);
            var sign, typeClass;

            // Income adds to total, expense subtracts
            if (t.type == 'income') {
                total += amount;
                sign = '+';
                typeClass = 'income';
            } else {
                total -= amount;
                sign = '-';
                typeClass = 'expense';
            }

            html += '<div class="transaction-item">' +
                '<div>' +
                '<div class="amount ' + typeClass + '">' + sign + '$' + amount.toFixed(2) + '</div>' +
                '<div class="description">' + t.description + '</div>' +
                '</div>' +
                '<div class="item-buttons">' +
                '<button type="button" class="btn btn-update" onclick="updateTransaction(\'' + t.id + '\')">Update</button>' +
                '<button type="button" class="btn btn-delete" onclick="deleteTransaction(\'' + t.id + '\')">Delete</button>' +
                '</div>' +
                '</div>';
        }

        // Empty list message
        if (response.length == 0) {
            html = '<p class="description">No transactions yet.</p>';
        }

        document.getElementById('transactionList').innerHTML = html;

        // Show negative totals as -$5.00 instead of $-5.00
        var totalText = (total < 0 ? '-$' : '$') + Math.abs(total).toFixed(2);
        document.getElementById('totalAmount').innerHTML = totalText;
    };

    request.send();
}

// Right panel: show only one form at a time (shared)
function showOnlyForm(formId) {
    var forms = ['createForm', 'updateForm', 'deleteForm'];
    for (var i = 0; i < forms.length; i++) {
        var el = document.getElementById(forms[i]);
        if (el) {
            if (forms[i] == formId) {
                el.classList.remove('d-none');
            } else {
                el.classList.add('d-none');
            }
        }
    }
}

// Home page: green "+" bar on the right (shared)

// "+" bar clicked -> hide the bar, show the right-hand form panel
function showAddForm() {
    document.getElementById('addCol').classList.add('d-none');
    document.getElementById('formCol').classList.remove('d-none');
    showOnlyForm('createForm');
}

// Back to home page -> hide the form panel, show the "+" bar again
function hideAddForm() {
    document.getElementById('formCol').classList.add('d-none');
    document.getElementById('addCol').classList.remove('d-none');
}
