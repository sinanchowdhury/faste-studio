/* =========================================================
   FASTE STUDIO - BUSINESS MANAGEMENT SYSTEM
   app.js
   ========================================================= */

/* =========================================================
   SUPABASE BACKEND
   ========================================================= */

const SUPABASE_URL = "https://zetfirhngnmtzkytcpoi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JsEu4aPm2NQzXpz6dOlIQw_32AwUn-w";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

function currentUserId() { return currentUser?.id || null; }

/* =========================================================
   GLOBAL DATA
   ========================================================= */

let productsList = [];
let productionHistory = [];
let productHouseStock = [];
let saleHistory = [];
let storeList = [];
let generalLedger = [];
let withdrawalHistory = [];

let currentUser = null;
let authProfile = null;

let isSignupMode = false;
let appLoading = false;


/* =========================================================
   SMALL HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function safeValue(id, fallback = "") {
    const el = $(id);
    return el ? el.value : fallback;
}

function safeText(id, value) {
    const el = $(id);
    if (el) {
        el.textContent = value ?? "";
    }
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function money(value) {
    return num(value).toFixed(2);
}

function todayDate() {
    return new Date().toISOString().split("T")[0];
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showError(message) {
    console.error(message);
    alert(message);
}

function setButtonLoading(button, loading, normalText = "Save") {
    if (!button) return;

    button.disabled = loading;

    if (loading) {
        button.dataset.oldText = button.textContent;
        button.textContent = "Saving...";
    } else {
        button.textContent =
            button.dataset.oldText || normalText;
    }
}

function closeModalSafe(id) {
    const modal = $(id);
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "";
    }
}


/* =========================================================
   AUTH UI
   ========================================================= */

function showAuthModal() {
    const modal = $("auth-modal");

    if (!modal) return;

    // Keep the auth overlay directly under <body> so no parent layout can
    // affect position:fixed. This prevents the email/password fields from
    // appearing at the top of the dashboard.
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    modal.classList.add("active");
    modal.style.display = "flex";
    document.body.classList.add("auth-open");
}

function closeAuthModal() {
    const modal = $("auth-modal");

    if (!modal) return;

    modal.classList.remove("active");
    modal.style.display = "none";
    document.body.classList.remove("auth-open");
}

function setAuthMessage(message, type = "") {
    const el = $("auth-message");

    if (!el) return;

    el.textContent = message;
    el.className = "auth-message";

    if (type) {
        el.classList.add(type);
    }
}

function setAuthMode(mode = "login") {

    isSignupMode = mode === "signup";

    const nameGroup = $("auth-name-group");
    const nameInput = $("auth-name");
    const subtitle = $("auth-subtitle");
    const submitButton = $("auth-submit-button");
    const switchButton = $("auth-switch-button");
    const pending = $("auth-pending");
    const form = $("auth-form");

    if (pending) {
        pending.style.display = "none";
    }

    if (form) {
        form.style.display = "block";
    }

    if (nameGroup) {
        nameGroup.style.display =
            isSignupMode ? "block" : "none";
    }

    if (nameInput) {
        nameInput.required = isSignupMode;
    }

    if (subtitle) {
        subtitle.textContent = isSignupMode
            ? "Create your FASTE STUDIO account"
            : "Login to your FASTE STUDIO account";
    }

    if (submitButton) {
        submitButton.textContent =
            isSignupMode ? "Create Account" : "Login";
    }

    if (switchButton) {
        switchButton.textContent =
            isSignupMode
                ? "Already have an account? Login"
                : "Create new account";
    }

    setAuthMessage("");
}

function showPendingMessage() {

    const form = $("auth-form");
    const pending = $("auth-pending");

    if (form) {
        form.style.display = "none";
    }

    if (pending) {
        pending.style.display = "block";
    }
}


/* =========================================================
   GET PROFILE
   ========================================================= */

async function getMyProfile(userId) {
    const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data || null;
}

/* =========================================================
   AUTH LOGIN / SIGNUP
   ========================================================= */

async function handleLoginSubmit(event) {
    if (event) event.preventDefault();
    const email = safeValue("auth-email").trim();
    const password = safeValue("auth-password");
    const fullName = safeValue("auth-name").trim();
    const button = $("auth-submit-button");
    if (!email || !password) return setAuthMessage("Email and password are required.", "error");
    if (isSignupMode && !fullName) return setAuthMessage("Please enter your full name.", "error");
    setButtonLoading(button, true, isSignupMode ? "Create Account" : "Login");
    try {
        if (isSignupMode) {
            const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
            if (error) throw error;
            if (!data.user) throw new Error("Could not create account.");
            const { error: profileError } = await supabaseClient.from("profiles").upsert({
                id: data.user.id, email: email.toLowerCase(), full_name: fullName, role: "seller", approved: false
            });
            if (profileError) throw profileError;
            await supabaseClient.auth.signOut();
            setAuthMessage("Account created successfully. Please wait for admin approval.", "success");
            setTimeout(()=>setAuthMode("login"),1000); return;
        }
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser=data.user; await handleAuthSuccess(data.user);
    } catch(error) { console.error(error); setAuthMessage(error.message || "Authentication failed.", "error"); }
    finally { setButtonLoading(button,false,isSignupMode?"Create Account":"Login"); }
}

/* =========================================================
   AUTH SUCCESS
   ========================================================= */

async function handleAuthSuccess(user) {
    if (!user) return false;
    currentUser=user; const profile=await getMyProfile(user.id);
    if (!profile) { currentUser=null; authProfile=null; setAuthMessage("Your profile was not found.","error"); return false; }
    authProfile=profile;
    if (profile.approved !== true) { showPendingMessage(); await supabaseClient.auth.signOut(); currentUser=null; authProfile=profile; return false; }
    updateUserDisplay(); closeAuthModal(); await loadInitialData(); showPage("dashboard"); return true;
}

/* =========================================================
   USER DISPLAY
   ========================================================= */

function updateUserDisplay() {

    const nameEl = $("user-display-name");
    const roleEl = $("user-role-badge");

    if (!authProfile) return;

    if (nameEl) {
        nameEl.textContent =
            authProfile.full_name ||
            authProfile.email ||
            "User";
    }

    if (roleEl) {
        roleEl.textContent =
            authProfile.role || "user";
    }
}


/* =========================================================
   ADMIN USER MANAGEMENT
   ========================================================= */

function addAdminUsersButton() {

    const role =
        String(authProfile?.role || "").toLowerCase();

    // Keep the manual role-income button visible on the Balance page.
    const amountButton = $("add-role-amount-button");
    if (amountButton) amountButton.style.display = "inline-flex";

    // User management remains restricted to admin accounts.
    if (role !== "admin") return;

    if ($("admin-users-button")) return;

    const container =
        document.getElementById("header-actions") ||
        document.querySelector(".topbar-actions") ||
        document.querySelector(".header-actions") ||
        document.querySelector("header");

    if (!container) return;

    const button =
        document.createElement("button");

    button.id = "admin-users-button";
    button.className = "secondary-button";
    button.textContent = "Users";
    button.onclick = openAdminUsers;

    container.appendChild(button);

}

function openAdminUsers() {

    if (
        String(authProfile?.role || "").toLowerCase()
        !== "admin"
    ) {
        return;
    }

    const modal = $("admin-users-modal");

    if (modal) {
        modal.classList.add("active");
        modal.style.display = "flex";
    }

    loadAdminUsers();
}

function closeAdminUsers() {

    const modal = $("admin-users-modal");

    if (!modal) return;

    modal.classList.remove("active");
    modal.style.display = "none";
}

