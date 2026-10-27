
"use strict";

// =====================================================
// MAINTENA - FRONTEND JAVASCRIPT
// Express + MongoDB + Bootstrap
// =====================================================

const API = "";

let assets = [];
let faults = [];
let workOrders = [];
let editingAssetId = null;

// =====================================================
// GENERAL HELPERS
// =====================================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}

function showMessage(elementId, message, type = "danger") {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = message;
    element.className = `alert alert-${type}`;
    element.classList.remove("d-none");
}

function clearMessage(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = "";
    element.classList.add("d-none");
}

function formatDate(value) {
    if (!value) return "Not scheduled";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not scheduled";
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function badge(text, color = "secondary") {
    return `<span class="badge text-bg-${color}">${escapeHTML(text || "Unknown")}</span>`;
}

function conditionClass(condition) {
    const classes = {
        "Operational": "success",
        "Needs Attention": "warning",
        "Under Repair": "danger"
    };

    return classes[condition] || "secondary";
}

function severityClass(severity) {
    const classes = {
        "Low": "success",
        "Medium": "info",
        "High": "warning",
        "Critical": "danger"
    };

    return classes[severity] || "secondary";
}

function statusClass(status) {
    const classes = {
        "Resolved": "success",
        "Completed": "success",
        "In Progress": "info",
        "Open": "warning",
        "Pending": "warning"
    };

    return classes[status] || "secondary";
}

function priorityClass(priority) {
    return severityClass(priority);
}

async function apiRequest(url, options = {}) {
    const response = await fetch(API + url, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {}),
            ...(options.headers || {})
        }
    });

    if (response.status === 401 || response.status === 403) {
        window.location.href = "/";
        throw new Error("Your session has expired. Please log in again.");
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error("Unexpected server response. Please try again.");
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "The request failed.");
    }

    return result;
}

function hideModal(modalId) {
    const element = document.getElementById(modalId);

    if (element && window.bootstrap) {
        const modal = bootstrap.Modal.getInstance(element);

        if (modal) modal.hide();
    }
}

function resetForm(formId, messageId) {
    const form = document.getElementById(formId);

    if (form) form.reset();

    clearMessage(messageId);
}

// =====================================================
// CREATE THE EDIT ASSET MODAL
// =====================================================

