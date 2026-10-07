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

    const body =
        $("product-list-body");

    if (!body) return;

    if (!productsList.length) {

        body.innerHTML =
            `<tr>
                <td colspan="7">
                    No products yet
                </td>
            </tr>`;

        return;
    }

    const query = safeValue("search-product-input").trim().toLowerCase();
    const filtered = productsList.filter(p =>
        `${p.code || ""} ${p.type || ""}`.toLowerCase().includes(query)
    );

    body.innerHTML = filtered.length
        ? filtered.map((p, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(p.code)}</td>
                <td>${escapeHtml(p.type)}</td>
                <td>${num(p.full_size)}</td>
                <td>${num(p.pcs_set)}</td>
                <td>${num(p.pc_size)}</td>
                <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="7">No products found</td></tr>`;
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


function renderProductionHistory(rows = productionHistory) {
    const body = $("production-history-body");
    if (!body) return;
    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="18" class="p-3">No production history</td></tr>`;
        return;
    }
    const costKeys = ["sticker","board","poly","tape","transport","fixed","ads","cutting","packing"];
    body.innerHTML = rows.map((p,index) => {
        const c = p.costs || {};
        const madeSets = Array.isArray(p.items) ? p.items.map(item => {
            const code = item.product?.code || item.product?.print_code || item.code || item.print_code || "-";
            return `${escapeHtml(code)}: ${num(item.sets)} set`;
        }).join("<br>") : "-";
        return `<tr><td class="p-3">${index+1}</td><td class="p-3">${escapeHtml(p.date||"-")}</td><td class="p-3">${escapeHtml(p.print_code||p.batch_code||"-")}</td><td class="p-3">${madeSets}</td><td class="p-3">${num(p.total_sets)}</td><td class="p-3">${num(p.total_pcs)}</td>${costKeys.map(k=>`<td class="p-3">৳${money(c[k])}</td>`).join("")}<td class="p-3 font-bold">৳${money(p.total_cost)}</td><td class="p-3">৳${money(p.cost_per_set)}</td><td class="p-3"><button type="button" onclick="openProductionEdit(${p.id})">Edit</button></td></tr>`;
    }).join("");
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
    const filtered = productionHistory.filter(p =>
        `${p.print_code || p.batch_code || ""} ${p.date || ""}`.toLowerCase().includes(query)
    );
    renderProductionHistory(filtered);
}

async function openProductionEdit(id) {
    const p = productionHistory.find(x => String(x.id) === String(id));
    if (!p) return;
    const dateInput = $("edit-prod-date");
    const codeInput = $("edit-prod-code");
    const itemsBox = $("edit-prod-items");
    if (!dateInput || !codeInput || !itemsBox) return;
    $("edit-prod-id").value = p.id;
    dateInput.value = p.date || todayDate();
    codeInput.value = p.print_code || p.batch_code || p.code || "";
    const items = Array.isArray(p.items) ? p.items : [];
    itemsBox.innerHTML = items.map((item, i) => {
        const productId = item.productId || item.product_id || item.product?.id || "";
        const product = productsList.find(x => String(x.id) === String(productId));
        const code = product?.code || item.product?.code || item.code || item.print_code || "-";
        return `<div class="grid grid-cols-2 gap-3 items-center"><div class="font-semibold">${escapeHtml(code)}</div><input class="form-input edit-prod-sets" data-product-id="${escapeHtml(productId)}" type="number" min="0" value="${num(item.sets)}" required></div>`;
    }).join("");
    const c = p.costs || {};
    ["sticker","board","poly","tape","transport","fixed","ads","cutting","packing"].forEach(k => { const el=$("edit-prod-cost-"+k); if(el) el.value=num(c[k]); });
    openModal("edit-production-modal");
}