async function loadAdminUsers() {

    const body =
        $("admin-users-body");

    if (!body) return;

    body.innerHTML =
        `<tr>
            <td colspan="6">Loading...</td>
        </tr>`;

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {

        body.innerHTML =
            `<tr>
                <td colspan="6">
                    ${escapeHtml(error.message)}
                </td>
            </tr>`;

        return;
    }

    if (!data || !data.length) {

        body.innerHTML =
            `<tr>
                <td colspan="6">
                    No users found.
                </td>
            </tr>`;

        return;
    }

    body.innerHTML = data.map(user => {

        const approved =
            user.approved === true;

        return `
            <tr>
                <td>${escapeHtml(user.full_name || "-")}</td>
                <td>${escapeHtml(user.email || "-")}</td>
                <td>${escapeHtml(user.role || "-")}</td>
                <td>
                    ${approved ? "Approved" : "Pending"}
                </td>
                <td>
                    <select
                        onchange="setUserApproval('${user.id}', this.value === 'true')"
                    >
                        <option
                            value="true"
                            ${approved ? "selected" : ""}
                        >
                            Approved
                        </option>

                        <option
                            value="false"
                            ${!approved ? "selected" : ""}
                        >
                            Pending
                        </option>
                    </select>
                </td>
                <td>
                    <button
                        onclick="setUserApproval('${user.id}', ${!approved})"
                    >
                        ${approved ? "Disable" : "Approve"}
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

async function setUserApproval(userId, approved) {

    if (
        String(authProfile?.role || "").toLowerCase()
        !== "admin"
    ) {
        alert("Only admin can manage users.");
        return;
    }

    if (!userId) return;

    const {
        error
    } = await supabaseClient
        .from("profiles")
        .update({
            approved: Boolean(approved)
        })
        .eq("id", userId);

    if (error) {

        alert(
            "Could not update user:\n" +
            error.message
        );

        return;
    }

    await loadAdminUsers();
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function handleLogout() {
    await supabaseClient.auth.signOut(); currentUser=null; authProfile=null;
    productsList=[]; productionHistory=[]; productHouseStock=[]; saleHistory=[]; storeList=[]; generalLedger=[]; withdrawalHistory=[];
    showAuthModal(); setAuthMode("login"); showPage("dashboard");
}

async function checkAuthOnLoad() {
    try {
        const { data } = await supabaseClient.auth.getSession();
        const user = data?.session?.user;
        if (!user) { showAuthModal(); setAuthMode("login"); return; }
        currentUser=user; if (!(await handleAuthSuccess(user))) showAuthModal();
    } catch(e) { console.error(e); showAuthModal(); setAuthMode("login"); }
}
function setupAuthListener() {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) { currentUser=null; authProfile=null; }
    });
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function showPage(pageId) {

    console.log("Opening page:", pageId);

    // Hide every page
    document.querySelectorAll(".page-content").forEach(page => {
        page.classList.remove("active");
        page.style.display = "none";
    });

    // Remove active navigation
    document.querySelectorAll("aside nav button").forEach(button => {
        button.classList.remove("active");
    });

    // Find target page
    const targetPage = document.getElementById("page-" + pageId);

    if (!targetPage) {
        console.error("Page not found:", "page-" + pageId);
        return;
    }

    // Show target page
    targetPage.classList.add("active");
    targetPage.style.display = "block";

    // Active sidebar button
    const targetNav = document.getElementById("nav-" + pageId);

    if (targetNav) {
        targetNav.classList.add("active");
    }

    // Page functions
    try {

        if (pageId === "dashboard") {
            updateDashboard();
        }

        if (pageId === "product-list") {
            renderProductList();
        }

        if (pageId === "production") {
            prepareProductionForm();
            renderProductionHistory();
        }

        if (pageId === "product-house") {
            renderProductHouse();
        }

        if (pageId === "sale") {
            prepareSaleForm();
            renderSaleHistory();
        }

        if (pageId === "balance") {
            renderLedger();
        }

        if (pageId === "stores") {
            renderStores();
        }

        if (pageId === "report") {
            generateStoreReport();
        }

    } catch (error) {
        console.error("Page function error:", error);
    }
}
/* =========================================================
   MODALS
   ========================================================= */

function openModal(id) {

    const modal = $(id);

    if (!modal) return;

    modal.classList.add("active");
    modal.style.display = "flex";
}

function closeModal(id) {

    const modal = $(id);

    if (!modal) return;

    modal.classList.remove("active");
    modal.style.display = "none";
}


/* =========================================================
   LOAD ALL DATA
   ========================================================= */

async function loadInitialData() {

    if (appLoading) return;

    appLoading = true;

    try {

        await Promise.all([
            fetchProductsFromSupabase(),
            fetchProductionFromSupabase(),
            fetchStockFromSupabase(),
            fetchSalesFromSupabase(),
            fetchStoresFromSupabase(),
            fetchLedgerFromSupabase(),
            fetchWithdrawalsFromSupabase()
        ]);

        renderProductList();
        renderProductionHistory();
        renderProdSummary();
        renderProductHouse();
        renderSaleHistory();
        renderSaleSummary();
        renderLedger();
        renderStores();
        updateDashboard();

        addAdminUsersButton();

    } catch (error) {

        console.error(
            "Data loading error:",
            error
        );

    } finally {

        appLoading = false;
    }
}


/* =========================================================
   PRODUCTS
   ========================================================= */

function calcPieceSize() {

    const fullSize =
        num(safeValue("p-full-size"));

    const pcsSet =
        num(safeValue("p-pcs-set"));

    const output =
        $("p-pc-size");

    if (!output) return;

    if (fullSize > 0 && pcsSet > 0) {
        output.value =
            (fullSize / pcsSet).toFixed(2);
    } else {
        output.value = "";
    }
}


async function fetchProductsFromSupabase() {

    const {
        data,
        error
    } = await supabaseClient
        .from("products")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    productsList = data || [];
}


async function saveProduct(event) {

    if (event) {
        event.preventDefault();
    }

    const form = $("product-form");

    const code =
        safeValue("p-code").trim();

    const type =
        safeValue("p-type").trim();

    const fullSize =
        num(safeValue("p-full-size"));

    const pcsSet =
        num(safeValue("p-pcs-set"));

    const pcSize =
        num(safeValue("p-pc-size"));

    if (!code || !type) {
        alert("Product code and type are required.");
        return;
    }

    if (fullSize <= 0 || pcsSet <= 0) {
        alert("Enter valid size and pieces per set.");
        return;
    }

    const button =
        form?.querySelector(
            'button[type="submit"]'
        );

    setButtonLoading(button, true);

    try {

        const {
            error
        } = await supabaseClient
            .from("products")
            .insert({
                user_id: currentUserId(),
                code: code,
                type: type,
                full_size: fullSize,
                pcs_set: pcsSet,
                pc_size: pcSize
            });

        if (error) {
            throw error;
        }

        await fetchProductsFromSupabase();

        renderProductList();

        if (form) {
            form.reset();
        }

        calcPieceSize();

        closeModalSafe("add-product-modal");

        alert("Product saved successfully.");

    } catch (error) {

        console.error(
            "Save product error:",
            error
        );

        alert(
            "Product save failed:\n" +
            error.message
        );

    } finally {

        setButtonLoading(
            button,
            false,
            "Save Product"
        );
    }
}


function renderProductList() {
    const body = $("product-list-body");
    if (!body) return;
    if (!productsList.length) {
        body.innerHTML = `<tr><td colspan="7" class="p-3">No products yet</td></tr>`;
        return;
    }
    const query = safeValue("search-product-input").trim().toLowerCase();
    const rows = productsList.filter(p =>
        `${p.code || ""} ${p.type || ""}`.toLowerCase().includes(query)
    );
    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="7" class="p-3">No matching products</td></tr>`;
        return;
    }
    body.innerHTML = rows.map((p, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(p.code || "-")}</td>
            <td>${escapeHtml(p.type || "-")}</td>
            <td>${escapeHtml(p.full_size ?? "-")}</td>
            <td>${num(p.pcs_set)}</td>
            <td>${escapeHtml(p.pc_size ?? "-")}</td>
            <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}</td>
        </tr>
    `).join("");
}


/* =========================================================
   PRODUCTION
   ========================================================= */

async function fetchProductionFromSupabase() {

    const {
        data,
        error
    } = await supabaseClient
        .from("productions")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    productionHistory = data || [];
}


function prepareProductionForm() {

    const container =
        $("prod-items-container");

    if (!container) return;

    if (!container.children.length) {
        addProdItemRow();
    }

    const dateInput =
        $("prod-date");

    if (
        dateInput &&
        !dateInput.value
    ) {
        dateInput.value = todayDate();
    }

    calcProdCosts();
}


function addProdItemRow() {

    const container =
        $("prod-items-container");

    if (!container) return;

    const row =
        document.createElement("div");

    row.className =
        "production-item-row";

    row.innerHTML = `
        <select class="prod-product-select">
            <option value="">Select product</option>

            ${productsList.map(p => `
                <option value="${p.id}">
                    ${escapeHtml(p.code)}
                    - ${escapeHtml(p.type)}
                </option>
            `).join("")}
        </select>

        <input
            type="number"
            class="prod-sets"
            min="1"
            value="1"
            placeholder="Sets"
            oninput="calcProdCosts()"
        >

        <button
            type="button"
            onclick="this.closest('.production-item-row').remove(); calcProdCosts();"
        >
            ×
        </button>
    `;

    container.appendChild(row);

    calcProdCosts();
}


function calcProdCosts() {

    const costs = [
        "cost-sticker",
        "cost-board",
        "cost-poly",
        "cost-tape",
        "cost-transport",
        "cost-fixed",
        "cost-ads",
        "cost-cutting",
        "cost-packing"
    ];

    let totalCost = 0;

    costs.forEach(id => {
        totalCost += num(
            safeValue(id)
        );
    });

    let totalSets = 0;

    document
        .querySelectorAll(".prod-sets")
        .forEach(input => {
            totalSets += num(input.value);
        });

    const totalPcs =
        document.querySelectorAll(
            ".production-item-row"
        ).length
            ? Array.from(
                document.querySelectorAll(
                    ".production-item-row"
                )
            ).reduce((sum, row) => {

                const select =
                    row.querySelector(
                        ".prod-product-select"
                    );

                const sets =
                    num(
                        row.querySelector(
                            ".prod-sets"
                        )?.value
                    );

                const product =
                    productsList.find(
                        p =>
                            String(p.id) ===
                            String(select?.value)
                    );

                return sum +
                    sets *
                    num(product?.pcs_set);

            }, 0)
            : 0;

    const costPerSet =
        totalSets > 0
            ? totalCost / totalSets
            : 0;

    safeText(
        "prod-total-sets-lbl",
        totalSets
    );

    safeText(
        "prod-total-pcs",
        totalPcs
    );

    safeText(
        "prod-total-cost",
        money(totalCost)
    );

    safeText(
        "prod-cost-per-set",
        money(costPerSet)
    );

    const costPerSetInput =
        $("prod-cost-per-set");

    if (
        costPerSetInput &&
        "value" in costPerSetInput
    ) {
        costPerSetInput.value =
            costPerSet.toFixed(2);
    }

    return {
        totalCost,
        totalSets,
        totalPcs,
        costPerSet
    };
}


async function saveProduction(event) {

    if (event) {
        event.preventDefault();
    }

    const form =
        $("production-form");

    const printCode =
        safeValue(
            "prod-print-code"
        ).trim();

    if (!printCode) {
        alert("Print code is required.");
        return;
    }

    const rows =
        Array.from(
            document.querySelectorAll(
                ".production-item-row"
            )
        );

    if (!rows.length) {
        alert("Add at least one product.");
        return;
    }

    const items = [];

    for (const row of rows) {

        const productId =
            row.querySelector(
                ".prod-product-select"
            )?.value;

        const sets =
            num(
                row.querySelector(
                    ".prod-sets"
                )?.value
            );

        if (!productId || sets <= 0) {
            alert(
                "Please select product and valid sets."
            );
            return;
        }

        const product =
            productsList.find(
                p =>
                    String(p.id) ===
                    String(productId)
            );

        if (!product) {
            alert("Product not found.");
            return;
        }

        items.push({
            productId,
            sets,
            product
        });
    }

    const calculation =
        calcProdCosts();

    const {
        totalCost,
        totalSets,
        totalPcs,
        costPerSet
    } = calculation;

    const button =
        form?.querySelector(
            'button[type="submit"]'
        );

    setButtonLoading(
        button,
        true
    );

    try {

        /* FIRST: production record */

        const {
            data: production,
            error: productionError
        } = await supabaseClient
            
.from("productions")
.insert({
    batch_code: printCode,
    print_code: printCode,
    code: printCode,

    items: items.map(item => ({
        productId: item.productId,
        sets: item.sets,
        product: item.product
    })),

    costs: {
        sticker: num(safeValue("cost-sticker")),
        board: num(safeValue("cost-board")),
        poly: num(safeValue("cost-poly")),
        tape: num(safeValue("cost-tape")),
        transport: num(safeValue("cost-transport")),
        fixed: num(safeValue("cost-fixed")),
        ads: num(safeValue("cost-ads")),
        cutting: num(safeValue("cost-cutting")),
        packing: num(safeValue("cost-packing"))
    },

    total_sets: totalSets,
    total_pcs: totalPcs,
    total_cost: totalCost,
    avg_cost_per_set: costPerSet,
    cost_per_set: costPerSet,

    date: safeValue("prod-date", todayDate())
})

            .select()
            .single();

        if (productionError) {
            throw productionError;
        }

        /* SECOND: stock rows */

        const stockRows =
            items.map(item => ({
                print_code: printCode,
                product_id: item.productId,
                type: item.product.type,
                sets: item.sets,
                pcs:
                    item.sets *
                    num(item.product.pcs_set),
                cost_per_set: costPerSet,
                production_id: production.id,
                date:
                    safeValue(
                        "prod-date",
                        todayDate()
                    )
            }));

        const {
            error: stockError
        } = await supabaseClient
            .from("stock")
            .insert(stockRows);

        if (stockError) {

            /* rollback production */

            await supabaseClient
                .from("productions")
                .delete()
                .eq("id", production.id);

            throw stockError;
        }

        await Promise.all([
            fetchProductionFromSupabase(),
            fetchStockFromSupabase()
        ]);

        renderProductionHistory();
        renderProdSummary();
        renderProductHouse();
        updateDashboard();

        if (form) {
            form.reset();
        }

        const container =
            $("prod-items-container");

        if (container) {
            container.innerHTML = "";
        }

        prepareProductionForm();

        alert(
            "Production saved successfully."
        );

    } catch (error) {

        console.error(
            "Production save error:",
            error
        );

        alert(
            "Production save failed:\n" +
            error.message
        );

    } finally {

        setButtonLoading(
            button,
            false,
            "Save Production"
        );
    }
}


function renderProductionRows(rows) {
    const body = $("production-history-body");
    if (!body) return;
    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="18" class="p-3">No production history</td></tr>`;
        return;
    }
    const costKeys = ["sticker","board","poly","tape","transport","fixed","ads","cutting","packing"];
    body.innerHTML = rows.map((p,index) => {
        const c = p.costs || {};
        const madeSets = Array.isArray(p.items)
            ? p.items.map(item => {
                const code = item.product?.code || item.product_code || item.code || "-";
                return `${escapeHtml(code)}: ${num(item.sets)} set`;
            }).join("<br>")
            : "-";
        return `<tr>
            <td class="p-3">${index+1}</td>
            <td class="p-3">${escapeHtml(p.date || "-")}</td>
            <td class="p-3">${escapeHtml(p.print_code || p.batch_code || p.code || "-")}</td>
            <td class="p-3">${madeSets}</td>
            <td class="p-3">${num(p.total_sets)}</td>
            <td class="p-3">${num(p.total_pcs)}</td>
            ${costKeys.map(k=>`<td class="p-3">৳${money(c[k])}</td>`).join("")}
            <td class="p-3 font-bold">৳${money(p.total_cost)}</td>
            <td class="p-3">৳${money(p.cost_per_set)}</td>
            <td class="p-3"><button type="button" class="btn btn-primary" onclick="openProductionEdit(${p.id})">Edit</button></td>
        </tr>`;
    }).join("");
}

