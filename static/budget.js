const budgetForm = document.getElementById("budget-form");
const columnIds = ["income-column", "expenses-column", "savings-column"];

const inputPlaceholders = {
    "income-column": "Income Source",
    "expenses-column": "Expense Category",
    "savings-column": "Savings Goal"
}

// setup the 3 input columns: income, expenses, savings goals
columnIds.forEach(columnId => {
    setupColumn(columnId);
});

// Handler for form submission
budgetForm.addEventListener("submit", function(event) {
    event.preventDefault();

    // Collect inputs from input columns
    const budgetData = {
      income: collectColumnData("income-column"),
      expenses: collectColumnData("expenses-column"),
      savings: collectColumnData("savings-column")
    };

    sendBudgetInfo(budgetData);
});

// function reused to set up each of the input columns
function setupColumn(columnId) {
    const column = document.getElementById(columnId);
    const entriesContainer = column.querySelector(".entries");
    const addEntryButton = column.querySelector(".add-entry-row");

    // Handler for "+" button to add new entry row
    addEntryButton.addEventListener("click", function() { addEntry(columnId) });

    // Handler for deleting entry rows
    entriesContainer.addEventListener("click", function(event) {
        if (event.target.classList.contains("delete-entry-row")) {
            columnId = this.parentElement.id
            event.target.parentElement.remove();
            calculateTotal(columnId);
        }
    });

    // Add first entry-row in column
    addEntry(columnId)
}

function collectColumnData(columnId) {
    const column = document.getElementById(columnId);
    const entries = column.querySelectorAll(".entry-row");
    const data = [];

    entries.forEach(entry => {
        const descriptor = entry.querySelector(".descriptor").value;
        const value = parseFloat(entry.querySelector(".value").value);
        data.push({ descriptor, value });
    });

    return data;
}


function addEntry(columnId) {
    const column = document.getElementById(columnId);
    const entriesContainer = column.querySelector(".entries");
    const newEntry = document.createElement("div");
    newEntry.classList.add("entry-row");
    newEntry.innerHTML = `
        <input type="text" class="descriptor" placeholder="${inputPlaceholders[columnId]}">
        <input type="number" class="value" placeholder="Amount Per Month">
        <button type="button" class="delete-entry-row"> &#x2715; </button>
    `;

    entriesContainer.appendChild(newEntry);


    const descriptorInput = newEntry.querySelector(".descriptor");
    const valueInput = newEntry.querySelector(".value");

    // Update column total when value of one of the entries is changed
    valueInput.addEventListener("change", function() {
        calculateTotal(columnId);
    });

    // Focus event listeners
    descriptorInput.addEventListener("focus", function() {
        this.style.minWidth = "200px"; // Increase width on focus
    });
    valueInput.addEventListener("focus", function() {
        this.style.minWidth = "200px"; // Increase width on focus
    });

    // Blur event listeners
    descriptorInput.addEventListener("blur", function() {
        this.style.minWidth = ""; // Restore original width on blur
    });
    valueInput.addEventListener("blur", function() {
        this.style.minWidth = ""; // Restore original width on blur
    });
};

function calculateTotal(columnId) {
    const column = document.getElementById(columnId);
    const entries = column.querySelectorAll(".entry-row");
    let total = 0;

    entries.forEach(entry => {
        const value = parseFloat(entry.querySelector(".value").value);
        if (!isNaN(value)) {
            total += value;
        }
    });

    column.querySelector(".total").textContent = `Total: $${total.toFixed(2)}`;
}

// Send budget info to generate_budget route
function sendBudgetInfo(budgetData) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const downloadButton = document.getElementById('download-pdf-button');
    loadingOverlay.style.display = 'flex'; // Show loading indicator

    // Call API route to generate budget
    fetch('/generate_budget', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(budgetData),
    })
    .then(response => response.json())
    .then(data => {
        displayBudget(data.response);
        loadingOverlay.style.display = 'none'; // Hide loading indicator
        downloadButton.style.display = 'block'; // Show download button
    })
    .catch((error) => {
        console.error('Error:', error);
        loadingOverlay.style.display = 'none'; // Hide loading indicator on error
        downloadButton.style.display = 'none'; // hide the download button, if it was somehow visible.
    });
}

// Add budget report to budget page
function displayBudget(budget_json) {
    budget = JSON.parse(budget_json)
    const budgetContainer = document.getElementById("budget-container");
    budgetContainer.innerHTML = '';

    // Create heading
    const heading = document.createElement("h3");
    heading.textContent = "Your Budget Report";

    const tableData = budget.Table;
    const comments = budget.Comments.replace(/\n/g, '<br>');

    // Create the table
    const table = document.createElement('table');

    // Create the header row (keys)
    const headerRow = table.insertRow();
    for (const key in tableData) {
        const headerCell = headerRow.insertCell();
        headerCell.style.backgroundColor = "lightgray";
        headerCell.textContent = key;
    }

    // Create the data row (values)
    const dataRow = table.insertRow();
    for (const key in tableData) {
        const dataCell = dataRow.insertCell();
        dataCell.textContent = tableData[key];
    }

    // Display the comments
    const commentsDiv = document.createElement('div');
    commentsDiv.innerHTML = comments;

    const detailedReport = budget.DetailedReportMarkdown

    // Append the table and comments to the page
    budgetContainer.appendChild(heading);
    budgetContainer.appendChild(table);
    budgetContainer.appendChild(commentsDiv);
}

const downloadButton = document.getElementById('download-pdf-button');
downloadButton.addEventListener('click', function() {
    downloadButton.disabled = true; // Disable the button
    fetch('/generate_budget_pdf', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(budget) // Send the entire LLM response
    })
    .then(response => response.blob()) // Get the response as a blob
    .then(blob => {
        // Remove any existing download links
        const existingLink = document.querySelector('#download-link');
        if (existingLink) {
            existingLink.remove();
        }

        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'budget_report.pdf';
        a.id = 'download-link'; // Assign an ID for removal
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url); // Clean up

        downloadButton.disabled = false; // re-enable button.
    })
    .catch(error => {
        console.error('Error:', error);
        downloadButton.disabled = false; // re-enable button.
    });
});