async function saveProductionEdit(event) {
    if (event) event.preventDefault();
    const id = $("edit-prod-id")?.value;
    const old = productionHistory.find(x => String(x.id) === String(id));
    if (!old) return;
    const date = safeValue("edit-prod-date", todayDate());
    const printCode = safeValue("edit-prod-code").trim();
    const inputs = Array.from(document.querySelectorAll(".edit-prod-sets"));
    const oldItems = Array.isArray(old.items) ? old.items : [];
    const items = inputs.map(input => {
        const productId = input.dataset.productId;
        const oldItem = oldItems.find(x => String(x.productId || x.product_id || x.product?.id) === String(productId));
        const product = productsList.find(x => String(x.id) === String(productId));
        return { productId, sets: num(input.value), product: product || oldItem?.product || {} };
    }).filter(x => x.sets > 0);
    if (!printCode || !items.length) { alert("Enter valid production code and sets."); return; }
    const costs = {};
    ["sticker","board","poly","tape","transport","fixed","ads","cutting","packing"].forEach(k => costs[k]=num(safeValue("edit-prod-cost-"+k)));
    const totalSets = items.reduce((sum,x)=>sum+num(x.sets),0);
    const totalPcs = items.reduce((sum,x)=>sum+num(x.sets)*num(x.product?.pcs_set),0);
    const totalCost = Object.values(costs).reduce((sum,x)=>sum+num(x),0);
    const costPerSet = totalSets ? totalCost/totalSets : 0;
    try {
        const { error: prodError } = await supabaseClient.from("productions").update({
            batch_code: printCode, print_code: printCode, code: printCode, items, costs, total_sets: totalSets, total_pcs: totalPcs, total_cost: totalCost, avg_cost_per_set: costPerSet, cost_per_set: costPerSet, date
        }).eq("id", id);
        if (prodError) throw prodError;
        const { data: existingRows, error: stockFetchError } = await supabaseClient.from("stock").select("*").eq("production_id", id);
        if (stockFetchError) throw stockFetchError;
        for (const row of existingRows || []) {
            const item = items.find(x => String(x.productId) === String(row.product_id));
            if (!item) {
                const {error} = await supabaseClient.from("stock").delete().eq("id", row.id); if(error) throw error; continue;
            }
            const product = item.product || {};
            const {error} = await supabaseClient.from("stock").update({ print_code: printCode, type: product.type || row.type, sets: item.sets, pcs: item.sets*num(product.pcs_set || (num(row.pcs)/Math.max(num(row.sets),1))), cost_per_set: costPerSet, date }).eq("id", row.id);
            if(error) throw error;
        }
        for (const item of items) {
            const found = (existingRows || []).find(r => String(r.product_id) === String(item.productId));
            if (!found) {
                const {error} = await supabaseClient.from("stock").insert({ print_code: printCode, product_id: item.productId, type: item.product?.type || "", sets: item.sets, pcs: item.sets*num(item.product?.pcs_set), cost_per_set: costPerSet, production_id: id, date });
                if(error) throw error;
            }
        }
        await Promise.all([fetchProductionFromSupabase(), fetchStockFromSupabase()]);
        renderProductionHistory(); renderProdSummary(); renderProductHouse(); updateDashboard();
        closeModalSafe("edit-production-modal");
        alert("Production updated successfully.");
    } catch(error) { console.error("Production edit error:",error); alert("Production update failed:\n"+error.message); }
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

    const body =
        $("product-house-body");

    if (!body) return;

    const totalPcs =
        productHouseStock.reduce(
            (sum, s) =>
                sum + num(s.pcs),
            0
        );

    const totalSets =
        productHouseStock.reduce(
            (sum, s) =>
                sum + num(s.sets),
            0
        );

    safeText(
        "house-total-pcs",
        totalPcs
    );

    safeText(
        "house-total-sets",
        totalSets
    );

    if (!productHouseStock.length) {

        body.innerHTML =
            `<tr>
                <td colspan="8">
                    No stock available
                </td>
            </tr>`;

        return;
    }

    filterProductHouse();
    renderHouseTypeBreakdown();
}