function renderProductionHistory() {
    renderProductionRows(productionHistory);
}

function openProductionEdit(id) {
    const p = productionHistory.find(x => String(x.id) === String(id));
    if (!p) return;
    $("edit-production-id").value = p.id;
    $("edit-prod-date").value = p.date || todayDate();
    $("edit-prod-code").value = p.print_code || p.batch_code || p.code || "";
    const items = Array.isArray(p.items) ? p.items : [];
    $("edit-prod-items").innerHTML = items.map((item, i) => {
        const productId = item.productId || item.product_id || item.product?.id || "";
        const code = item.product?.code || item.product_code || item.code || "-";
        return `<div class="grid grid-cols-2 gap-3 items-center border rounded-lg p-3">
            <div><div class="font-semibold">${escapeHtml(code)}</div><input type="hidden" class="edit-prod-product-id" value="${escapeHtml(productId)}"></div>
            <input type="number" min="0" class="form-input edit-prod-sets" value="${num(item.sets)}" placeholder="Sets">
        </div>`;
    }).join("");
    const keys=["sticker","board","poly","tape","transport","fixed","ads","cutting","packing"];
    keys.forEach(k => { const el=$("edit-cost-"+k); if(el) el.value=num(p.costs?.[k]); });
    openModal("edit-production-modal");
}

async function saveProductionEdit(event) {
    if (event) event.preventDefault();
    const id = safeValue("edit-production-id");
    const p = productionHistory.find(x => String(x.id) === String(id));
    if (!p) return;
    const rows = Array.from(document.querySelectorAll("#edit-prod-items > div"));
    const items = rows.map(row => ({
        productId: row.querySelector(".edit-prod-product-id")?.value,
        sets: num(row.querySelector(".edit-prod-sets")?.value)
    })).filter(x => x.productId);
    if (!items.length || items.some(x => x.sets < 0)) { alert("Enter valid production quantities."); return; }
    const oldItems = Array.isArray(p.items) ? p.items : [];
    const oldProduced = {};
    oldItems.forEach(i => { const pid=i.productId||i.product_id||i.product?.id; if(pid) oldProduced[pid]=(oldProduced[pid]||0)+num(i.sets); });
    const sold = {};
    productHouseStock.filter(s => String(s.production_id) === String(p.id)).forEach(s => {
        const pid=s.product_id; if(pid) sold[pid] = Math.max(0, (oldProduced[pid]||0) - num(s.sets) - (sold[pid]||0));
    });
    // If a production stock row was completely sold/deleted, oldProduced represents the sold quantity.
    Object.keys(oldProduced).forEach(pid => {
        if (!(pid in sold)) sold[pid] = oldProduced[pid];
    });
    const newMap = Object.fromEntries(items.map(i => [i.productId, i.sets]));
    for (const pid of Object.keys(sold)) {
        if (num(newMap[pid]) < num(sold[pid])) {
            alert("Cannot reduce a product below the quantity already sold.");
            return;
        }
    }
    const costs = {};
    ["sticker","board","poly","tape","transport","fixed","ads","cutting","packing"].forEach(k => costs[k]=num(safeValue("edit-cost-"+k)));
    const totalCost=Object.values(costs).reduce((a,b)=>a+b,0);
    const totalSets=items.reduce((a,i)=>a+num(i.sets),0);
    const totalPcs=items.reduce((a,i)=>{const pr=productsList.find(p=>String(p.id)===String(i.productId)); return a+num(i.sets)*num(pr?.pcs_set);},0);
    const costPerSet=totalSets ? totalCost/totalSets : 0;
    try {
        const productionItems=items.map(i=>{const pr=productsList.find(p=>String(p.id)===String(i.productId)); return {productId:i.productId,sets:i.sets,product:pr||null};});
        const {error:updateError}=await supabaseClient.from("productions").update({batch_code:safeValue("edit-prod-code"),print_code:safeValue("edit-prod-code"),code:safeValue("edit-prod-code"),items:productionItems,costs,total_sets:totalSets,total_pcs:Math.round(totalPcs),total_cost:totalCost,avg_cost_per_set:costPerSet,cost_per_set:costPerSet,date:safeValue("edit-prod-date")}).eq("id",p.id);
        if(updateError) throw updateError;
        const oldRows=productHouseStock.filter(s=>String(s.production_id)===String(p.id));
        const allPids=new Set([...Object.keys(oldProduced),...items.map(i=>String(i.productId))]);
        for(const pid of allPids){
            const pr=productsList.find(x=>String(x.id)===String(pid));
            const desired=Math.max(0,num(newMap[pid])-num(sold[pid]));
            const matching=oldRows.filter(s=>String(s.product_id)===String(pid));
            const pcs=Math.round(desired*num(pr?.pcs_set));
            if(desired<=0){ for(const r of matching) await supabaseClient.from("stock").delete().eq("id",r.id); }
            else if(matching.length){
                const first=matching[0];
                const {error:e}=await supabaseClient.from("stock").update({print_code:safeValue("edit-prod-code"),type:pr?.type||first.type,sets:desired,pcs,cost_per_set:costPerSet,date:safeValue("edit-prod-date")}).eq("id",first.id); if(e) throw e;
                for(const r of matching.slice(1)) await supabaseClient.from("stock").delete().eq("id",r.id);
            } else {
                const {error:e}=await supabaseClient.from("stock").insert({print_code:safeValue("edit-prod-code"),product_id:pid,type:pr?.type||"",sets:desired,pcs,cost_per_set:costPerSet,production_id:p.id,date:safeValue("edit-prod-date")}); if(e) throw e;
            }
        }
        await Promise.all([fetchProductionFromSupabase(),fetchStockFromSupabase()]);
        renderProductionHistory(); renderProdSummary(); renderProductHouse(); updateDashboard();
        closeModalSafe("edit-production-modal");
        alert("Production updated successfully.");
    } catch(e){ console.error(e); alert("Production edit failed:\n"+e.message); }
}

function renderProdSummary() {
    const filter=safeValue("prod-summary-filter","all"); const now=new Date();
    const rows=productionHistory.filter(p=>{
        if(filter==='all') return true; const d=new Date(p.date||p.created_at); if(Number.isNaN(d.getTime())) return false;
        if(filter==='today') return d.toISOString().slice(0,10)===todayDate();
        if(filter==='month') return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
        if(filter==='year') return d.getFullYear()===now.getFullYear(); return true;
    });
    const totalPcs=rows.reduce((s,p)=>s+num(p.total_pcs),0), totalSets=rows.reduce((s,p)=>s+num(p.total_sets),0);
    const keys=["sticker","board","poly","tape","transport","fixed","ads","cutting","packing"];
    const totals=Object.fromEntries(keys.map(k=>[k,rows.reduce((s,p)=>s+num(p.costs?.[k]),0)]));
    const totalCost=rows.reduce((s,p)=>s+num(p.total_cost),0);
    safeText("prod-summary-total-pcs",totalPcs); safeText("prod-summary-total-sets",totalSets);
    const box=$("all-time-cost-breakdown"); if(!box) return;
    box.innerHTML=`<div class="flex flex-wrap justify-between items-center gap-3 mb-4"><h3 class="font-bold text-lg">Cost Summary — ${filter==='all'?'All Time':filter}</h3><div class="text-xl font-bold">Total: ৳${money(totalCost)}</div></div><div class="grid grid-cols-2 md:grid-cols-5 gap-3">${keys.map(k=>`<div class="rounded-xl border p-3 bg-slate-50"><div class="text-xs text-slate-500 uppercase">${k}</div><div class="font-bold text-lg">৳${money(totals[k])}</div></div>`).join("")}</div>`;
}

function filterProductionHistory() {
    const query = safeValue("search-prod-input").trim().toLowerCase();
    const body = $("production-history-body");
    if (!body) return;
    const filtered = productionHistory.filter(p => String(p.print_code || p.batch_code || "").toLowerCase().includes(query));
    if (!filtered.length) {
        body.innerHTML = `<tr><td colspan="17" class="p-3">No matching production</td></tr>`;
        return;
    }
    const costKeys = ["sticker","board","poly","tape","transport","fixed","ads","cutting","packing"];
    body.innerHTML = filtered.map((p,index) => {
        const c=p.costs||{};
        const madeSets = Array.isArray(p.items) ? p.items.map(item => { const code = item.product?.code || item.product?.print_code || item.code || item.print_code || "-"; return `${escapeHtml(code)}: ${num(item.sets)} set`; }).join("<br>") : "-";
        return `<tr><td class="p-3">${index+1}</td><td class="p-3">${escapeHtml(p.date||"-")}</td><td class="p-3">${escapeHtml(p.print_code||p.batch_code||"-")}</td><td class="p-3">${madeSets}</td><td class="p-3">${num(p.total_sets)}</td><td class="p-3">${num(p.total_pcs)}</td>${costKeys.map(k=>`<td class="p-3">৳${money(c[k])}</td>`).join("")}<td class="p-3 font-bold">৳${money(p.total_cost)}</td><td class="p-3">৳${money(p.cost_per_set)}</td></tr>`;
    }).join("");
}


/* =========================================================
   STOCK / PRODUCT HOUSE
   ========================================================= */