function createEditAssetModal() {
    // Avoid creating the modal more than once.
    if (document.getElementById("editAssetModal")) return;

    const modalHTML = `
        <div
            class="modal fade"
            id="editAssetModal"
            tabindex="-1"
            aria-labelledby="editAssetModalTitle"
            aria-hidden="true">

            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">

                    <div class="modal-header text-white"
                         style="background: linear-gradient(135deg, #0d9488, #4f46e5);">

                        <div>
                            <h5 class="modal-title fw-bold"
                                id="editAssetModalTitle">
                                Edit Asset
                            </h5>

                            <small class="opacity-75">
                                Update equipment information
                            </small>
                        </div>

                        <button
                            type="button"
                            class="btn-close btn-close-white"
                            data-bs-dismiss="modal"
                            aria-label="Close">
                        </button>
                    </div>

                    <form id="editAssetForm">
                        <div class="modal-body p-4">

                            <div
                                id="editAssetFormMessage"
                                class="alert alert-danger d-none"
                                role="alert">
                            </div>

                            <div class="mb-3">
                                <label for="editAssetCode"
                                       class="form-label fw-semibold">
                                    Asset Code
                                </label>

                                <input
                                    type="text"
                                    class="form-control"
                                    id="editAssetCode"
                                    maxlength="40"
                                    required>
                            </div>

                            <div class="mb-3">
                                <label for="editAssetName"
                                       class="form-label fw-semibold">
                                    Asset Name
                                </label>

                                <input
                                    type="text"
                                    class="form-control"
                                    id="editAssetName"
                                    maxlength="100"
                                    required>
                            </div>

                            <div class="mb-3">
                                <label for="editAssetCategory"
                                       class="form-label fw-semibold">
                                    Category
                                </label>

                                <input
                                    type="text"
                                    class="form-control"
                                    id="editAssetCategory"
                                    maxlength="80"
                                    required>
                            </div>

                            <div class="mb-3">
                                <label for="editAssetLocation"
                                       class="form-label fw-semibold">
                                    Location
                                </label>

                                <input
                                    type="text"
                                    class="form-control"
                                    id="editAssetLocation"
                                    maxlength="100"
                                    required>
                            </div>

                            <div class="mb-2">
                                <label for="editAssetCondition"
                                       class="form-label fw-semibold">
                                    Condition
                                </label>

                                <select
                                    class="form-select"
                                    id="editAssetCondition"
                                    required>

                                    <option value="Operational">
                                        Operational
                                    </option>

                                    <option value="Needs Attention">
                                        Needs Attention
                                    </option>

                                    <option value="Under Repair">
                                        Under Repair
                                    </option>
                                </select>
                            </div>

                        </div>

                        <div class="modal-footer px-4 pb-4 border-0">
                            <button
                                type="button"
                                class="btn btn-light border"
                                data-bs-dismiss="modal">
                                Cancel
                            </button>

                            <button
                                type="submit"
                                class="btn btn-primary px-4"
                                id="saveEditedAssetBtn"
                                style="background: linear-gradient(135deg, #0d9488, #4f46e5); border: 0;">

                                <span id="editAssetButtonText">
                                    Save Changes
                                </span>

                                <span
                                    id="editAssetSpinner"
                                    class="spinner-border spinner-border-sm ms-2 d-none"
                                    aria-hidden="true">
                                </span>
                            </button>
                        </div>
                    </form>

                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const form = document.getElementById("editAssetForm");

    form.addEventListener("submit", saveEditedAsset);
}

// =====================================================
// USER AND LOGOUT
// =====================================================

async function loadCurrentUser() {
    try {
        const result = await apiRequest("/api/auth/me");
        const user = result.user || {};

        const element = document.getElementById("currentUserName");

        if (element) {
            element.textContent =
                user.name || user.fullName || user.email || "User";
        }
    } catch (error) {
        console.error("Unable to load current user:", error.message);
    }
}

async function logout() {
    const button = document.getElementById("logoutBtn");

    try {
        if (button) button.disabled = true;

        await apiRequest("/api/auth/logout", {
            method: "POST"
        });

        window.location.href = "/";
    } catch (error) {
        if (button) button.disabled = false;

        alert(error.message);
    }
}

// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {
    try {
        const data = await apiRequest("/api/dashboard");

        const values = {
            totalAssets: data.totalAssets,
            openFaults: data.openFaults,
            underRepair: data.underRepair,
            pendingOrders: data.pendingOrders
        };

        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);

            if (element) {
                element.textContent = value ?? 0;
            }
        });
    } catch (error) {
        console.error("Dashboard error:", error.message);
    }
}

// =====================================================
// ASSET REGISTRY
// =====================================================

async function loadAssets() {
    try {
        const result = await apiRequest("/api/assets");

        assets = Array.isArray(result)
            ? result
            : result.assets || [];

        renderAssets();
        populateAssetDropdowns();
    } catch (error) {
        console.error("Asset loading error:", error.message);

        const table = document.getElementById("assetTable");

        if (table) {
            const body = table.querySelector("tbody") || table;

            body.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        Unable to load assets.
                    </td>
                </tr>
            `;
        }
    }
}