function renderHouseTypeBreakdown() {

    const el =
        $("house-type-breakdown");

    if (!el) return;

    const map = {};

    productHouseStock.forEach(stock => {

        const type =
            stock.type || "Unknown";

        if (!map[type]) {
            map[type] = 0;
        }

        map[type] += num(stock.pcs);
    });

    el.innerHTML =
        Object.entries(map)
            .map(
                ([type, pcs]) =>
                    `<div>
                        <strong>${escapeHtml(type)}</strong>
                        <span>${pcs} pcs</span>
                    </div>`
            )
            .join("");
}


function filterProductHouse() {
    const query = safeValue("search-house-input").trim().toLowerCase();
    const body = $("product-house-body");
    if (!body) return;
    const filtered = productHouseStock.filter(s => `${s.print_code || ""} ${s.type || ""}`.toLowerCase().includes(query));
    body.innerHTML = filtered.length ? filtered.map((s) => `
        <tr>
            <td>${escapeHtml((productsList.find(p => String(p.id) === String(s.product_id))?.code) || s.code || s.print_code || "-")}</td>
            <td>${escapeHtml((productsList.find(p => String(p.id) === String(s.product_id))?.type) || s.type || "-")}</td>
            <td>${num(s.sets)}</td><td>${num(s.pcs)}</td><td>${money(s.cost_per_set)}</td><td>${s.date || "-"}</td>
            <td><button type="button" onclick="openStockEdit(${s.id})">Edit</button> <button type="button" onclick="openModal('destroy-modal'); setDestroyStockById(${s.id})">Destroy</button></td>
        </tr>`).join("") : `<tr><td colspan="7" class="p-3">No stock found</td></tr>`;
}

async function openStockEdit(id) {
    const stock = productHouseStock.find(s=>String(s.id)===String(id));
    if(!stock) return;
    $("edit-stock-id").value=stock.id;
    $("edit-stock-code").value=(productsList.find(p=>String(p.id)===String(stock.product_id))?.code)||stock.print_code||"";
    $("edit-stock-type").value=(productsList.find(p=>String(p.id)===String(stock.product_id))?.type)||stock.type||"";
    $("edit-stock-sets").value=num(stock.sets);
    $("edit-stock-sets").max="";
    openModal("edit-stock-modal");
}

async function saveStockEdit(event) {
    if(event) event.preventDefault();
    const id=$("edit-stock-id")?.value; const stock=productHouseStock.find(s=>String(s.id)===String(id));
    const sets=num(safeValue("edit-stock-sets"));
    if(!stock || sets<=0){alert("Enter valid sets.");return;}
    const pcsPerSet=num(stock.pcs)/Math.max(num(stock.sets),1);
    try {
        const {error}=await supabaseClient.from("stock").update({sets, pcs:Math.round(sets*pcsPerSet)}).eq("id",id);
        if(error) throw error;
        await fetchStockFromSupabase(); renderProductHouse(); updateDashboard(); closeModalSafe("edit-stock-modal"); alert("Product House stock updated successfully.");
    } catch(error){console.error("Stock edit error:",error);alert("Product House update failed:\n"+error.message);}
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
    const body = $("sale-history-body");
    if (!body) return;
    if (!rows.length) { body.innerHTML = `<tr><td colspan="13" class="p-3">No sales yet</td></tr>`; return; }
    body.innerHTML = rows.map(s => `
        <tr>
            <td>${s.date || "-"}</td>
            <td>${escapeHtml(getSaleCodes(s))}</td>
            <td>${escapeHtml(s.seller_name || "-")}</td>
            <td>${escapeHtml(getSaleStoreName(s))}</td>
            <td>${num(s.total_sets)}</td>
            <td>${getSalePieces(s)}</td>
            <td>${money(s.total_cost)}</td>
            <td>${money(s.total_sale)}</td>
            <td>${money(s.seller_profit)}</td>
            <td>${money(s.manager_profit)}</td>
            <td>${money(s.gross_profit)}</td>
            <td>${money(s.investor_profit)}</td>
            <td>${money(s.admin_profit)}</td>
            <td>${String(s.status || "completed").toLowerCase()==="returned" ? "Returned" : `<button type="button" onclick="returnSale(${s.id})">Return</button>`}</td>
        </tr>`).join("");
}