async function fetchStockFromSupabase() {

    const {
        data,
        error
    } = await supabaseClient
        .from("stock")
        .select("*")
        .order("id", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    productHouseStock = data || [];
}


function renderProductHouse() {
    const body=$("product-house-body"); if(!body) return;
    const totalPcs=productHouseStock.reduce((sum,s)=>sum+num(s.pcs),0);
    const totalSets=productHouseStock.reduce((sum,s)=>sum+num(s.sets),0);
    safeText("house-total-pcs",totalPcs); safeText("house-total-sets",totalSets);
    if(!productHouseStock.length){body.innerHTML=`<tr><td colspan="7" class="p-3">No stock available</td></tr>`; return;}
    renderProductHouseRows(productHouseStock);
    renderHouseTypeBreakdown();
}

function renderProductHouseRows(rows){
    const body=$("product-house-body"); if(!body)return;
    if(!rows.length){body.innerHTML=`<tr><td colspan="7" class="p-3">No matching stock</td></tr>`;return;}
    body.innerHTML=rows.map(s=>{
        const pr=productsList.find(p=>String(p.id)===String(s.product_id));
        const code=pr?.code||s.code||s.print_code||"-";
        const type=pr?.type||s.type||"-";
        return `<tr>
            <td>${escapeHtml(code)}</td><td>${escapeHtml(type)}</td><td>${num(s.sets)}</td><td>${num(s.pcs)}</td><td>${money(s.cost_per_set)}</td><td>${s.date||"-"}</td>
            <td><button type="button" class="btn btn-primary mr-1" onclick="openProductHouseEdit(${s.id})">Edit</button><button type="button" class="btn btn-danger" onclick="openModal('destroy-modal'); setDestroyStockById(${s.id})">Destroy</button></td>
        </tr>`;
    }).join("");
}

function filterProductHouse(){
    const query=safeValue("search-house-input").trim().toLowerCase();
    renderProductHouseRows(productHouseStock.filter(s=>`${s.print_code||""} ${s.type||""} ${productsList.find(p=>String(p.id)===String(s.product_id))?.code||""} ${productsList.find(p=>String(p.id)===String(s.product_id))?.type||""}`.toLowerCase().includes(query)));
}

function openProductHouseEdit(id){
    const s=productHouseStock.find(x=>String(x.id)===String(id)); if(!s)return;
    const pr=productsList.find(p=>String(p.id)===String(s.product_id));
    $("edit-house-id").value=s.id;
    $("edit-house-code").value=pr?.code||s.print_code||"";
    $("edit-house-type").value=pr?.type||s.type||"";
    $("edit-house-sets").value=num(s.sets);
    $("edit-house-pcs").value=num(s.pcs);
    $("edit-house-cost").value=num(s.cost_per_set);
    openModal("edit-product-house-modal");
}

async function saveProductHouseEdit(event){
    if(event)event.preventDefault();
    const id=safeValue("edit-house-id"); const s=productHouseStock.find(x=>String(x.id)===String(id)); if(!s)return;
    const sets=num(safeValue("edit-house-sets")); const pcs=num(safeValue("edit-house-pcs")); const cost=num(safeValue("edit-house-cost"));
    if(sets<0||pcs<0){alert("Enter valid quantity.");return;}
    try{
        const {error}=await supabaseClient.from("stock").update({sets,pcs,cost_per_set:cost}).eq("id",s.id); if(error)throw error;
        await fetchStockFromSupabase(); renderProductHouse(); updateDashboard(); closeModalSafe("edit-product-house-modal"); alert("Product House updated successfully.");
    }catch(e){console.error(e);alert("Product House edit failed\n"+e.message);}
}

function setDestroyStock(index) {

    const stock =
        productHouseStock[index];

    if (!stock) return;

    const codeInput =
        $("destroy-print-code");

    if (codeInput) {
        codeInput.value =
            stock.print_code || "";
        codeInput.dataset.stockId =
            stock.id;
    }

    const setsInput =
        $("destroy-sets");

    if (setsInput) {
        setsInput.max =
            num(stock.sets);
        setsInput.value = "";
    }
}


function setDestroyStockById(id) {

    const stock =
        productHouseStock.find(
            s =>
                String(s.id) ===
                String(id)
        );

    if (!stock) return;

    const codeInput =
        $("destroy-print-code");

    if (codeInput) {
        codeInput.value =
            stock.print_code || "";
        codeInput.dataset.stockId =
            stock.id;
    }

    const setsInput =
        $("destroy-sets");

    if (setsInput) {
        setsInput.max =
            num(stock.sets);
        setsInput.value = "";
    }
}


async function saveDestroy(event) {

    if (event) {
        event.preventDefault();
    }

    const codeInput =
        $("destroy-print-code");

    const stockId =
        codeInput?.dataset.stockId;

    const destroySets =
        num(
            safeValue("destroy-sets")
        );

    const reason =
        safeValue("destroy-reason")
            .trim();

    if (!stockId) {
        alert("Select stock first.");
        return;
    }

    if (destroySets <= 0) {
        alert("Enter valid destroy quantity.");
        return;
    }

    const stock =
        productHouseStock.find(
            s =>
                String(s.id) ===
                String(stockId)
        );

    if (!stock) {
        alert("Stock not found.");
        return;
    }

    if (destroySets > num(stock.sets)) {
        alert("Destroy quantity is greater than stock.");
        return;
    }

    try {

        const remainingSets =
            num(stock.sets) -
            destroySets;

        const pcsPerSet =
            num(stock.pcs) /
            Math.max(num(stock.sets), 1);

        const remainingPcs =
            Math.round(
                remainingSets *
                pcsPerSet
            );

        let error = null;

        if (remainingSets <= 0) {

            const response =
                await supabaseClient
                    .from("stock")
                    .delete()
                    .eq("id", stock.id);

            error = response.error;

        } else {

            const response =
                await supabaseClient
                    .from("stock")
                    .update({
                        sets: remainingSets,
                        pcs: remainingPcs
                    })
                    .eq("id", stock.id);

            error = response.error;
        }

        if (error) {
            throw error;
        }

        await fetchStockFromSupabase();

        renderProductHouse();
        updateDashboard();

        closeModalSafe("destroy-modal");

        const form =
            $("destroy-form");

        if (form) {
            form.reset();
        }

        alert(
            `Stock destroyed successfully.\nReason: ${reason || "Not specified"}`
        );

    } catch (error) {

        console.error(
            "Destroy stock error:",
            error
        );

        alert(
            "Could not destroy stock:\n" +
            error.message
        );
    }
}


/* =========================================================
   SALES
   ========================================================= */

async function fetchSalesFromSupabase() {

    const {
        data,
        error
    } = await supabaseClient
        .from("sales")
        .select("*")
        .order("id", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    saleHistory = data || [];
}


function prepareSaleForm() {

    const container =
        $("sale-items-container");

    if (!container) return;

    if (!container.children.length) {
        addSaleItemRow();
    }

    const date =
        $("sale-date");

    if (date && !date.value) {
        date.value = todayDate();
    }

    calcSaleProfit();
}


/* =========================================================
   IMPORTANT:
   Sale stock options now store REAL stock ID.
   This fixes the old filtered-array index bug.
   ========================================================= */

function addSaleItemRow() {

    const container = $("sale-items-container");
    if (!container) return;

    const availableStock = productHouseStock.filter(s => num(s.sets) > 0);
    const row = document.createElement("div");
    row.className = "sale-item-row";

    row.innerHTML = `
        <select class="sale-stock-select" onchange="calcSaleProfit()">
            <option value="">Select stock</option>
            ${availableStock.map(stock => `
                <option value="${stock.id}">
                    ${escapeHtml((productsList.find(p => String(p.id) === String(stock.product_id))?.code) || stock.print_code || "-")}
                    - ${escapeHtml((productsList.find(p => String(p.id) === String(stock.product_id))?.type) || stock.type || "-")}
                    - ${num(stock.sets)} sets
                </option>
            `).join("")}
        </select>

        <input type="number" class="sale-sets" min="1" value="1" placeholder="Sets" oninput="calcSaleProfit()">

        <input type="number" class="sale-price-per-set" min="0" step="0.01" value="0" placeholder="Sell price / set" oninput="calcSaleProfit()">

        <button type="button" onclick="this.closest('.sale-item-row').remove(); calcSaleProfit();">×</button>
    `;

    container.appendChild(row);
    calcSaleProfit();
}

function calcSaleProfit() {

    let totalSets = 0;
    let totalCost = 0;
    let totalSale = 0;
    let sellerProfit = 0;
    let managerProfit = 0;
    let totalPcs = 0;

    const sellerPerSet = num($("sale-seller-per-set")?.value);
    const managerPerSet = num($("sale-manager-per-set")?.value);

    document.querySelectorAll(".sale-item-row").forEach(row => {
        const stockId = row.querySelector(".sale-stock-select")?.value;
        const sets = num(row.querySelector(".sale-sets")?.value);
        const salePrice = num(row.querySelector(".sale-price-per-set")?.value);
        const stock = productHouseStock.find(s => String(s.id) === String(stockId));

        totalSets += sets;
        totalSale += sets * salePrice;
        sellerProfit += sets * sellerPerSet;
        managerProfit += sets * managerPerSet;

        if (stock) {
            totalCost += sets * num(stock.cost_per_set);
            totalPcs += sets * (num(stock.pcs) / Math.max(num(stock.sets), 1));
        }
    });

    const grossProfit = totalSale - totalCost - sellerProfit - managerProfit;
    const investorProfit = Math.max(0, grossProfit * 0.10);
    const adminProfit = Math.max(0, grossProfit * 0.90);

    safeText("sale-lbl-total-sets", totalSets);
    safeText("sale-lbl-total-pcs", Math.round(totalPcs));
    safeText("sale-lbl-cost", money(totalCost));
    safeText("sale-lbl-total-sale", money(totalSale));
    safeText("sale-lbl-gross-profit", money(grossProfit));
    safeText("sale-lbl-seller-profit", money(sellerProfit));
    safeText("sale-lbl-manager-profit", money(managerProfit));
    safeText("sale-lbl-investor-profit", money(investorProfit));
    safeText("sale-lbl-admin-profit", money(adminProfit));

    return { totalSets, totalPcs: Math.round(totalPcs), totalCost, totalSale, grossProfit, sellerProfit, managerProfit, investorProfit, adminProfit };
}

async function saveSale(event) {

    if (event) {
        event.preventDefault();
    }

    const form =
        $("sale-form");

    const rows =
        Array.from(
            document.querySelectorAll(
                ".sale-item-row"
            )
        );

    if (!rows.length) {
        alert("Add at least one sale item.");
        return;
    }

    const items = [];

    for (const row of rows) {

        const stockId =
            row.querySelector(
                ".sale-stock-select"
            )?.value;

        const sets =
            num(
                row.querySelector(
                    ".sale-sets"
                )?.value
            );

        const salePrice = num(row.querySelector(".sale-price-per-set")?.value);
        const sellerPerSet = num($("sale-seller-per-set")?.value);
        const managerPerSet = num($("sale-manager-per-set")?.value);

        if (!stockId || sets <= 0) {
            alert(
                "Please select stock and valid sets."
            );
            return;
        }

        const stock =
            productHouseStock.find(
                s =>
                    String(s.id) ===
                    String(stockId)
            );

        if (!stock) {
            alert("Selected stock not found.");
            return;
        }

        if (sets > num(stock.sets)) {
            alert(
                `Not enough stock for ${stock.print_code}.`
            );
            return;
        }

        items.push({
            stock,
            stockId,
            sets,
            salePrice,
            sellerPerSet,
            managerPerSet
        });
    }


    /* Check duplicate stock selection */

    const stockCounts = {};

    items.forEach(item => {

        if (!stockCounts[item.stockId]) {
            stockCounts[item.stockId] = 0;
        }

        stockCounts[item.stockId] +=
            item.sets;
    });

    for (const stockId in stockCounts) {

        const stock =
            productHouseStock.find(
                s =>
                    String(s.id) ===
                    String(stockId)
            );

        if (
            stock &&
            stockCounts[stockId] >
            num(stock.sets)
        ) {
            alert(
                `Total sale quantity exceeds stock for ${stock.print_code}.`
            );
            return;
        }
    }


    const calculation =
        calcSaleProfit();

    const {
        totalSets,
        totalCost,
        totalSale,
        grossProfit,
        sellerProfit,
        managerProfit,
        investorProfit,
        adminProfit
    } = calculation;


    const sellerRate = items.reduce((sum, item) => sum + item.sellerPerSet * item.sets, 0);
    const managerRate = items.reduce((sum, item) => sum + item.managerPerSet * item.sets, 0);

    const storeId =
        safeValue("sale-store-id");

    const sellerName =
        safeValue(
            "sale-seller-name"
        ).trim();

    const saleDate =
        safeValue(
            "sale-date",
            todayDate()
        );

    const button =
        form?.querySelector(
            'button[type="submit"]'
        );

    setButtonLoading(
        button,
        true
    );


    try {

        /* FIRST: sale record */

        const {
            data: sale,
            error: saleError
        } = await supabaseClient
            .from("sales")
            .insert({
                user_id: currentUserId(),
                store_id:
                    storeId || null,

                seller_rate:
                    sellerRate,

                manager_rate:
                    managerRate,

                total_sets:
                    totalSets,
                total_pcs:
                    items.reduce((sum, item) => sum + item.sets * (num(item.stock.pcs) / Math.max(num(item.stock.sets), 1)), 0),
                items: items.map(item => ({
                    stock_id: item.stockId,
                    product_id: item.stock.product_id,
                    product_code: (productsList.find(p => String(p.id) === String(item.stock.product_id))?.code) || item.stock.print_code || "-",
                    type: (productsList.find(p => String(p.id) === String(item.stock.product_id))?.type) || item.stock.type || "-",
                    sets: item.sets,
                    pcs_per_set: num(item.stock.pcs) / Math.max(num(item.stock.sets), 1),
                    cost_per_set: num(item.stock.cost_per_set),
                    production_id: item.stock.production_id || null,
                    store_id: storeId || null,
                    sale_price_per_set: item.salePrice,
                    seller_per_set: item.sellerPerSet,
                    manager_per_set: item.managerPerSet
                })),

                total_cost:
                    totalCost,

                total_sale:
                    totalSale,

                gross_profit:
                    grossProfit,

                seller_profit:
                    sellerProfit,

                manager_profit:
                    managerProfit,

                investor_profit:
                    investorProfit,

                admin_profit:
                    adminProfit,

                date:
                    saleDate,

                seller_name:
                    sellerName
            })
            .select()
            .single();

        if (saleError) {
            throw saleError;
        }


        /* SECOND: update each stock row */

        const updatedStockRows = [];

        for (const item of items) {

            const stock =
                productHouseStock.find(
                    s =>
                        String(s.id) ===
                        String(item.stockId)
                );

            if (!stock) {
                throw new Error(
                    "Stock disappeared during sale."
                );
            }

            const remainingSets =
                num(stock.sets) -
                item.sets;

            const pcsPerSet =
                num(stock.pcs) /
                Math.max(
                    num(stock.sets),
                    1
                );

            const remainingPcs =
                Math.round(
                    remainingSets *
                    pcsPerSet
                );

            updatedStockRows.push({
                id: stock.id,
                sets: remainingSets,
                pcs: remainingPcs
            });
        }


        /* Update stock */

        for (
            const update
            of updatedStockRows
        ) {

            let response;

            if (update.sets <= 0) {

                response =
                    await supabaseClient
                        .from("stock")
                        .delete()
                        .eq(
                            "id",
                            update.id
                        );

            } else {

                response =
                    await supabaseClient
                        .from("stock")
                        .update({
                            sets: update.sets,
                            pcs: update.pcs
                        })
                        .eq(
                            "id",
                            update.id
                        );
            }

            if (response.error) {

                /*
                    Sale already exists here.
                    We cannot safely rollback
                    arbitrary stock changes automatically.
                */

                throw new Error(
                    "Sale saved, but stock update failed: " +
                    response.error.message
                );
            }
        }


        /* Add exactly one Balance entry for revenue and one for each role. */
        const saleCode = items.map(item =>
            (productsList.find(p => String(p.id) === String(item.stock.product_id))?.code) || item.stock.print_code || "-"
        ).filter(Boolean).join(", ");

        const saleLedgerRows = [
            { title: `Sale Revenue${saleCode ? ` - ${saleCode}` : ""}`, amount: totalSale, note: `auto_sale_revenue:${sale.id}` },
            { title: "Seller Income", amount: sellerProfit, note: `auto_sale_role:seller:${sale.id}` },
            { title: "Manager Income", amount: managerProfit, note: `auto_sale_role:manager:${sale.id}` },
            { title: "Investor Income", amount: investorProfit, note: `auto_sale_role:investor:${sale.id}` },
            { title: "Admin Income", amount: adminProfit, note: `auto_sale_role:admin:${sale.id}` }
        ].filter(row => num(row.amount) > 0).map(row => ({
            user_id: currentUserId(), date: saleDate, type: "Income", title: row.title, amount: num(row.amount), note: row.note
        }));

        if (saleLedgerRows.length) {
            const { error: ledgerError } = await supabaseClient.from("ledger").insert(saleLedgerRows);
            if (ledgerError) throw new Error("Sale saved, but Balance income could not be added: " + ledgerError.message);
        }

        await Promise.all([
            fetchSalesFromSupabase(),
            fetchStockFromSupabase(),
            fetchLedgerFromSupabase()
        ]);

        renderSaleHistory();
        renderSaleSummary();
        renderProductHouse();
        updateDashboard();

        if (form) {
            form.reset();
        }

        const container =
            $("sale-items-container");

        if (container) {
            container.innerHTML = "";
        }

        prepareSaleForm();

        alert(
            "Sale saved successfully."
        );

    } catch (error) {

        console.error(
            "Sale save error:",
            error
        );

        alert(
            "Sale process failed:\n" +
            error.message
        );

    } finally {

        setButtonLoading(
            button,
            false,
            "Save Sale"
        );
    }
}


function getSaleStoreName(s) {
    const store = storeList.find(x => String(x.id) === String(s.store_id));
    return store?.name || s.store_name || s.store_id || "-";
}

function getSaleItems(s) {
    if (Array.isArray(s.items)) return s.items;
    if (typeof s.items === "string") { try { const v = JSON.parse(s.items); return Array.isArray(v) ? v : []; } catch (_) {} }
    return [];
}

function getSaleCodes(s) {
    const items = getSaleItems(s);
    const codes = items.map(i => i.product_code || i.code || "").filter(Boolean);
    return [...new Set(codes)].join(", ") || s.product_code || "-";
}

function getSalePieces(s) {
    if (num(s.total_pcs)) return num(s.total_pcs);
    return getSaleItems(s).reduce((sum, i) => sum + num(i.sets) * num(i.pcs_per_set || i.pcsSet || 0), 0);
}

function renderSaleSummary() {
    safeText("sale-summary-total-sets", saleHistory.reduce((sum,s) => sum + num(s.total_sets), 0));
    safeText("sale-summary-total-pcs", saleHistory.reduce((sum,s) => sum + getSalePieces(s), 0));
    safeText("sale-summary-total-sale", money(saleHistory.reduce((sum,s) => sum + num(s.total_sale), 0)));
}

function renderSaleHistory(rows = saleHistory) {
    const body=$("sale-history-body"); if(!body)return;
    if(!rows.length){body.innerHTML=`<tr><td colspan="14" class="p-3">No sales yet</td></tr>`;return;}
    body.innerHTML=rows.map(s=>`<tr>
        <td>${s.date||"-"}</td><td>${escapeHtml(getSaleCodes(s))}</td><td>${escapeHtml(s.seller_name||"-")}</td><td>${escapeHtml(getSaleStoreName(s))}</td>
        <td>${num(s.total_sets)}</td><td>${getSalePieces(s)}</td><td>${money(s.total_cost)}</td><td>${money(s.total_sale)}</td><td>${money(s.seller_profit)}</td><td>${money(s.manager_profit)}</td><td>${money(s.gross_profit)}</td><td>${money(s.investor_profit)}</td><td>${money(s.admin_profit)}</td>
        <td><button type="button" class="btn btn-danger" ${num(s.total_sets)<=0?'disabled':''} onclick="openSaleReturn(${s.id})">Return</button></td>
    </tr>`).join("");
}

function openSaleReturn(id){
    const sale=saleHistory.find(x=>String(x.id)===String(id)); if(!sale)return;
    const items=getSaleItems(sale);
    $("return-sale-id").value=sale.id;
    $("return-sale-title").textContent=`Sale #${sale.id} — ${sale.date||""}`;
    const box=$("sale-return-items");
    box.innerHTML=items.map((item,i)=>{
        const sets=num(item.sets);
        const code=item.product_code||item.code||item.print_code||"-";
        return `<div class="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <div><div class="font-semibold">${escapeHtml(code)}</div><div class="text-xs text-slate-500">Sold: ${sets} set</div></div>
            <div class="text-sm">৳${money(item.sale_price_per_set||0)} / set</div>
            <div class="text-sm">Return quantity</div>
            <input type="number" min="0" max="${sets}" value="0" class="form-input return-item-sets" data-index="${i}">
        </div>`;
    }).join("");
    openModal("sale-return-modal");
}

async function saveSaleReturn(event){
    if(event)event.preventDefault();
    const saleId=safeValue("return-sale-id"); const sale=saleHistory.find(x=>String(x.id)===String(saleId)); if(!sale)return;
    const items=getSaleItems(sale).map(i=>({...i}));
    const inputs=Array.from(document.querySelectorAll(".return-item-sets"));
    let returnSets=0, returnPcs=0, returnSale=0, returnCost=0, returnSeller=0, returnManager=0;
    const changes=[];
    inputs.forEach(input=>{const idx=num(input.dataset.index); const q=num(input.value); if(q<=0)return; const item=items[idx]; const available=num(item.sets); if(q>available)throw new Error(`Return quantity exceeds sold quantity for ${item.product_code||item.code||"product"}.`); const pcsPerSet=num(item.pcs_per_set) || num(productsList.find(p=>String(p.id)===String(item.product_id))?.pcs_set); const costPerSet=num(item.cost_per_set) || (num(sale.total_sets)?num(sale.total_cost)/num(sale.total_sets):0); const sp=num(item.sale_price_per_set); const seller=num(item.seller_per_set); const manager=num(item.manager_per_set); returnSets+=q; returnPcs+=q*pcsPerSet; returnSale+=q*sp; returnCost+=q*costPerSet; returnSeller+=q*seller; returnManager+=q*manager; changes.push({idx,q,costPerSet,pcsPerSet});});
    if(!returnSets){alert("Select at least one set to return.");return;}
    const returnGross=returnSale-returnCost-returnSeller-returnManager;
    const returnInvestor=Math.max(0,returnGross*0.10); const returnAdmin=Math.max(0,returnGross*0.90);
    try{
        for(const ch of changes){
            const item=items[ch.idx]; item.sets=num(item.sets)-ch.q;
            const productId=item.product_id; let stock=null;
            if(item.stock_id) stock=productHouseStock.find(s=>String(s.id)===String(item.stock_id));
            if(!stock) stock=productHouseStock.find(s=>String(s.product_id)===String(productId)&&String(s.print_code||"")===String(item.product_code||""));
            if(stock){
                const newSets=num(stock.sets)+ch.q; const newPcs=num(stock.pcs)+Math.round(ch.q*ch.pcsPerSet);
                const {error}=await supabaseClient.from("stock").update({sets:newSets,pcs:newPcs}).eq("id",stock.id); if(error)throw error;
            }else{
                const {error}=await supabaseClient.from("stock").insert({print_code:item.product_code||"",product_id:productId,type:item.type||"",sets:ch.q,pcs:Math.round(ch.q*ch.pcsPerSet),cost_per_set:ch.costPerSet,production_id:item.production_id||null,date:sale.date||todayDate()}); if(error)throw error;
            }
        }
        const newTotalSets=Math.max(0,num(sale.total_sets)-returnSets); const newTotalPcs=Math.max(0,num(sale.total_pcs)-returnPcs); const newTotalCost=Math.max(0,num(sale.total_cost)-returnCost); const newTotalSale=Math.max(0,num(sale.total_sale)-returnSale); const newSeller=Math.max(0,num(sale.seller_profit)-returnSeller); const newManager=Math.max(0,num(sale.manager_profit)-returnManager); const newGross=newTotalSale-newTotalCost-newSeller-newManager; const newInvestor=Math.max(0,newGross*0.10); const newAdmin=Math.max(0,newGross*0.90);
        const status=newTotalSets<=0?"Returned":"Partial";
        const {error:updateError}=await supabaseClient.from("sales").update({items:items.filter(i=>num(i.sets)>0),total_sets:newTotalSets,total_pcs:Math.round(newTotalPcs),total_cost:newTotalCost,total_sale:newTotalSale,gross_profit:newGross,seller_profit:newSeller,manager_profit:newManager,investor_profit:newInvestor,admin_profit:newAdmin,return_status:status,returned_sets:num(sale.returned_sets)+returnSets,returned_pcs:num(sale.returned_pcs)+returnPcs,returned_at:new Date().toISOString()}).eq("id",sale.id); if(updateError)throw updateError;
        const reverseRows=[
            {title:"Sale Return",amount:-returnSale,note:`auto_sale_return:revenue:${sale.id}`},
            {title:"Seller Return",amount:-returnSeller,note:`auto_sale_return:seller:${sale.id}`},
            {title:"Manager Return",amount:-returnManager,note:`auto_sale_return:manager:${sale.id}`},
            {title:"Investor Return",amount:-returnInvestor,note:`auto_sale_return:investor:${sale.id}`},
            {title:"Admin Return",amount:-returnAdmin,note:`auto_sale_return:admin:${sale.id}`}
        ].filter(x=>num(x.amount)!==0).map(x=>({user_id:currentUserId(),date:todayDate(),type:"Income",title:x.title,amount:x.amount,note:x.note}));
        if(reverseRows.length){const {error}=await supabaseClient.from("ledger").insert(reverseRows);if(error)throw error;}
        await Promise.all([fetchSalesFromSupabase(),fetchStockFromSupabase(),fetchLedgerFromSupabase()]); renderSaleHistory();renderSaleSummary();renderProductHouse();updateDashboard();closeModalSafe("sale-return-modal");alert(`${returnSets} set returned successfully.`);
    }catch(e){console.error("Return sale error:",e);alert("Return failed:\n"+e.message);}
}

function filterSaleHistory() {
    const query = safeValue("search-sale-input").trim().toLowerCase();
    renderSaleHistory(saleHistory.filter(s => (`${getSaleCodes(s)} ${s.seller_name || ""} ${getSaleStoreName(s)} ${s.date || ""}`).toLowerCase().includes(query)));
}

/* =========================================================
   LEDGER
   ========================================================= */

async function fetchLedgerFromSupabase() {

    const {
        data,
        error
    } = await supabaseClient
        .from("ledger")
        .select("*")
        .order("id", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    generalLedger = data || [];
}


async function fetchWithdrawalsFromSupabase() {

    const {
        data,
        error
    } = await supabaseClient
        .from("withdrawals")
        .select("*")
        .order("id", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    withdrawalHistory = data || [];
}


async function saveTransaction(event) {

    if (event) {
        event.preventDefault();
    }

    const date =
        safeValue(
            "trans-date",
            todayDate()
        );

    const type =
        safeValue(
            "trans-type"
        ).trim();

    const title =
        safeValue(
            "trans-title"
        ).trim();

    const amount =
        num(
            safeValue(
                "trans-amount"
            )
        );

    const note =
        safeValue(
            "trans-note"
        ).trim();

    if (!type || !title || amount <= 0) {

        alert(
            "Type, title and valid amount are required."
        );

        return;
    }

    const form =
        $("ledger-form");

    const button =
        form?.querySelector(
            'button[type="submit"]'
        );

    setButtonLoading(
        button,
        true
    );

    try {

        const {
            error
        } = await supabaseClient
            .from("ledger")
            .insert({
                user_id: currentUserId(),
                date,
                type,
                title,
                amount,
                note
            });

        if (error) {
            throw error;
        }

        await fetchLedgerFromSupabase();

        renderLedger();
        updateDashboard();

        if (form) {
            form.reset();
        }

        closeModalSafe(
            "add-transaction-modal"
        );

        alert(
            "Transaction saved successfully."
        );

    } catch (error) {

        console.error(
            "Transaction error:",
            error
        );

        alert(
            "Transaction save failed:\n" +
            error.message
        );

    } finally {

        setButtonLoading(
            button,
            false,
            "Save Transaction"
        );
    }
}


async function saveRoleAmount(event) {
    if (event) event.preventDefault();

    const date = safeValue("amount-date", todayDate());
    const role = safeValue("amount-role").trim().toLowerCase();
    const recipient = safeValue("amount-recipient").trim();
    const amount = num(safeValue("amount-value"));
    const note = safeValue("amount-note").trim();

    if (!["admin", "seller", "manager", "investor"].includes(role) || amount <= 0) {
        alert("Select a role and enter a valid amount.");
        return;
    }
    if ((role === "seller" || role === "manager") && !recipient) {
        alert("Please enter the seller/manager name.");
        return;
    }

    const form = $("role-amount-form");
    const button = form?.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Add Amount");

    try {
        const title = `${role.charAt(0).toUpperCase() + role.slice(1)} Income`;
        const details = [
            `manual_role_income:${role}`,
            recipient ? `recipient:${recipient}` : "",
            note ? note : ""
        ].filter(Boolean).join(" | ");

        const { error } = await supabaseClient.from("ledger").insert({
            user_id: currentUserId(),
            date,
            type: "Income",
            title,
            amount,
            note: details
        });
        if (error) throw error;

        await fetchLedgerFromSupabase();
        renderLedger();
        updateDashboard();
        if (form) form.reset();
        const dateInput = $("amount-date");
        if (dateInput) dateInput.value = todayDate();
        handleAmountRoleChange();
        closeModalSafe("add-role-amount-modal");
        alert("Amount added successfully.");
    } catch (error) {
        console.error("Add role amount error:", error);
        alert("Could not add amount:\n" + error.message);
    } finally {
        setButtonLoading(button, false, "Add Amount");
    }
}

function handleAmountRoleChange() {
    const role = safeValue("amount-role").toLowerCase();
    const recipientWrap = $("amount-recipient-wrap");
    const recipientInput = $("amount-recipient");
    const needsRecipient = role === "seller" || role === "manager";
    if (recipientWrap) recipientWrap.style.display = needsRecipient ? "block" : "none";
    if (recipientInput) recipientInput.required = needsRecipient;
}

async function saveWithdrawal(event) {

    if (event) {
        event.preventDefault();
    }

    const date =
        safeValue(
            "with-date",
            todayDate()
        );

    const role =
        safeValue(
            "with-role"
        ).trim();

    const sellerName =
        safeValue(
            "with-seller-name"
        ).trim();

    const amount =
        num(
            safeValue(
                "with-amount"
            )
        );

    const note =
        safeValue(
            "with-note"
        ).trim();

    if (!role || amount <= 0) {

        alert(
            "Role and valid amount are required."
        );

        return;
    }

    const form =
        $("withdrawal-form");

    const button =
        form?.querySelector(
            'button[type="submit"]'
        );

    setButtonLoading(
        button,
        true
    );

    try {

        const {
            error
        } = await supabaseClient
            .from("withdrawals")
            .insert({
                user_id: currentUserId(),
                date,
                role,
                seller_name:
                    sellerName,
                amount,
                note
            });

        if (error) {
            throw error;
        }

        await fetchWithdrawalsFromSupabase();

        renderLedger();
        updateDashboard();

        if (form) {
            form.reset();
        }

        closeModalSafe(
            "add-withdrawal-modal"
        );

        alert(
            "Withdrawal saved successfully."
        );

    } catch (error) {

        console.error(
            "Withdrawal error:",
            error
        );

        alert(
            "Withdrawal save failed:\n" +
            error.message
        );

    } finally {

        setButtonLoading(
            button,
            false,
            "Save Withdrawal"
        );
    }
}


function handleWithdrawRoleChange() {

    const role =
        safeValue(
            "with-role"
        ).toLowerCase();

    const container =
        $("with-recipient-container");

    if (!container) return;

    if (
        role === "seller" ||
        role === "manager"
    ) {
        container.style.display = "block";
    } else {
        container.style.display = "none";
    }
}


function renderLedger() {

    const body =
        $("ledger-history-body");

    if (!body) return;


    /* totals */

    let income = 0;
    let expense = 0;

    generalLedger.forEach(item => {

        const type =
            String(
                item.type || ""
            ).toLowerCase();

        const note = String(item.note || "").toLowerCase();
        if (type.includes("income")) {
            // Role payouts (admin/manager/seller/investor) are allocations of profit,
            // not business expenses. Withdrawals are counted separately below.
            if (!note.includes("auto_sale_role:")) income += num(item.amount);
        } else if (type.includes("expense")) {
            expense += num(item.amount);
        }
    });


    withdrawalHistory.forEach(w => {
        expense += num(w.amount);
    });


    safeText(
        "ledger-total-income",
        money(income)
    );

    safeText(
        "ledger-total-expense",
        money(expense)
    );

    safeText(
        "ledger-net-impact",
        money(income - expense)
    );


    /* role totals: sales income minus withdrawals */
    const roles = ["admin", "investor", "manager", "seller"];
    roles.forEach(role => {
        const roleIncome = generalLedger
            .filter(item => {
                const note = String(item.note || "").toLowerCase();
                return String(item.type || "").toLowerCase() === "income" &&
                    (note.includes(`auto_sale_role:${role}:`) || note.includes(`manual_role_income:${role}`));
            })
            .reduce((sum,item) => sum + num(item.amount), 0);
        const withdrawn = withdrawalHistory
            .filter(w => String(w.role || "").toLowerCase() === role)
            .reduce((sum,w) => sum + num(w.amount), 0);
        safeText(`ledger-${role}-tot`, money(roleIncome - withdrawn));
    });

    // Seller-by-seller all-time income, withdrawn total, and remaining payable.
    const sellerTotals = new Map();
    saleHistory.forEach(sale => {
        const name = String(sale.seller_name || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        const row = sellerTotals.get(key) || { name, earned: 0, withdrawn: 0 };
        row.earned += num(sale.seller_profit);
        sellerTotals.set(key, row);
    });
    generalLedger.filter(item => String(item.type || "").toLowerCase() === "income" &&
        String(item.note || "").toLowerCase().includes("manual_role_income:seller")).forEach(item => {
        const note = String(item.note || "");
        const match = note.match(/recipient:([^|]+)/i);
        const name = String(match?.[1] || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        const row = sellerTotals.get(key) || { name, earned: 0, withdrawn: 0 };
        row.earned += num(item.amount);
        sellerTotals.set(key, row);
    });
    withdrawalHistory.filter(w => String(w.role || "").toLowerCase() === "seller").forEach(w => {
        const name = String(w.seller_name || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        const row = sellerTotals.get(key) || { name, earned: 0, withdrawn: 0 };
        row.withdrawn += num(w.amount);
        sellerTotals.set(key, row);
    });
    const sellerBody = $("seller-income-history-body");
    if (sellerBody) {
        const rows = [...sellerTotals.values()].sort((a,b) => a.name.localeCompare(b.name));
        sellerBody.innerHTML = rows.length ? rows.map(row => `
            <tr>
                <td class="p-3 font-semibold">${escapeHtml(row.name)}</td>
                <td class="p-3">${money(row.earned)}</td>
                <td class="p-3">${money(row.withdrawn)}</td>
                <td class="p-3 font-semibold">${money(row.earned-row.withdrawn)}</td>
            </tr>`).join("") : `<tr><td class="p-3" colspan="4">No seller income history yet</td></tr>`;
    }


    const allRows = [
        ...generalLedger.map(
            item => ({
                kind: "transaction",
                ...item
            })
        ),
        ...withdrawalHistory.map(
            item => ({
                kind: "withdrawal",
                ...item
            })
        )
    ];


    allRows.sort(
        (a, b) =>
            Number(b.id || 0) -
            Number(a.id || 0)
    );


    if (!allRows.length) {

        body.innerHTML =
            `<tr>
                <td colspan="8">
                    No ledger history
                </td>
            </tr>`;

        return;
    }


    body.innerHTML =
        allRows.map((item, index) => {

            const isWithdrawal =
                item.kind === "withdrawal";

            return `
                <tr>
                    <td>${index + 1}</td>

                    <td>
                        ${isWithdrawal
                            ? "Withdrawal"
                            : escapeHtml(item.type || "-")}
                    </td>

                    <td>
                        ${isWithdrawal
                            ? escapeHtml(item.role || "-")
                            : escapeHtml(item.title || "-")}
                    </td>

                    <td>
                        ${escapeHtml(
                            item.seller_name ||
                            item.note ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${money(item.amount)}
                    </td>

                    <td>
                        ${item.date || "-"}
                    </td>

                    <td>
                        ${isWithdrawal
                            ? "Expense"
                            : escapeHtml(item.type || "-")}
                    </td>

                    <td>
                        <button
                            type="button"
                            onclick="${
                                isWithdrawal
                                    ? `deleteWithdrawal(${item.id})`
                                    : `deleteTransaction(${item.id})`
                            }"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
}


async function deleteWithdrawal(id) {

    if (!confirm(
        "Delete this withdrawal?"
    )) {
        return;
    }

    try {

        const {
            error
        } = await supabaseClient
            .from("withdrawals")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        await fetchWithdrawalsFromSupabase();

        renderLedger();
        updateDashboard();

    } catch (error) {

        alert(
            "Could not delete withdrawal:\n" +
            error.message
        );
    }
}


async function deleteTransaction(id) {

    if (!confirm(
        "Delete this transaction?"
    )) {
        return;
    }

    try {

        const {
            error
        } = await supabaseClient
            .from("ledger")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        await fetchLedgerFromSupabase();

        renderLedger();
        updateDashboard();

    } catch (error) {

        alert(
            "Could not delete transaction:\n" +
            error.message
        );
    }
}


function filterLedgerHistory() {

    const query =
        safeValue(
            "search-ledger-input"
        )
            .trim()
            .toLowerCase();

    const typeFilter =
        safeValue(
            "filter-ledger-type"
        )
            .trim()
            .toLowerCase();

    const body =
        $("ledger-history-body");

    if (!body) return;

    let rows = [
        ...generalLedger.map(
            item => ({
                kind: "transaction",
                ...item
            })
        ),
        ...withdrawalHistory.map(
            item => ({
                kind: "withdrawal",
                ...item
            })
        )
    ];

    rows = rows.filter(item => {

        const text =
            `
            ${item.type || ""}
            ${item.title || ""}
            ${item.role || ""}
            ${item.seller_name || ""}
            ${item.note || ""}
            `
                .toLowerCase();

        const matchesSearch =
            !query ||
            text.includes(query);

        const matchesType =
            !typeFilter ||
            String(
                item.type ||
                item.kind ||
                ""
            )
                .toLowerCase()
                .includes(typeFilter);

        return (
            matchesSearch &&
            matchesType
        );
    });

    body.innerHTML =
        rows.map((item, index) => {

            const isWithdrawal =
                item.kind === "withdrawal";

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        ${isWithdrawal
                            ? "Withdrawal"
                            : escapeHtml(item.type || "-")}
                    </td>
                    <td>
                        ${isWithdrawal
                            ? escapeHtml(item.role || "-")
                            : escapeHtml(item.title || "-")}
                    </td>
                    <td>
                        ${escapeHtml(
                            item.seller_name ||
                            item.note ||
                            "-"
                        )}
                    </td>
                    <td>${money(item.amount)}</td>
                    <td>${item.date || "-"}</td>
                    <td>
                        <button
                            onclick="${
                                isWithdrawal
                                    ? `deleteWithdrawal(${item.id})`
                                    : `deleteTransaction(${item.id})`
                            }"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
}


/* =========================================================
   STORES
   ========================================================= */

async function fetchStoresFromSupabase() {

    const {
        data,
        error
    } = await supabaseClient
        .from("stores")
        .select("*")
        .order("id", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    storeList = data || [];
}


async function saveStore(event) {

    if (event) {
        event.preventDefault();
    }

    const name =
        safeValue("st-name").trim();

    const owner =
        safeValue("st-owner").trim();

    const area =
        safeValue("st-area").trim();

    const phone =
        safeValue("st-phone").trim();

    const whatsapp =
        safeValue("st-whatsapp").trim();

    const location =
        safeValue("st-location").trim();

    if (!name || !area) {
        alert(
            "Store name and area are required."
        );
        return;
    }

    const form =
        $("store-form");

    const button =
        form?.querySelector(
            'button[type="submit"]'
        );

    setButtonLoading(
        button,
        true
    );

    try {

        const {
            error
        } = await supabaseClient
            .from("stores")
            .insert({
                user_id: currentUserId(),
                name,
                owner,
                area,
                phone,
                whatsapp,
                location
            });

        if (error) {
            throw error;
        }

        await fetchStoresFromSupabase();

        renderStores();

        if (form) {
            form.reset();
        }

        closeModalSafe(
            "add-store-modal"
        );

        populateStoreSelect();

        alert(
            "Store saved successfully."
        );

    } catch (error) {

        console.error(
            "Store save error:",
            error
        );

        alert(
            "Store save failed:\n" +
            error.message
        );

    } finally {

        setButtonLoading(
            button,
            false,
            "Save Store"
        );
    }
}


function renderStores() {

    const body =
        $("store-list-body");

    if (!body) return;

    const areaFilter =
        safeValue(
            "store-area-filter"
        ).trim().toLowerCase();

    const filtered =
        areaFilter
            ? storeList.filter(
                s =>
                    String(
                        s.area || ""
                    )
                        .toLowerCase()
                        .includes(areaFilter)
            )
            : storeList;

    // Keep the existing Stores UI, but make the Area filter a real selector
    // populated from the areas already present in the store records.
    const areaSelect = $("store-area-filter");
    if (areaSelect) {
        const areas = [...new Set(
            storeList
                .map(s => String(s.area || "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));
        const currentArea = areaSelect.value;
        areaSelect.innerHTML =
            '<option value="">All Areas</option>' +
            areas.map(area =>
                `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`
            ).join("");
        if (areas.includes(currentArea)) areaSelect.value = currentArea;
    }

    safeText(
        "store-count-label",
        filtered.length
    );

    if (!filtered.length) {

        body.innerHTML =
            `<tr>
                <td colspan="8">
                    No stores found
                </td>
            </tr>`;

        return;
    }

    body.innerHTML =
        filtered.map((s, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.owner || "-")}</td>
                <td>${escapeHtml(s.area || "-")}</td>
                <td>${escapeHtml(s.phone || "-")}</td>
                <td>${escapeHtml(s.whatsapp || "-")}</td>
                <td>${escapeHtml(s.location || "-")}</td>
                <td>
                    <button
                        onclick="deleteStore(${s.id})"
                    >
                        Delete
                    </button>
                </td>
            </tr>
        `).join("");

    populateStoreSelect();
}


function filterStoresByArea() {
    renderStores();
}


function populateStoreSelect() {

    const select =
        $("sale-store-id");

    if (!select) return;

    const current =
        select.value;

    select.innerHTML =
        `
        <option value="">
            Select store
        </option>

        ${
            storeList.map(store => `
                <option value="${store.id}">
                    ${escapeHtml(store.name)}
                    -
                    ${escapeHtml(store.area || "")}
                </option>
            `).join("")
        }
        `;

    if (current) {
        select.value = current;
    }


    const reportSelect =
        $("report-store-select");

    if (reportSelect) {

        const selected =
            Array.from(
                reportSelect.selectedOptions
            ).map(o => o.value);

        reportSelect.innerHTML =
            storeList.map(store => `
                <option value="${store.id}">
                    ${escapeHtml(store.name)}
                </option>
            `).join("");

        selected.forEach(id => {

            const option =
                reportSelect.querySelector(
                    `option[value="${id}"]`
                );

            if (option) {
                option.selected = true;
            }
        });
    }
}


async function deleteStore(id) {

    if (!confirm(
        "Delete this store?"
    )) {
        return;
    }

    try {

        const {
            error
        } = await supabaseClient
            .from("stores")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        await fetchStoresFromSupabase();

        renderStores();

    } catch (error) {

        alert(
            "Could not delete store:\n" +
            error.message
        );
    }
}


function generateStoreReport() {

    const select = $("report-store-select");
    const body = $("report-table-body");
    const historyBody = $("report-history-body");

    if (!select || !body) return;

    const selectedIds = Array.from(select.selectedOptions).map(option => String(option.value));
    const selectedStores = storeList.filter(store => selectedIds.includes(String(store.id)));

    if (!selectedStores.length) {
        body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500">Select at least one store.</td></tr>`;
        if (historyBody) historyBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500">Select at least one store.</td></tr>`;
        safeText("report-total-sets", 0);
        safeText("report-total-sales", "0.00");
        safeText("report-total-profit", "0.00");
        return;
    }

    const selectedSales = saleHistory.filter(sale => selectedIds.includes(String(sale.store_id)));

    const totalSets = selectedSales.reduce((sum, sale) => sum + num(sale.total_sets), 0);
    const totalSales = selectedSales.reduce((sum, sale) => sum + num(sale.total_sale), 0);
    const totalProfit = selectedSales.reduce((sum, sale) => sum + num(sale.gross_profit), 0);

    const getSaleItemsForReport = (sale) => {
        if (Array.isArray(sale.items)) return sale.items;
        if (typeof sale.items === "string") {
            try { return JSON.parse(sale.items) || []; } catch (_) { return []; }
        }
        return [];
    };

    const getItemCode = (item) => {
        const productId = item?.product_id || item?.product?.id || item?.stock?.product_id;
        const product = productId ? productsList.find(p => String(p.id) === String(productId)) : null;
        return String(
            item?.product_code ||
            item?.code ||
            item?.print_code ||
            product?.code ||
            product?.print_code ||
            item?.product?.code ||
            item?.product?.print_code ||
            item?.stock?.product?.code ||
            item?.stock?.product?.print_code ||
            "-"
        );
    };

    const getSaleDate = (sale) => {
        const raw = sale.created_at || sale.sale_date || sale.date || sale.sold_at || sale.updated_at;
        if (!raw) return "-";
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return String(raw);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    body.innerHTML = selectedStores.map(store => {
        const sales = selectedSales.filter(sale => String(sale.store_id) === String(store.id));
        const sets = sales.reduce((sum, sale) => sum + num(sale.total_sets), 0);
        const saleAmount = sales.reduce((sum, sale) => sum + num(sale.total_sale), 0);
        const profit = sales.reduce((sum, sale) => sum + num(sale.gross_profit), 0);

        const soldSetMap = {};
        sales.forEach(sale => {
            const items = getSaleItemsForReport(sale);
            if (items.length) {
                items.forEach(item => {
                    const code = getItemCode(item);
                    soldSetMap[code] = (soldSetMap[code] || 0) + num(item.sets || item.total_sets);
                });
            } else {
                const code = getItemCode(sale);
                soldSetMap[code] = (soldSetMap[code] || 0) + num(sale.total_sets);
            }
        });

        const soldSetsHtml = Object.keys(soldSetMap).length
            ? Object.entries(soldSetMap).map(([code, count]) => `<div><strong>${escapeHtml(code)}</strong>: ${count} set</div>`).join("")
            : "-";

        return `
            <tr>
                <td class="p-3">${escapeHtml(store.name)}</td>
                <td class="p-3">${escapeHtml(store.area || "-")}</td>
                <td class="p-3">${soldSetsHtml}</td>
                <td class="p-3 font-semibold">${sets}</td>
                <td class="p-3">${money(saleAmount)}</td>
                <td class="p-3">${money(profit)}</td>
            </tr>
        `;
    }).join("");

    if (historyBody) {
        const rows = [];
        selectedSales.forEach(sale => {
            const store = storeList.find(s => String(s.id) === String(sale.store_id));
            const items = getSaleItemsForReport(sale);
            const date = getSaleDate(sale);

            if (items.length) {
                items.forEach(item => {
                    const sets = num(item.sets || item.total_sets);
                    const pieces = num(item.pieces || item.total_pieces || (sets * num(item.pcs_per_set)));
                    const saleValue = num(item.total_sale || item.sale_total || (num(item.sell_price_per_set || item.sell_price) * sets));
                    rows.push({
                        dateValue: sale.created_at || sale.sale_date || sale.date || sale.sold_at || sale.updated_at || "",
                        date,
                        store: store?.name || sale.store_name || "-",
                        area: store?.area || "-",
                        code: getItemCode(item),
                        sets,
                        pieces,
                        saleValue
                    });
                });
            } else {
                rows.push({
                    dateValue: sale.created_at || sale.sale_date || sale.date || sale.sold_at || sale.updated_at || "",
                    date,
                    store: store?.name || sale.store_name || "-",
                    area: store?.area || "-",
                    code: getItemCode(sale),
                    sets: num(sale.total_sets),
                    pieces: num(sale.total_pieces),
                    saleValue: num(sale.total_sale)
                });
            }
        });

        rows.sort((a, b) => new Date(b.dateValue || 0) - new Date(a.dateValue || 0));

        historyBody.innerHTML = rows.length
            ? rows.map(row => `
                <tr class="border-b">
                    <td class="p-3 whitespace-nowrap">${escapeHtml(row.date)}</td>
                    <td class="p-3">${escapeHtml(row.store)}</td>
                    <td class="p-3">${escapeHtml(row.area)}</td>
                    <td class="p-3 font-semibold">${escapeHtml(row.code)}</td>
                    <td class="p-3">${row.sets}</td>
                    <td class="p-3">${row.pieces}</td>
                    <td class="p-3">${money(row.saleValue)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="7" class="p-4 text-center text-slate-500">No sales history found.</td></tr>`;
    }

    safeText("report-total-sets", totalSets);
    safeText("report-total-sales", money(totalSales));
    safeText("report-total-profit", money(totalProfit));
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function updateDashboard() {

    const totalSales =
        saleHistory.reduce(
            (sum, s) =>
                sum +
                num(s.total_sale),
            0
        );

    const totalGrossProfit =
        saleHistory.reduce(
            (sum, s) =>
                sum +
                num(s.gross_profit),
            0
        );

    const totalSetsSold =
        saleHistory.reduce(
            (sum, s) =>
                sum +
                num(s.total_sets),
            0
        );

    const totalStock =
        productHouseStock.reduce(
            (sum, s) =>
                sum +
                num(s.pcs),
            0
        );

    const stockValue =
        productHouseStock.reduce(
            (sum, s) =>
                sum +
                (
                    num(s.sets) *
                    num(s.cost_per_set)
                ),
            0
        );


    const adminIncome =
        saleHistory.reduce(
            (sum, s) =>
                sum +
                num(s.admin_profit),
            0
        );

    const investorIncome =
        saleHistory.reduce(
            (sum, s) =>
                sum +
                num(s.investor_profit),
            0
        );

    const managerIncome =
        saleHistory.reduce(
            (sum, s) =>
                sum +
                num(s.manager_profit),
            0
        );

    const sellerIncome =
        saleHistory.reduce(
            (sum, s) =>
                sum +
                num(s.seller_profit),
            0
        );


    const withdrawals =
        withdrawalHistory.reduce(
            (sum, w) =>
                sum +
                num(w.amount),
            0
        );


    const currentBalance =
        totalSales -
        withdrawals;


    const fasteStudioFund =
        adminIncome;


    safeText(
        "dash-admin-income",
        money(adminIncome)
    );

    safeText(
        "dash-investor-income",
        money(investorIncome)
    );

    safeText(
        "dash-manager-income",
        money(managerIncome)
    );

    safeText(
        "dash-seller-income",
        money(sellerIncome)
    );

    safeText(
        "dash-faste-studio-fund",
        money(fasteStudioFund)
    );

    safeText(
        "dash-total-stock",
        totalStock
    );

    safeText(
        "dash-total-sets-sold",
        totalSetsSold
    );

    safeText(
        "dash-total-sales",
        money(totalSales)
    );

    safeText(
        "dash-total-gross-profit",
        money(totalGrossProfit)
    );

    safeText(
        "dash-stock-val",
        money(stockValue)
    );

    safeText(
        "dash-current-balance",
        money(currentBalance)
    );


    const recent =
        $("dash-recent-sales-list");

    if (recent) {

        const latest =
            saleHistory.slice(0, 5);

        if (!latest.length) {

            recent.innerHTML =
                `<div class="muted">
                    No recent sales
                </div>`;

        } else {

            recent.innerHTML =
                latest.map(s => `
                    <div class="recent-sale-item">
                        <div>
                            <strong>
                                ${escapeHtml(
                                    s.seller_name ||
                                    "Sale"
                                )}
                            </strong>

                            <small>
                                ${s.date || "-"}
                            </small>
                        </div>

                        <div>
                            ${money(
                                s.total_sale
                            )}
                        </div>
                    </div>
                `).join("");
        }
    }
}


/* =========================================================
   CSV EXPORT
   ========================================================= */

function exportTableToCSV(
    tableId,
    filename = "export.csv"
) {

    const table =
        $(tableId);

    if (!table) {
        alert("Table not found.");
        return;
    }

    const rows =
        table.querySelectorAll(
            "tr"
        );

    const csv = [];

    rows.forEach(row => {

        const cols =
            row.querySelectorAll(
                "th, td"
            );

        const rowData =
            Array.from(cols).map(
                cell => {

                    const text =
                        cell.innerText
                            .replace(
                                /"/g,
                                '""'
                            )
                            .replace(
                                /\n/g,
                                " "
                            )
                            .trim();

                    return `"${text}"`;
                }
            );

        csv.push(
            rowData.join(",")
        );
    });

    const blob =
        new Blob(
            [csv.join("\n")],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* Auth */

        const authModal = $("auth-modal");
        if (authModal && authModal.parentElement !== document.body) {
            document.body.appendChild(authModal);
        }

        setAuthMode("login");

        const authForm =
            $("auth-form");

        if (authForm) {
            authForm.addEventListener(
                "submit",
                handleLoginSubmit
            );
        }

        const switchButton =
            $("auth-switch-button");

        if (switchButton) {

            switchButton.addEventListener(
                "click",
                () => {

                    setAuthMode(
                        isSignupMode
                            ? "login"
                            : "signup"
                    );
                }
            );
        }


        /* Product size */

        [
            "p-full-size",
            "p-pcs-set"
        ].forEach(id => {

            const el = $(id);

            if (el) {
                el.addEventListener(
                    "input",
                    calcPieceSize
                );
            }
        });


        /* Production costs */

        [
            "cost-sticker",
            "cost-board",
            "cost-poly",
            "cost-tape",
            "cost-transport",
            "cost-fixed",
            "cost-ads",
            "cost-cutting",
            "cost-packing"
        ].forEach(id => {

            const el = $(id);

            if (el) {
                el.addEventListener(
                    "input",
                    calcProdCosts
                );
            }
        });


        /* Sale rates */

        [
            "sale-seller-rate",
            "sale-manager-rate"
        ].forEach(id => {

            const el = $(id);

            if (el) {
                el.addEventListener(
                    "input",
                    calcSaleProfit
                );
            }
        });


        /* Forms */

        const productForm =
            $("product-form");

        if (productForm) {
            productForm.addEventListener(
                "submit",
                saveProduct
            );
        }

        const productionForm =
            $("production-form");

        if (productionForm) {
            productionForm.addEventListener(
                "submit",
                saveProduction
            );
        }

        const saleForm =
            $("sale-form");

        if (saleForm) {
            saleForm.addEventListener(
                "submit",
                saveSale
            );
        }

        const ledgerForm =
            $("ledger-form");

        if (ledgerForm) {
            ledgerForm.addEventListener(
                "submit",
                saveTransaction
            );
        }

        const roleAmountForm = $("role-amount-form");
        if (roleAmountForm) {
            roleAmountForm.addEventListener("submit", saveRoleAmount);
        }

        const withdrawalForm =
            $("withdrawal-form");

        if (withdrawalForm) {
            withdrawalForm.addEventListener(
                "submit",
                saveWithdrawal
            );
        }

        const storeForm =
            $("store-form");

        if (storeForm) {
            storeForm.addEventListener(
                "submit",
                saveStore
            );
        }

        const destroyForm =
            $("destroy-form");

        if (destroyForm) {
            destroyForm.addEventListener(
                "submit",
                saveDestroy
            );
        }


        /* Initial auth */

        checkAuthOnLoad();

        setupAuthListener();
    }
);


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.showPage = showPage;

window.openModal = openModal;
window.closeModal = closeModal;

window.closeAuthModal = closeAuthModal;

window.setAuthMode = setAuthMode;

window.handleLoginSubmit =
    handleLoginSubmit;

window.handleLogout =
    handleLogout;

window.openAdminUsers =
    openAdminUsers;

window.closeAdminUsers =
    closeAdminUsers;

window.setUserApproval =
    setUserApproval;

window.loadAdminUsers =
    loadAdminUsers;

window.calcPieceSize =
    calcPieceSize;

window.saveProduct =
    saveProduct;

window.calcProdCosts =
    calcProdCosts;

window.addProdItemRow =
    addProdItemRow;

window.saveProduction =
    saveProduction;

window.openProductionEdit = openProductionEdit;
window.saveProductionEdit = saveProductionEdit;

window.filterProductionHistory =
    filterProductionHistory;

window.filterProductHouse =
    filterProductHouse;

window.openProductHouseEdit = openProductHouseEdit;
window.saveProductHouseEdit = saveProductHouseEdit;

window.addSaleItemRow =
    addSaleItemRow;

window.calcSaleProfit =
    calcSaleProfit;

window.saveSale =
    saveSale;

window.filterSaleHistory =
    filterSaleHistory;

window.openSaleReturn = openSaleReturn;
window.saveSaleReturn = saveSaleReturn;

window.saveTransaction =
    saveTransaction;

window.saveWithdrawal =
    saveWithdrawal;

window.handleWithdrawRoleChange =
    handleWithdrawRoleChange;

window.deleteWithdrawal =
    deleteWithdrawal;

window.deleteTransaction =
    deleteTransaction;

window.filterLedgerHistory =
    filterLedgerHistory;

window.saveStore =
    saveStore;

window.filterStoresByArea =
    filterStoresByArea;

window.deleteStore =
    deleteStore;

window.generateStoreReport =
    generateStoreReport;

window.setDestroyStock =
    setDestroyStock;

window.setDestroyStockById =
    setDestroyStockById;

window.saveDestroy =
    saveDestroy;

window.exportTableToCSV =
    exportTableToCSV;


/* =========================================================
   END
   ========================================================= */