function renderAssets() {
    const table = document.getElementById("assetTable");
    if (!table) return;

    const body = table.querySelector("tbody") || table;

    const searchInput = document.getElementById("assetSearch");
    const searchTerm = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const filteredAssets = assets.filter((asset) => {
        const searchable = [
            asset.asset_code,
            asset.name,
            asset.category,
            asset.location,
            asset.condition_status
        ].join(" ").toLowerCase();

        return searchable.includes(searchTerm);
    });

    const countElement = document.getElementById("assetCount");

    if (countElement) {
        countElement.textContent = `${filteredAssets.length} records`;
    }

    if (filteredAssets.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    No matching assets found.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = filteredAssets.map((asset) => {
        const id = asset.id || asset._id;
        const condition = asset.condition_status || "Unknown";

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(asset.name || "Unnamed asset")}</strong>
                    <br>
                    <small class="text-muted">
                        ${escapeHTML(asset.asset_code || "No code")}
                    </small>
                </td>

                <td>${escapeHTML(asset.category || "Uncategorized")}</td>

                <td>${escapeHTML(asset.location || "Not specified")}</td>

                <td>
                    ${badge(condition, conditionClass(condition))}

                    <div class="mt-2 d-flex gap-2 flex-wrap">
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            data-action="edit-asset"
                            data-id="${escapeHTML(id)}">
                            <i class="bi bi-pencil-square"></i>
                            Edit
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            data-action="delete-asset"
                            data-id="${escapeHTML(id)}">
                            <i class="bi bi-trash"></i>
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function setupAssetSearch() {
    const searchInput = document.getElementById("assetSearch");

    if (searchInput) {
        searchInput.addEventListener("input", renderAssets);
    }
}

async function addAsset(event) {
    event.preventDefault();
    clearMessage("assetFormMessage");

    const asset_code = document.getElementById("assetCode")?.value.trim();
    const name = document.getElementById("assetName")?.value.trim();
    const category = document.getElementById("assetCategory")?.value.trim();
    const location = document.getElementById("assetLocation")?.value.trim();
    const condition_status =
        document.getElementById("assetCondition")?.value || "Operational";

    if (!asset_code || !name || !category || !location) {
        showMessage("assetFormMessage", "Please complete all asset fields.");
        return;
    }

    try {
        await apiRequest("/api/assets", {
            method: "POST",
            body: JSON.stringify({
                asset_code,
                name,
                category,
                location,
                condition_status
            })
        });

        hideModal("assetModal");
        resetForm("assetForm", "assetFormMessage");

        await refreshDashboard();

        alert("Asset added successfully.");
    } catch (error) {
        showMessage("assetFormMessage", error.message);
    }
}

// Open the Bootstrap edit modal and fill it with asset data.
function editAsset(id) {
    const asset = assets.find(
        (item) => String(item.id || item._id) === String(id)
    );

    if (!asset) {
        alert("Asset not found. Please refresh the page.");
        return;
    }

    editingAssetId = id;

    document.getElementById("editAssetCode").value =
        asset.asset_code || "";

    document.getElementById("editAssetName").value =
        asset.name || "";

    document.getElementById("editAssetCategory").value =
        asset.category || "";

    document.getElementById("editAssetLocation").value =
        asset.location || "";

    document.getElementById("editAssetCondition").value =
        asset.condition_status || "Operational";

    clearMessage("editAssetFormMessage");

    const saveButton = document.getElementById("saveEditedAssetBtn");
    const buttonText = document.getElementById("editAssetButtonText");
    const spinner = document.getElementById("editAssetSpinner");

    saveButton.disabled = false;
    buttonText.textContent = "Save Changes";
    spinner.classList.add("d-none");

    const modalElement = document.getElementById("editAssetModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.show();
}

// Save changes from the Bootstrap edit modal.
async function saveEditedAsset(event) {
    event.preventDefault();

    clearMessage("editAssetFormMessage");

    if (!editingAssetId) {
        showMessage(
            "editAssetFormMessage",
            "No asset selected for editing."
        );
        return;
    }

    const asset_code = document.getElementById("editAssetCode").value.trim();
    const name = document.getElementById("editAssetName").value.trim();
    const category = document.getElementById("editAssetCategory").value.trim();
    const location = document.getElementById("editAssetLocation").value.trim();
    const condition_status =
        document.getElementById("editAssetCondition").value;

    if (!asset_code || !name || !category || !location) {
        showMessage(
            "editAssetFormMessage",
            "Please complete all fields before saving."
        );
        return;
    }

    const allowedConditions = [
        "Operational",
        "Needs Attention",
        "Under Repair"
    ];

    if (!allowedConditions.includes(condition_status)) {
        showMessage(
            "editAssetFormMessage",
            "Please select a valid asset condition."
        );
        return;
    }

    const saveButton = document.getElementById("saveEditedAssetBtn");
    const buttonText = document.getElementById("editAssetButtonText");
    const spinner = document.getElementById("editAssetSpinner");

    saveButton.disabled = true;
    buttonText.textContent = "Saving...";
    spinner.classList.remove("d-none");

    try {
        await apiRequest(
            `/api/assets/${encodeURIComponent(editingAssetId)}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    asset_code,
                    name,
                    category,
                    location,
                    condition_status
                })
            }
        );

        hideModal("editAssetModal");
        editingAssetId = null;

        await refreshDashboard();

        alert("Asset updated successfully.");
    } catch (error) {
        showMessage("editAssetFormMessage", error.message);
    } finally {
        saveButton.disabled = false;
        buttonText.textContent = "Save Changes";
        spinner.classList.add("d-none");
    }
}

async function deleteAsset(id) {
    const asset = assets.find(
        (item) => String(item.id || item._id) === String(id)
    );

    if (!asset) {
        alert("Asset not found. Please refresh the page.");
        return;
    }

    const confirmed = confirm(
        `Delete "${asset.name}"?\n\n` +
        "An asset linked to fault reports or work orders cannot be deleted."
    );

    if (!confirmed) return;

    try {
        const result = await apiRequest(
            `/api/assets/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        await refreshDashboard();

        alert(result.message || "Asset deleted successfully.");
    } catch (error) {
        alert(error.message);
    }
}

function populateAssetDropdowns() {
    ["faultAsset", "orderAsset"].forEach((elementId) => {
        const select = document.getElementById(elementId);
        if (!select) return;

        const previousValue = select.value;

        select.innerHTML = `
            <option value="">Select an asset</option>
            ${assets.map((asset) => `
                <option value="${escapeHTML(asset.id || asset._id)}">
                    ${escapeHTML(asset.asset_code || "No code")} -
                    ${escapeHTML(asset.name || "Unnamed asset")}
                </option>
            `).join("")}
        `;

        if (
            previousValue &&
            [...select.options].some(
                (option) => option.value === previousValue
            )
        ) {
            select.value = previousValue;
        }
    });
}

// =====================================================
// FAULT REPORTS
// =====================================================

async function loadFaults() {
    try {
        const result = await apiRequest("/api/faults");

        faults = Array.isArray(result)
            ? result
            : result.faults || [];

        renderFaults();
    } catch (error) {
        console.error("Fault loading error:", error.message);

        const table = document.getElementById("faultTable");

        if (table) {
            const body = table.querySelector("tbody") || table;
            body.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        Unable to load fault reports.
                    </td>
                </tr>
            `;
        }
    }
}

function renderFaults() {
    const table = document.getElementById("faultTable");
    if (!table) return;

    const body = table.querySelector("tbody") || table;

    if (faults.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    No fault reports found.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = faults.map((fault) => {
        const id = fault.id || fault._id;
        const status = fault.status || "Open";
        const severity = fault.severity || "Unknown";

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(fault.asset_name || "Unknown asset")}</strong>
                    <br>
                    <small class="text-muted">
                        ${escapeHTML(fault.asset_code || "")}
                    </small>
                </td>

                <td>
                    ${escapeHTML(fault.description || "No description")}
                    <br>
                    <small class="text-muted">
                        ${escapeHTML(formatDate(fault.reported_at))}
                    </small>
                </td>

                <td>${badge(severity, severityClass(severity))}</td>

                <td>${badge(status, statusClass(status))}</td>

                <td>
                    <select
                        class="form-select form-select-sm"
                        data-action="fault-status"
                        data-id="${escapeHTML(id)}"
                        aria-label="Update fault status">

                        ${["Open", "In Progress", "Resolved"].map((option) => `
                            <option
                                value="${option}"
                                ${option === status ? "selected" : ""}>
                                ${option}
                            </option>
                        `).join("")}
                    </select>
                </td>
            </tr>
        `;
    }).join("");
}

async function addFault(event) {
    event.preventDefault();
    clearMessage("faultFormMessage");

    const asset_id = document.getElementById("faultAsset")?.value;
    const description =
        document.getElementById("faultDescription")?.value.trim();
    const severity = document.getElementById("faultSeverity")?.value;

    if (!asset_id || !description || !severity) {
        showMessage(
            "faultFormMessage",
            "Please complete all fault-report fields."
        );
        return;
    }

    try {
        await apiRequest("/api/faults", {
            method: "POST",
            body: JSON.stringify({
                asset_id,
                description,
                severity
            })
        });

        hideModal("faultModal");
        resetForm("faultForm", "faultFormMessage");

        await refreshDashboard();

        alert("Fault reported successfully.");
    } catch (error) {
        showMessage("faultFormMessage", error.message);
    }
}

async function updateFaultStatus(id, status) {
    try {
        await apiRequest(
            `/api/faults/${encodeURIComponent(id)}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({ status })
            }
        );

        await refreshDashboard();
    } catch (error) {
        alert(error.message);
        await loadFaults();
    }
}

// =====================================================
// WORK ORDERS
// =====================================================

async function loadWorkOrders() {
    try {
        const result = await apiRequest("/api/work-orders");

        workOrders = Array.isArray(result)
            ? result
            : result.workOrders || [];

        renderWorkOrders();
    } catch (error) {
        console.error("Work-order loading error:", error.message);

        const table = document.getElementById("workOrderTable");

        if (table) {
            const body = table.querySelector("tbody") || table;
            body.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        Unable to load work orders.
                    </td>
                </tr>
            `;
        }
    }
}

function renderWorkOrders() {
    const table = document.getElementById("workOrderTable");
    if (!table) return;

    const body = table.querySelector("tbody") || table;

    if (workOrders.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    No work orders found.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = workOrders.map((order) => {
        const id = order.id || order._id;
        const status = order.status || "Pending";
        const priority = order.priority || "Medium";

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(order.asset_name || "Unknown asset")}</strong>
                    <br>
                    <small class="text-muted">
                        ${escapeHTML(order.asset_code || "")}
                    </small>
                </td>

                <td>${escapeHTML(order.title || "Untitled task")}</td>

                <td>${badge(priority, priorityClass(priority))}</td>

                <td>${escapeHTML(formatDate(order.scheduled_date))}</td>

                <td>${badge(status, statusClass(status))}</td>

                <td>
                    <select
                        class="form-select form-select-sm"
                        data-action="work-order-status"
                        data-id="${escapeHTML(id)}"
                        aria-label="Update work order status">

                        ${["Pending", "In Progress", "Completed"].map((option) => `
                            <option
                                value="${option}"
                                ${option === status ? "selected" : ""}>
                                ${option}
                            </option>
                        `).join("")}
                    </select>
                </td>
            </tr>
        `;
    }).join("");
}

async function addWorkOrder(event) {
    event.preventDefault();
    clearMessage("orderFormMessage");

    const asset_id = document.getElementById("orderAsset")?.value;
    const title = document.getElementById("orderTitle")?.value.trim();
    const priority = document.getElementById("orderPriority")?.value;
    const scheduled_date = document.getElementById("orderDate")?.value || null;

    if (!asset_id || !title || !priority) {
        showMessage(
            "orderFormMessage",
            "Please complete all work-order fields."
        );
        return;
    }

    try {
        await apiRequest("/api/work-orders", {
            method: "POST",
            body: JSON.stringify({
                asset_id,
                title,
                priority,
                scheduled_date
            })
        });

        hideModal("workOrderModal");
        resetForm("workOrderForm", "orderFormMessage");

        await refreshDashboard();

        alert("Work order created successfully.");
    } catch (error) {
        showMessage("orderFormMessage", error.message);
    }
}

async function updateWorkOrderStatus(id, status) {
    try {
        await apiRequest(
            `/api/work-orders/${encodeURIComponent(id)}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({ status })
            }
        );

        await refreshDashboard();
    } catch (error) {
        alert(error.message);
        await loadWorkOrders();
    }
}

// =====================================================
// REFRESH ALL DATA
// =====================================================

async function refreshDashboard() {
    await Promise.all([
        loadDashboard(),
        loadAssets(),
        loadFaults(),
        loadWorkOrders()
    ]);
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
    const logoutButton = document.getElementById("logoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    const assetForm = document.getElementById("assetForm");

    if (assetForm) {
        assetForm.addEventListener("submit", addAsset);
    }

    const faultForm = document.getElementById("faultForm");

    if (faultForm) {
        faultForm.addEventListener("submit", addFault);
    }

    const workOrderForm = document.getElementById("workOrderForm");

    if (workOrderForm) {
        workOrderForm.addEventListener("submit", addWorkOrder);
    }

    setupAssetSearch();

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const id = button.dataset.id;
        if (!id) return;

        if (button.dataset.action === "edit-asset") {
            editAsset(id);
        }

        if (button.dataset.action === "delete-asset") {
            deleteAsset(id);
        }
    });

    document.addEventListener("change", (event) => {
        const element = event.target;

        if (element.matches('[data-action="fault-status"]')) {
            updateFaultStatus(element.dataset.id, element.value);
        }

        if (element.matches('[data-action="work-order-status"]')) {
            updateWorkOrderStatus(element.dataset.id, element.value);
        }
    });

    const modalForms = {
        assetModal: ["assetForm", "assetFormMessage"],
        faultModal: ["faultForm", "faultFormMessage"],
        workOrderModal: ["workOrderForm", "orderFormMessage"]
    };

    Object.entries(modalForms).forEach(([modalId, values]) => {
        const modal = document.getElementById(modalId);

        if (!modal) return;

        modal.addEventListener("show.bs.modal", () => {
            const [formId, messageId] = values;

            clearMessage(messageId);

            const form = document.getElementById(formId);
            if (form) form.reset();

            populateAssetDropdowns();
        });
    });
}

// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
    createEditAssetModal();
    setupEventListeners();

    await loadCurrentUser();
    await refreshDashboard();
});