async function returnSale(id) {
    const sale = saleHistory.find(s=>String(s.id)===String(id));
    if(!sale) return;
    if(String(sale.status||"completed").toLowerCase()==="returned"){ alert("This sale is already returned."); return; }
    if(!confirm(`Return this sale (${getSaleCodes(sale)})?\nAll sold sets will go back to Product House and Balance income will be reversed.`)) return;
    const items=getSaleItems(sale);
    try {
        for(const item of items){
            const sets=num(item.sets); if(sets<=0) continue;
            const stockId=item.stock_id;
            let existing=null;
            if(stockId){ const r=await supabaseClient.from("stock").select("*").eq("id",stockId).maybeSingle(); if(r.error) throw r.error; existing=r.data; }
            if(existing){
                const pcsPerSet=num(existing.pcs)/Math.max(num(existing.sets),1);
                const {error}=await supabaseClient.from("stock").update({sets:num(existing.sets)+sets,pcs:Math.round((num(existing.sets)+sets)*pcsPerSet)}).eq("id",existing.id); if(error) throw error;
            } else {
                const product=productsList.find(p=>String(p.id)===String(item.product_id));
                const pcsPerSet=num(item.pcs_per_set)||num(product?.pcs_set);
                const costPerSet=num(item.cost_per_set)|| (num(sale.total_cost)/Math.max(num(sale.total_sets),1));
                const {error}=await supabaseClient.from("stock").insert({print_code:item.product_code||"",product_id:item.product_id||null,type:item.type||product?.type||"",sets,pcs:Math.round(sets*pcsPerSet),cost_per_set:costPerSet,production_id:null,date:sale.date||todayDate()}); if(error) throw error;
            }
        }
        const {error: statusError}=await supabaseClient.from("sales").update({status:"returned"}).eq("id",id);
        if(statusError) throw statusError;
        const {error: ledgerError}=await supabaseClient.from("ledger").delete().or(`note.eq.auto_sale_revenue:${id},note.eq.auto_sale_role:seller:${id},note.eq.auto_sale_role:manager:${id},note.eq.auto_sale_role:investor:${id},note.eq.auto_sale_role:admin:${id}`);
        if(ledgerError) throw ledgerError;
        await Promise.all([fetchSalesFromSupabase(),fetchStockFromSupabase(),fetchLedgerFromSupabase()]);
        renderSaleHistory(); renderSaleSummary(); renderProductHouse(); renderLedger(); updateDashboard();
        alert("Sale returned successfully. Product House and Balance have been updated.");
    } catch(error){ console.error("Sale return error:",error); alert("Sale return failed:\n"+error.message); }
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

        if (
            type.includes("income") &&
            !String(item.note || "").toLowerCase().includes("auto_sale_role:")
        ) {
            income += num(item.amount);
        } else {
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
        const income = generalLedger
            .filter(item => String(item.type || "").toLowerCase() === "income" && String(item.note || "").toLowerCase().includes(`auto_sale_role:${role}:`))
            .reduce((sum,item) => sum + num(item.amount), 0);
        const withdrawn = withdrawalHistory
            .filter(w => String(w.role || "").toLowerCase() === role)
            .reduce((sum,w) => sum + num(w.amount), 0);
        safeText(`ledger-${role}-tot`, money(income - withdrawn));
    });


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

    const memberName =
        safeValue("st-member-name").trim();

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
                member_name: memberName,
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
                <td colspan="9">
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
                <td>${escapeHtml(s.member_name || "-")}</td>
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

        const editProductionForm = $("edit-production-form");
        if (editProductionForm) editProductionForm.addEventListener("submit", saveProductionEdit);

        const editStockForm = $("edit-stock-form");
        if (editStockForm) editStockForm.addEventListener("submit", saveStockEdit);

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

window.filterProductionHistory =
    filterProductionHistory;

window.filterProductHouse =
    filterProductHouse;

window.addSaleItemRow =
    addSaleItemRow;

window.calcSaleProfit =
    calcSaleProfit;

window.saveSale =
    saveSale;

window.filterSaleHistory =
    filterSaleHistory;

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
