// Conference Abstract System (Front-end only)
// -------------------------------------------------
// SECURITY NOTE:
// This is a front-end prototype to demonstrate UX and role-based flows.
// For a real production system you must implement authentication, password
// hashing, sessions, RBAC enforcement, auditing, file storage, and reminders
// on a secure backend (e.g., Node/Express, Django, Laravel, .NET, etc.).
// -------------------------------------------------

const STORAGE_KEY = "cas_v1";

const STATUSES = [
	"Draft",
	"Submitted",
	"Under Screening",
	"Under Review",
	"Revision Requested",
	"Accepted",
	"Rejected",
	"Scheduled",
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function nowIso() {
	return new Date().toISOString();
}

function utcPretty(iso) {
	try {
		return new Date(iso).toISOString().replace("T", " ").replace("Z", " UTC");
	} catch {
		return iso;
	}
}

function uid(prefix) {
	return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function toast(type, title, body) {
	const region = $("#toastRegion");
	const el = document.createElement("div");
	el.className = `toast toast--${type}`;
	el.innerHTML = `<div class="toast__title">${escapeHtml(title)}</div><div class="toast__body">${escapeHtml(body)}</div>`;
	region.appendChild(el);
	setTimeout(() => el.remove(), 4200);
}

function escapeHtml(s) {
	return String(s ?? "").replace(/[&<>\"']/g, (c) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	}[c]));
}

// ------------------------
// Demo data + persistence
// ------------------------

function loadState() {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw) return JSON.parse(raw);

	// Seed demo accounts + one sample abstract for workflow testing
	const state = {
		users: [
			{
				id: "u_admin",
				role: "admin",
				email: "admin@demo.test",
				name: "Demo Admin",
				password: "Password123", // backend: hashed
				profile: { affiliation: "Conference Office", phone: "", country: "", orcid: "" },
			},
			{
				id: "u_reviewer",
				role: "reviewer",
				email: "reviewer@demo.test",
				name: "Demo Reviewer",
				password: "Password123",
				profile: { affiliation: "Institute A", phone: "", country: "", orcid: "" },
				reviewer: { expertise: ["Public Health", "Laboratory Medicine"], availability: "Available" },
				coi: { affiliations: ["Institute A"], authors: [] },
			},
			{
				id: "u_author",
				role: "author",
				email: "author@demo.test",
				name: "Demo Author",
				password: "Password123",
				profile: { affiliation: "University B", phone: "", country: "", orcid: "" },
			},
		],
		abstracts: [
			{
				id: "abs_1001",
				authorId: "u_author",
				presenter: {
					name: "Demo Author",
					affiliation: "University B",
					email: "author@demo.test",
					orcid: "",
				},
				title: "Point-of-care diagnostics for rapid triage",
				body:
					"Background: Rapid diagnostic tools can improve triage. Methods: We evaluated... Results: ... Conclusions: ...",
				keywords: "diagnostics; triage; point-of-care",
				track: "Public Health",
				category: "Poster",
				coAuthors: [
					{ name: "Coauthor One", email: "co1@demo.test", affiliation: "University B" },
				],
				file: null,
				status: "Under Review",
				createdAt: nowIso(),
				updatedAt: nowIso(),
				submittedAt: nowIso(),
				assignments: [
					{ reviewerId: "u_reviewer", assignedAt: nowIso(), dueAt: dueInDays(7) },
					{ reviewerId: "u_admin", assignedAt: nowIso(), dueAt: dueInDays(7) }, // demo: admin as reviewer
				],
				reviews: [],
			},
		],
		audit: [],
		notifications: [],
		session: null,
	};

	saveState(state);
	return state;
}

function saveState(state) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dueInDays(days) {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString();
}

let state = loadState();

function getSessionUser() {
	if (!state.session) return null;
	return state.users.find((u) => u.id === state.session.userId) ?? null;
}

function requireRole(user, allowed) {
	if (!user) return false;
	return allowed.includes(user.role);
}

function audit(action, target, details = "") {
	const user = getSessionUser();
	state.audit.unshift({
		id: uid("aud"),
		at: nowIso(),
		actor: user ? `${user.name} (${user.role})` : "(system)",
		action,
		target,
		details,
	});
	saveState(state);
}

function notify(title, body) {
	state.notifications.unshift({ id: uid("n"), at: nowIso(), title, body });
	saveState(state);
	renderNotifications();
}

// ------------------------
// Routing + views
// ------------------------

const routes = {
	"auth": "viewAuth",
	"dashboard": "viewDashboard",
	"profile": "viewProfile",
	"author-submissions": "viewAuthorSubmissions",
	"author-new": "viewAuthorNew",
	"reviewer-queue": "viewReviewerQueue",
	"reviewer-guidance": "viewReviewerGuidance",
	"admin-abstracts": "viewAdminAbstracts",
	"admin-reviewers": "viewAdminReviewers",
	"admin-analytics": "viewAdminAnalytics",
	"admin-audit": "viewAdminAudit",
};

function showView(routeKey) {
	const viewId = routes[routeKey] ?? "viewAuth";
	Object.values(routes).forEach((id) => $(`#${id}`).classList.add("hidden"));
	$(`#${viewId}`).classList.remove("hidden");

	// Highlight active nav item
	$$(`.nav__item`).forEach((a) => a.classList.toggle("active", a.dataset.route === routeKey));
}

function navigate(routeKey) {
	window.location.hash = `#${routeKey}`;
}

function currentRoute() {
	return (window.location.hash || "#auth").replace("#", "");
}

function enforceRoute() {
	const user = getSessionUser();
	const route = currentRoute();

	if (!user) {
		showView("auth");
		return;
	}

	// Role-based access control (client-side demo only)
	const role = user.role;
	const allowedByRoute = {
		"dashboard": ["author", "reviewer", "admin"],
		"profile": ["author", "reviewer", "admin"],
		"author-submissions": ["author"],
		"author-new": ["author"],
		"reviewer-queue": ["reviewer", "admin"],
		"reviewer-guidance": ["reviewer", "admin"],
		"admin-abstracts": ["admin"],
		"admin-reviewers": ["admin"],
		"admin-analytics": ["admin"],
		"admin-audit": ["admin"],
	};

	const allowed = allowedByRoute[route] ?? ["author", "reviewer", "admin"];
	if (!allowed.includes(role)) {
		toast("error", "Access denied", "You do not have permission to view this page.");
		showView("dashboard");
		return;
	}

	showView(route);
	renderAll();
}

// ------------------------
// UI rendering
// ------------------------

function setShellForUser(user) {
	const sidebar = $("#sidebar");
	const btnLogout = $("#btnLogout");
	const btnOpenNotifications = $("#btnOpenNotifications");
	const badge = $("#sessionBadge");

	if (!user) {
		sidebar.classList.add("hidden");
		btnLogout.classList.add("hidden");
		btnOpenNotifications.classList.add("hidden");
		badge.classList.add("hidden");
		return;
	}

	sidebar.classList.remove("hidden");
	btnLogout.classList.remove("hidden");
	btnOpenNotifications.classList.remove("hidden");
	badge.classList.remove("hidden");
	badge.textContent = `${user.name} • ${user.role.toUpperCase()}`;

	$("#navAuthor").classList.toggle("hidden", user.role !== "author");
	$("#navReviewer").classList.toggle("hidden", !["reviewer", "admin"].includes(user.role));
	$("#navAdmin").classList.toggle("hidden", user.role !== "admin");

	$("#btnQuickNewAbstract").classList.toggle("hidden", user.role !== "author");
	$("#btnQuickExport").classList.toggle("hidden", user.role !== "admin");
}

function renderDashboard() {
	const user = getSessionUser();
	if (!user) return;

	const subtitle = $("#dashboardSubtitle");
	subtitle.textContent = {
		author: "Track drafts, submissions, and decisions.",
		reviewer: "Review queue and deadlines.",
		admin: "System-wide submissions and review monitoring.",
	}[user.role];

	const cards = $("#dashboardCards");
	cards.innerHTML = "";

	const abstracts = state.abstracts;
	const myAbstracts = abstracts.filter((a) => a.authorId === user.id);
	const myAssignments = abstracts.filter((a) => a.assignments?.some((x) => x.reviewerId === user.id));
	const pendingReviews = abstracts.filter((a) => (a.assignments?.length ?? 0) > 0 && (a.reviews?.length ?? 0) < 2);
	const completedReviews = abstracts.filter((a) => (a.reviews?.length ?? 0) >= 2);

	const metrics = user.role === "author"
		? [
			{ label: "My drafts", value: myAbstracts.filter((a) => a.status === "Draft").length, pill: "pill--yellow" },
			{ label: "Submitted", value: myAbstracts.filter((a) => a.status !== "Draft").length, pill: "pill--blue" },
			{ label: "Under review", value: myAbstracts.filter((a) => a.status === "Under Review").length, pill: "pill--purple" },
			{ label: "Decisions", value: myAbstracts.filter((a) => ["Accepted", "Rejected", "Scheduled"].includes(a.status)).length, pill: "pill--green" },
		]
		: user.role === "reviewer"
		? [
			{ label: "Assigned", value: myAssignments.length, pill: "pill--blue" },
			{ label: "Pending", value: myAssignments.filter((a) => !a.reviews.some((r) => r.reviewerId === user.id)).length, pill: "pill--yellow" },
			{ label: "Completed", value: myAssignments.filter((a) => a.reviews.some((r) => r.reviewerId === user.id)).length, pill: "pill--green" },
			{ label: "Avg. score", value: avgReviewerScore(user.id), pill: "pill--purple" },
		]
		: [
			{ label: "Total abstracts", value: abstracts.length, pill: "pill--blue" },
			{ label: "Pending reviews", value: pendingReviews.length, pill: "pill--yellow" },
			{ label: "Completion rate", value: `${completionRate(abstracts)}%`, pill: "pill--green" },
			{ label: "Acceptance rate", value: `${acceptanceRate(abstracts)}%`, pill: "pill--purple" },
		];

	for (const m of metrics) {
		const el = document.createElement("div");
		el.className = "card";
		el.innerHTML = `<div class="muted small">${escapeHtml(m.label)}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px"><div style="font-size:28px;font-weight:800">${escapeHtml(m.value)}</div><span class="pill ${m.pill}">Metric</span></div>`;
		cards.appendChild(el);
	}

	const queue = $("#dashboardQueue");
	queue.innerHTML = "";

	if (user.role === "author") {
		const items = myAbstracts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
		if (!items.length) {
			queue.className = "empty";
			queue.textContent = "No abstracts yet.";
			return;
		}
		queue.className = "";
		queue.innerHTML = items.map((a) => `<div class="details__row"><div><div class="details__val">${escapeHtml(a.title || "(Untitled)")}</div><div class="details__key">${escapeHtml(a.track || "-")} • Updated ${escapeHtml(utcPretty(a.updatedAt))}</div></div><div><span class="pill">${escapeHtml(a.status)}</span></div></div>`).join("");
	}

	if (user.role === "reviewer") {
		const items = myAssignments.filter((a) => !a.reviews.some((r) => r.reviewerId === user.id));
		if (!items.length) {
			queue.className = "empty";
			queue.textContent = "No pending reviews.";
			return;
		}
		queue.className = "";
		queue.innerHTML = items.slice(0, 6).map((a) => {
			const due = a.assignments.find((x) => x.reviewerId === user.id)?.dueAt;
			return `<div class="details__row"><div><div class="details__val">${escapeHtml(a.title)}</div><div class="details__key">Due ${escapeHtml(due ? utcPretty(due) : "-")}</div></div><div><button class="btn btn--primary" data-action="open-review" data-id="${a.id}">Review</button></div></div>`;
		}).join("");
	}

	if (user.role === "admin") {
		const items = pendingReviews.slice(0, 6);
		if (!items.length) {
			queue.className = "empty";
			queue.textContent = "No pending reviews.";
			return;
		}
		queue.className = "";
		queue.innerHTML = items.map((a) => `<div class="details__row"><div><div class="details__val">${escapeHtml(a.title)}</div><div class="details__key">${escapeHtml(a.reviews.length)}/2 reviews • ${escapeHtml(a.status)}</div></div><div><button class="btn btn--outline" data-action="open-admin-abstract" data-id="${a.id}">Open</button></div></div>`).join("");
	}
}

function avgReviewerScore(reviewerId) {
	const reviews = state.abstracts.flatMap((a) => a.reviews).filter((r) => r.reviewerId === reviewerId);
	if (!reviews.length) return "-";
	const avg = reviews.reduce((sum, r) => sum + (r.totalScore ?? 0), 0) / reviews.length;
	return avg.toFixed(1);
}

function completionRate(abstracts) {
	if (!abstracts.length) return 0;
	const complete = abstracts.filter((a) => (a.reviews?.length ?? 0) >= 2).length;
	return Math.round((complete / abstracts.length) * 100);
}

function acceptanceRate(abstracts) {
	const decided = abstracts.filter((a) => ["Accepted", "Rejected", "Scheduled"].includes(a.status));
	if (!decided.length) return 0;
	const accepted = decided.filter((a) => ["Accepted", "Scheduled"].includes(a.status)).length;
	return Math.round((accepted / decided.length) * 100);
}

function renderProfile() {
	const user = getSessionUser();
	if (!user) return;
	$("#profileName").value = user.name ?? "";
	$("#profileEmail").value = user.email ?? "";
	$("#profileAffiliation").value = user.profile?.affiliation ?? "";
	$("#profilePhone").value = user.profile?.phone ?? "";
	$("#profileCountry").value = user.profile?.country ?? "";
	$("#profileOrcid").value = user.profile?.orcid ?? "";
}

function renderAuthorSubmissions() {
	const user = getSessionUser();
	if (!requireRole(user, ["author"])) return;

	// status filter options
	const sel = $("#authorStatusFilter");
	if (!sel.dataset.bound) {
		sel.innerHTML = `<option value="">All statuses</option>` + STATUSES.map((s) => `<option>${escapeHtml(s)}</option>`).join("");
		sel.dataset.bound = "1";
	}

	const q = $("#authorSearch").value.trim().toLowerCase();
	const status = sel.value;

	let rows = state.abstracts.filter((a) => a.authorId === user.id);
	if (status) rows = rows.filter((a) => a.status === status);
	if (q) rows = rows.filter((a) => `${a.title} ${a.track} ${a.keywords}`.toLowerCase().includes(q));

	const tbody = $("#authorAbstractsTbody");
	tbody.innerHTML = "";
	$("#authorAbstractsEmpty").classList.toggle("hidden", rows.length > 0);

	for (const a of rows.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))) {
		const tr = document.createElement("tr");
		tr.innerHTML = `
			<td>${escapeHtml(a.title || "(Untitled)")}</td>
			<td>${escapeHtml(a.track || "-")}</td>
			<td><span class="pill">${escapeHtml(a.status)}</span></td>
			<td class="muted">${escapeHtml(utcPretty(a.updatedAt))}</td>
			<td style="text-align:right">
				${a.status === "Draft" ? `<button class="btn btn--outline" data-action="edit-abstract" data-id="${a.id}">Edit</button>` : `<button class="btn btn--ghost" data-action="view-abstract" data-id="${a.id}">View</button>`}
			</td>
		`;
		tbody.appendChild(tr);
	}
}

// ------------------------
// Submission wizard
// ------------------------

let wizard = {
	step: 0,
	editingAbstractId: null,
	autosaveTimer: null,
};

function resetWizard() {
	wizard.step = 0;
	wizard.editingAbstractId = null;
	$("#formWizard").reset();
	$("#coAuthorsList").innerHTML = "";
	$("#wFile").value = "";
	renderWizard();
}

function loadWizardFromProfile() {
	const user = getSessionUser();
	if (!user) return;
	$("#wProfileName").value = user.name ?? "";
	$("#wProfileAffiliation").value = user.profile?.affiliation ?? "";
	$("#wProfileEmail").value = user.email ?? "";
	$("#wProfileOrcid").value = user.profile?.orcid ?? "";
}

function renderWizard() {
	const stepLabel = $("#wizardStepLabel");
	stepLabel.textContent = `Step ${wizard.step + 1} of 8`;
	const progress = $("#wizardProgress");
	progress.style.width = `${Math.round(((wizard.step + 1) / 8) * 100)}%`;

	const panels = $$(".wizard__panel");
	panels.forEach((p) => p.classList.toggle("hidden", Number(p.dataset.panel) !== wizard.step));

	const steps = $$(".wizard__step");
	steps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === wizard.step));

	// button states
	$("#btnPrev").disabled = wizard.step === 0;
	$("#btnNext").classList.toggle("hidden", wizard.step === 7);
	$("#btnSubmitAbstract").classList.toggle("hidden", wizard.step !== 7);

	if (wizard.step === 7) {
		renderConfirmSummary();
	}
}

function renderConfirmSummary() {
	const data = wizardGetData();
	const rows = [
		["Presenter", `${data.presenter.name} (${data.presenter.affiliation})`],
		["Email", data.presenter.email],
		["Title", data.title],
		["Track", `${data.track} / ${data.category}`],
		["Keywords", data.keywords],
		["Co-authors", data.coAuthors.length ? data.coAuthors.map((c) => c.name).join(", ") : "None"],
		["File", data.file?.name ?? "None"],
	];
	$("#confirmSummary").innerHTML = rows
		.map(
			([k, v]) => `<div class="summary__row"><div class="summary__key">${escapeHtml(k)}</div><div class="summary__val">${escapeHtml(v)}</div></div>`,
		)
		.join("");
}

function wizardGetData() {
	const coAuthors = getCoAuthorsFromUI();

	// file input only stores the filename in this demo
	const fileInput = $("#wFile");
	const file = fileInput.files && fileInput.files[0]
		? { name: fileInput.files[0].name, size: fileInput.files[0].size, type: fileInput.files[0].type }
		: null;

	return {
		presenter: {
			name: $("#wProfileName").value.trim(),
			affiliation: $("#wProfileAffiliation").value.trim(),
			email: $("#wProfileEmail").value.trim(),
			orcid: $("#wProfileOrcid").value.trim(),
		},
		title: $("#wTitle").value.trim(),
		body: $("#wBody").value.trim(),
		keywords: $("#wKeywords").value.trim(),
		track: $("#wTrack").value,
		category: $("#wCategory").value,
		coAuthors,
		file,
	};
}

function getCoAuthorsFromUI() {
	return $$(".coauthor").map((row) => ({
		name: $("input[name='caName']", row).value.trim(),
		email: $("input[name='caEmail']", row).value.trim(),
		affiliation: $("input[name='caAffiliation']", row).value.trim(),
	})).filter((x) => x.name || x.email || x.affiliation);
}

function addCoAuthorRow(data = { name: "", email: "", affiliation: "" }) {
	const wrap = $("#coAuthorsList");
	const row = document.createElement("div");
	row.className = "coauthor";
	row.innerHTML = `
		<div class="form__row">
			<label class="label">Name</label>
			<input class="input" name="caName" value="${escapeHtml(data.name)}" />
		</div>
		<div class="form__row">
			<label class="label">Email</label>
			<input class="input" name="caEmail" type="email" value="${escapeHtml(data.email)}" />
		</div>
		<div class="form__row">
			<label class="label">Affiliation</label>
			<input class="input" name="caAffiliation" value="${escapeHtml(data.affiliation)}" />
		</div>
		<div>
			<button class="btn btn--ghost" type="button" data-action="remove-coauthor">Remove</button>
		</div>
	`;
	wrap.appendChild(row);
}

function validateStep(step) {
	const panel = $(`.wizard__panel[data-panel='${step}']`);
	const required = $$(`[required]`, panel);
	for (const el of required) {
		if (!el.value || !String(el.value).trim()) {
			toast("error", "Validation", "Please complete required fields.");
			el.focus();
			return false;
		}
	}
	if (step === 2) {
		const body = $("#wBody").value.trim();
		if (body.length < 100) {
			toast("error", "Validation", "Abstract body must be at least 100 characters.");
			$("#wBody").focus();
			return false;
		}
	}
	return true;
}

function wizardSaveDraft({ silent = false } = {}) {
	const user = getSessionUser();
	if (!requireRole(user, ["author"])) return;

	const data = wizardGetData();

	// minimum check: allow empty drafts, but keep presenter email reasonable
	if (data.presenter.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.presenter.email)) {
		if (!silent) toast("error", "Draft not saved", "Presenter email is invalid.");
		return;
	}

	let abs;
	if (wizard.editingAbstractId) {
		abs = state.abstracts.find((a) => a.id === wizard.editingAbstractId);
		if (!abs) return;
		Object.assign(abs, data);
		abs.updatedAt = nowIso();
		audit("abstract.draft_updated", abs.id, `title=${abs.title}`);
	} else {
		abs = {
			id: uid("abs"),
			authorId: user.id,
			status: "Draft",
			createdAt: nowIso(),
			updatedAt: nowIso(),
			submittedAt: null,
			assignments: [],
			reviews: [],
			...data,
		};
		state.abstracts.unshift(abs);
		wizard.editingAbstractId = abs.id;
		audit("abstract.draft_created", abs.id, `title=${abs.title}`);
	}

	saveState(state);
	$("#wizardStatus").textContent = abs.status;
	if (!silent) toast("success", "Saved", "Draft saved.");
	renderAuthorSubmissions();
}

function wizardSubmit() {
	const user = getSessionUser();
	if (!requireRole(user, ["author"])) return;

	// validate all steps
	for (let s = 0; s <= 6; s++) {
		if (!validateStep(s)) {
			wizard.step = s;
			renderWizard();
			return;
		}
	}

	wizardSaveDraft({ silent: true });
	const abs = state.abstracts.find((a) => a.id === wizard.editingAbstractId);
	if (!abs) return;

	abs.status = "Submitted";
	abs.submittedAt = nowIso();
	abs.updatedAt = nowIso();

	// Backend required:
	// - Status transition validation
	// - Screening steps
	// - Email notifications
	// - Server-side queueing

	audit("abstract.submitted", abs.id, `track=${abs.track}`);
	notify("Abstract submitted", `“${abs.title}” submitted successfully.`);
	toast("success", "Submission complete", "Your abstract has been submitted.");

	saveState(state);
	navigate("author-submissions");
}

// ------------------------
// Reviewer queue + reviews
// ------------------------

let reviewContext = { abstractId: null };

function reviewerAssignedAbstracts(user) {
	return state.abstracts.filter((a) => a.assignments?.some((x) => x.reviewerId === user.id));
}

function renderReviewerQueue() {
	const user = getSessionUser();
	if (!requireRole(user, ["reviewer", "admin"])) return;

	const q = $("#reviewerSearch").value.trim().toLowerCase();
	const status = $("#reviewerStatusFilter").value;

	let rows = reviewerAssignedAbstracts(user);
	if (status) rows = rows.filter((a) => a.status === status);
	if (q) rows = rows.filter((a) => `${a.title} ${a.track} ${a.keywords}`.toLowerCase().includes(q));

	const tbody = $("#reviewerQueueTbody");
	tbody.innerHTML = "";
	$("#reviewerQueueEmpty").classList.toggle("hidden", rows.length > 0);

	for (const a of rows.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))) {
		const myReviewDone = a.reviews.some((r) => r.reviewerId === user.id);
		const due = a.assignments.find((x) => x.reviewerId === user.id)?.dueAt;
		const tr = document.createElement("tr");
		tr.innerHTML = `
			<td>${escapeHtml(a.title)}</td>
			<td>${escapeHtml(a.track)}</td>
			<td><span class="pill">${escapeHtml(a.status)}</span></td>
			<td class="muted">${escapeHtml(due ? utcPretty(due) : "-")}</td>
			<td style="text-align:right">
				${myReviewDone ? `<span class="pill pill--green">Reviewed</span>` : `<button class="btn btn--primary" data-action="open-review" data-id="${a.id}">Review</button>`}
			</td>
		`;
		tbody.appendChild(tr);
	}
}

function openReviewModal(abstractId) {
	const user = getSessionUser();
	if (!requireRole(user, ["reviewer", "admin"])) return;
	const a = state.abstracts.find((x) => x.id === abstractId);
	if (!a) return;

	// RBAC: reviewer can only open assigned
	if (!a.assignments.some((x) => x.reviewerId === user.id)) {
		toast("error", "Access denied", "This abstract is not assigned to you.");
		return;
	}

	// Independence: never show other reviewer content
	reviewContext.abstractId = a.id;

	$("#reviewAbstractMeta").textContent = `${a.track} • ${a.category} • Status: ${a.status}`;
	$("#reviewAbstractBody").textContent = a.body;

	$("#formReview").reset();
	openModal("modalReview");
}

function submitReview(formData) {
	const user = getSessionUser();
	if (!requireRole(user, ["reviewer", "admin"])) return;

	const a = state.abstracts.find((x) => x.id === reviewContext.abstractId);
	if (!a) return;
	if (!a.assignments.some((x) => x.reviewerId === user.id)) return;
	if (a.reviews.some((r) => r.reviewerId === user.id)) {
		toast("error", "Already submitted", "You already submitted a review for this abstract.");
		return;
	}

	const s = (name) => Number(formData.get(name));
	const review = {
		id: uid("rev"),
		reviewerId: user.id,
		at: nowIso(),
		scores: {
			originality: s("originality"),
			quality: s("quality"),
			relevance: s("relevance"),
			clarity: s("clarity"),
			methodology: s("methodology"),
		},
		comments: {
			originality: String(formData.get("originalityComment") ?? ""),
			quality: String(formData.get("qualityComment") ?? ""),
			relevance: String(formData.get("relevanceComment") ?? ""),
			clarity: String(formData.get("clarityComment") ?? ""),
			methodology: String(formData.get("methodologyComment") ?? ""),
			overall: $("#reviewOverallComment").value.trim(),
		},
		recommendation: $("#reviewRecommendation").value,
	};
	const total = Object.values(review.scores).reduce((sum, v) => sum + (Number(v) || 0), 0);
	review.totalScore = total;

	a.reviews.push(review);
	a.updatedAt = nowIso();

	// Workflow: if submitted and assigned, move to Under Review.
	if (["Submitted", "Under Screening"].includes(a.status)) a.status = "Under Review";

	audit("review.submitted", a.id, `reviewer=${user.email}; total=${total}; rec=${review.recommendation}`);
	toast("success", "Review submitted", "Your review has been recorded.");

	// Backend required:
	// - Locking + integrity checks
	// - Reminder scheduling for inactivity (48h)
	// - Notification emails

	saveState(state);
	closeModal();
	renderReviewerQueue();
	renderDashboard();
}

// ------------------------
// Admin views
// ------------------------

let adminContext = { abstractId: null };

function renderAdminAbstracts() {
	const user = getSessionUser();
	if (!requireRole(user, ["admin"])) return;

	// status filters
	const sel = $("#adminStatus");
	if (!sel.dataset.bound) {
		sel.innerHTML = `<option value="">All statuses</option>` + STATUSES.map((s) => `<option>${escapeHtml(s)}</option>`).join("");
		sel.dataset.bound = "1";
	}

	const q = $("#adminSearch").value.trim().toLowerCase();
	const status = sel.value;
	const track = $("#adminTrack").value;
	const from = $("#adminFrom").value;
	const to = $("#adminTo").value;

	let rows = state.abstracts.slice();
	if (status) rows = rows.filter((a) => a.status === status);
	if (track) rows = rows.filter((a) => a.track === track);
	if (from) rows = rows.filter((a) => a.updatedAt.slice(0, 10) >= from);
	if (to) rows = rows.filter((a) => a.updatedAt.slice(0, 10) <= to);
	if (q) rows = rows.filter((a) => {
		const author = state.users.find((u) => u.id === a.authorId);
		const reviewers = (a.assignments ?? []).map((x) => state.users.find((u) => u.id === x.reviewerId)?.email).join(" ");
		return `${a.title} ${a.track} ${a.keywords} ${author?.email ?? ""} ${reviewers}`.toLowerCase().includes(q);
	});

	const tbody = $("#adminAbstractsTbody");
	tbody.innerHTML = "";
	$("#adminAbstractsEmpty").classList.toggle("hidden", rows.length > 0);

	for (const a of rows.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))) {
		const author = state.users.find((u) => u.id === a.authorId);
		const tr = document.createElement("tr");
		const reviewCount = `${a.reviews.length}/2`;
		tr.innerHTML = `
			<td>${escapeHtml(a.title || "(Untitled)")}</td>
			<td class="muted">${escapeHtml(author?.email ?? "-")}</td>
			<td>${escapeHtml(a.track || "-")}</td>
			<td><span class="pill">${escapeHtml(a.status)}</span></td>
			<td>${escapeHtml(reviewCount)}</td>
			<td class="muted">${escapeHtml(utcPretty(a.updatedAt))}</td>
			<td style="text-align:right"><button class="btn btn--outline" data-action="open-admin-abstract" data-id="${a.id}">Open</button></td>
		`;
		tbody.appendChild(tr);
	}
}

function openAdminAbstractModal(abstractId) {
	const user = getSessionUser();
	if (!requireRole(user, ["admin"])) return;
	const a = state.abstracts.find((x) => x.id === abstractId);
	if (!a) return;
	adminContext.abstractId = a.id;

	const author = state.users.find((u) => u.id === a.authorId);
	const assignmentEmails = (a.assignments ?? []).map((as) => state.users.find((u) => u.id === as.reviewerId)?.email ?? "-");

	$("#adminAbstractDetails").innerHTML = `
		<div class="details__row"><div class="details__key">Title</div><div class="details__val">${escapeHtml(a.title)}</div></div>
		<div class="details__row"><div class="details__key">Author</div><div class="details__val">${escapeHtml(author?.email ?? "-")}</div></div>
		<div class="details__row"><div class="details__key">Track</div><div class="details__val">${escapeHtml(a.track)} / ${escapeHtml(a.category)}</div></div>
		<div class="details__row"><div class="details__key">Status</div><div class="details__val">${escapeHtml(a.status)}</div></div>
		<div class="details__row"><div class="details__key">Assigned reviewers</div><div class="details__val">${escapeHtml(assignmentEmails.join(", ") || "None")}</div></div>
		<div class="details__row"><div class="details__key">Reviews completed</div><div class="details__val">${escapeHtml(String(a.reviews.length))}/2</div></div>
		<div class="details__row"><div class="details__key">Updated</div><div class="details__val">${escapeHtml(utcPretty(a.updatedAt))}</div></div>
		<div class="callout" style="margin-top:10px"><strong>Abstract body</strong><div class="muted" style="white-space:pre-wrap;margin-top:8px">${escapeHtml(a.body)}</div></div>
	`;

	// populate status dropdown
	const sel = $("#adminStatusUpdate");
	sel.innerHTML = STATUSES.map((s) => `<option ${s === a.status ? "selected" : ""}>${escapeHtml(s)}</option>`).join("");
	$("#adminDecisionNote").value = "";

	openModal("modalAdminAbstract");
}

function adminSaveStatus() {
	const user = getSessionUser();
	if (!requireRole(user, ["admin"])) return;
	const a = state.abstracts.find((x) => x.id === adminContext.abstractId);
	if (!a) return;
	const newStatus = $("#adminStatusUpdate").value;
	const note = $("#adminDecisionNote").value.trim();

	// backend required: enforce valid transitions + comms to authors
	const old = a.status;
	a.status = newStatus;
	a.updatedAt = nowIso();
	audit("abstract.status_changed", a.id, `${old} -> ${newStatus}; note=${note}`);
	toast("success", "Status updated", `${old} → ${newStatus}`);

	saveState(state);
	closeModal();
	renderAdminAbstracts();
	renderDashboard();
}

function renderAdminReviewers() {
	const user = getSessionUser();
	if (!requireRole(user, ["admin"])) return;

	const reviewers = state.users.filter((u) => ["reviewer", "admin"].includes(u.role));
	const tbody = $("#adminReviewersTbody");
	tbody.innerHTML = "";

	for (const r of reviewers) {
		const assigned = state.abstracts.filter((a) => a.assignments?.some((x) => x.reviewerId === r.id)).length;
		const tr = document.createElement("tr");
		tr.innerHTML = `
			<td>${escapeHtml(r.name)}</td>
			<td class="muted">${escapeHtml(r.email)}</td>
			<td>${escapeHtml((r.reviewer?.expertise ?? []).join(", ") || "-")}</td>
			<td>${escapeHtml(r.reviewer?.availability ?? "-")}</td>
			<td>${escapeHtml(String(assigned))}</td>
			<td style="text-align:right"><button class="btn btn--ghost" data-action="noop">Manage</button></td>
		`;
		tbody.appendChild(tr);
	}

	// workload panel
	const panel = $("#reviewerWorkload");
	if (!reviewers.length) {
		panel.className = "empty";
		panel.textContent = "No reviewers.";
		return;
	}
	panel.className = "";
	panel.innerHTML = reviewers.map((r) => {
		const assigned = state.abstracts.filter((a) => a.assignments?.some((x) => x.reviewerId === r.id)).length;
		const pending = state.abstracts.filter((a) => a.assignments?.some((x) => x.reviewerId === r.id) && !a.reviews.some((rv) => rv.reviewerId === r.id)).length;
		return `<div class="details__row"><div><div class="details__val">${escapeHtml(r.name)}</div><div class="details__key">Expertise: ${escapeHtml((r.reviewer?.expertise ?? []).join(", ") || "-")}</div></div><div style="text-align:right"><span class="pill pill--blue">Assigned: ${assigned}</span> <span class="pill pill--yellow">Pending: ${pending}</span></div></div>`;
	}).join("");
}

function autoAssignReviewers() {
	const user = getSessionUser();
	if (!requireRole(user, ["admin"])) return;

	const reviewers = state.users.filter((u) => u.role === "reviewer" || u.role === "admin");
	if (reviewers.length < 2) {
		toast("error", "Not enough reviewers", "Need at least 2 reviewers in the system.");
		return;
	}

	const candidates = reviewers.filter((r) => (r.reviewer?.availability ?? "Available") !== "Unavailable");
	if (candidates.length < 2) {
		toast("error", "No eligible reviewers", "All reviewers are unavailable.");
		return;
	}

	let changed = 0;
	for (const a of state.abstracts) {
		if (a.status === "Draft") continue;
		const assigned = a.assignments ?? [];
		if (assigned.length >= 2) continue;

		const need = 2 - assigned.length;
		const chosen = pickReviewersForAbstract(a, candidates, need);
		for (const r of chosen) {
			assigned.push({ reviewerId: r.id, assignedAt: nowIso(), dueAt: dueInDays(7) });
			changed++;
			audit("reviewer.assigned", a.id, `reviewer=${r.email}`);
		}
		a.assignments = assigned;
		if (["Submitted", "Under Screening"].includes(a.status)) a.status = "Under Review";
		a.updatedAt = nowIso();
	}

	saveState(state);
	toast("success", "Auto-assignment complete", `Created ${changed} new assignment(s).`);
	renderAdminAbstracts();
	renderAdminReviewers();
	renderDashboard();
}

function pickReviewersForAbstract(abstract, reviewers, need) {
	// Simple heuristic:
	// 1) match expertise to track
	// 2) avoid same affiliation as author (basic COI)
	// 3) balance workload (least assigned)

	const author = state.users.find((u) => u.id === abstract.authorId);
	const authorAff = author?.profile?.affiliation ?? abstract.presenter?.affiliation ?? "";
	const already = new Set((abstract.assignments ?? []).map((x) => x.reviewerId));

	const eligible = reviewers.filter((r) => {
		if (already.has(r.id)) return false;
		const coiAff = new Set([...(r.coi?.affiliations ?? [])]);
		if (authorAff && coiAff.has(authorAff)) return false;
		return true;
	});

	const scored = eligible.map((r) => {
		const expertise = new Set(r.reviewer?.expertise ?? []);
		const match = expertise.has(abstract.track) ? 1 : 0;
		const workload = state.abstracts.filter((a) => a.assignments?.some((x) => x.reviewerId === r.id)).length;
		return { r, match, workload };
	});

	scored.sort((a, b) => {
		if (b.match !== a.match) return b.match - a.match;
		return a.workload - b.workload;
	});

	return scored.slice(0, need).map((x) => x.r);
}

function renderAdminAnalytics() {
	const user = getSessionUser();
	if (!requireRole(user, ["admin"])) return;

	const abstracts = state.abstracts;
	const total = abstracts.length;
	const pendingReviews = abstracts.filter((a) => (a.assignments?.length ?? 0) > 0 && (a.reviews?.length ?? 0) < 2).length;
	const completion = completionRate(abstracts);
	const avgTurnaround = averageReviewTurnaroundDays(abstracts);
	const accept = acceptanceRate(abstracts);

	const cards = $("#analyticsCards");
	cards.innerHTML = "";
	const metrics = [
		{ label: "Total submitted abstracts", value: total },
		{ label: "Pending reviews", value: pendingReviews },
		{ label: "Review completion rate", value: `${completion}%` },
		{ label: "Avg. review turnaround", value: avgTurnaround ? `${avgTurnaround.toFixed(1)} days` : "-" },
		{ label: "Acceptance rate", value: `${accept}%` },
	];

	for (const m of metrics) {
		const el = document.createElement("div");
		el.className = "card";
		el.innerHTML = `<div class="muted small">${escapeHtml(m.label)}</div><div style="font-size:26px;font-weight:850;margin-top:10px">${escapeHtml(m.value)}</div>`;
		cards.appendChild(el);
	}

	// reviewer distribution
	const reviewers = state.users.filter((u) => ["reviewer", "admin"].includes(u.role));
	const dist = reviewers.map((r) => {
		const assigned = abstracts.filter((a) => a.assignments?.some((x) => x.reviewerId === r.id)).length;
		return { name: r.name, assigned };
	}).sort((a, b) => b.assigned - a.assigned);

	const distEl = $("#analyticsReviewerDist");
	if (!dist.length) {
		distEl.className = "empty";
		distEl.textContent = "No reviewers.";
	} else {
		distEl.className = "";
		distEl.innerHTML = dist.map((d) => `<div class="details__row"><div class="details__val">${escapeHtml(d.name)}</div><div><span class="pill pill--blue">Assigned: ${d.assigned}</span></div></div>`).join("");
	}

	// decision trends
	const trendsEl = $("#analyticsDecisionTrends");
	const counts = { Accept: 0, "Minor Revision": 0, "Major Revision": 0, Reject: 0 };
	for (const a of abstracts) {
		for (const r of a.reviews ?? []) {
			if (counts[r.recommendation] !== undefined) counts[r.recommendation]++;
		}
	}
	const sum = Object.values(counts).reduce((s, v) => s + v, 0);
	if (!sum) {
		trendsEl.className = "empty";
		trendsEl.textContent = "No review recommendations yet.";
	} else {
		trendsEl.className = "";
		trendsEl.innerHTML = Object.entries(counts)
			.map(([k, v]) => `<div class="details__row"><div class="details__val">${escapeHtml(k)}</div><div><span class="pill">${v}</span></div></div>`)
			.join("");
	}
}

function averageReviewTurnaroundDays(abstracts) {
	const vals = [];
	for (const a of abstracts) {
		for (const r of a.reviews ?? []) {
			const assignedAt = a.assignments?.find((x) => x.reviewerId === r.reviewerId)?.assignedAt;
			if (!assignedAt) continue;
			const days = (new Date(r.at) - new Date(assignedAt)) / (1000 * 60 * 60 * 24);
			if (Number.isFinite(days) && days >= 0) vals.push(days);
		}
	}
	if (!vals.length) return null;
	return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function renderAudit() {
	const user = getSessionUser();
	if (!requireRole(user, ["admin"])) return;
	const tbody = $("#auditTbody");
	tbody.innerHTML = "";
	$("#auditEmpty").classList.toggle("hidden", state.audit.length > 0);
	for (const e of state.audit.slice(0, 200)) {
		const tr = document.createElement("tr");
		tr.innerHTML = `
			<td class="muted">${escapeHtml(utcPretty(e.at))}</td>
			<td>${escapeHtml(e.actor)}</td>
			<td>${escapeHtml(e.action)}</td>
			<td class="muted">${escapeHtml(e.target)}</td>
			<td class="muted">${escapeHtml(e.details)}</td>
		`;
		tbody.appendChild(tr);
	}
}

function renderNotifications() {
	const list = $("#notificationsList");
	if (!list) return;
	list.innerHTML = "";
	const items = state.notifications.slice(0, 50);
	if (!items.length) {
		list.innerHTML = `<div class="empty">No notifications.</div>`;
		return;
	}
	for (const n of items) {
		const el = document.createElement("div");
		el.className = "notification";
		el.innerHTML = `<div class="notification__title">${escapeHtml(n.title)}</div><div class="muted">${escapeHtml(n.body)}</div><div class="notification__meta">${escapeHtml(utcPretty(n.at))}</div>`;
		list.appendChild(el);
	}
}

function renderAll() {
	renderDashboard();
	renderProfile();
	renderAuthorSubmissions();
	renderWizard();
	renderReviewerQueue();
	renderAdminAbstracts();
	renderAdminReviewers();
	renderAdminAnalytics();
	renderAudit();
	renderNotifications();
}

// ------------------------
// CSV export helpers
// ------------------------

function toCsv(rows) {
	const esc = (v) => {
		const s = String(v ?? "");
		if (/[\n\r,\"]/g.test(s)) return `"${s.replaceAll('"', '""')}"`;
		return s;
	};
	return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

function downloadTextFile(filename, content, mime = "text/plain") {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function exportAbstractsCsv() {
	const rows = [[
		"id",
		"title",
		"track",
		"status",
		"authorEmail",
		"reviewsCompleted",
		"submittedAt",
		"updatedAt",
	]];
	for (const a of state.abstracts) {
		const author = state.users.find((u) => u.id === a.authorId);
		rows.push([
			a.id,
			a.title,
			a.track,
			a.status,
			author?.email ?? "",
			`${a.reviews.length}/2`,
			a.submittedAt ?? "",
			a.updatedAt,
		]);
	}
	downloadTextFile("abstracts_export.csv", toCsv(rows), "text/csv");
}

// ------------------------
// Modals
// ------------------------

function openModal(id) {
	$("#modalBackdrop").classList.remove("hidden");
	$(`#${id}`).classList.remove("hidden");
	$(`#${id}`).dataset.open = "1";
}

function closeModal() {
	$("#modalBackdrop").classList.add("hidden");
	$$(".modal").forEach((m) => {
		m.classList.add("hidden");
		delete m.dataset.open;
	});
	reviewContext.abstractId = null;
	adminContext.abstractId = null;
}

function openNotifications() {
	$("#notificationsPanel").classList.remove("hidden");
}
function closeNotifications() {
	$("#notificationsPanel").classList.add("hidden");
}

// ------------------------
// Events
// ------------------------

function bindEvents() {
	window.addEventListener("hashchange", enforceRoute);

	// Sidebar navigation
	$$(".nav__item").forEach((a) =>
		a.addEventListener("click", (e) => {
			e.preventDefault();
			navigate(a.dataset.route);
		}),
	);

	// Auth
	$("#btnShowRegister").addEventListener("click", () => openModal("modalRegister"));
	$("#btnShowReset").addEventListener("click", () => openModal("modalReset"));
	$$("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModal));
	$("#modalBackdrop").addEventListener("click", closeModal);

	$("#formLogin").addEventListener("submit", (e) => {
		e.preventDefault();
		const email = $("#loginEmail").value.trim().toLowerCase();
		const password = $("#loginPassword").value;

		// Backend required:
		// - rate limiting, account lockout, MFA, secure cookies
		// - password hashing (argon2/bcrypt)
		// - CSRF protection
		// - server-side RBAC

		const user = state.users.find((u) => u.email.toLowerCase() === email);
		if (!user || user.password !== password) {
			toast("error", "Sign in failed", "Invalid email or password.");
			return;
		}
		state.session = { userId: user.id, createdAt: nowIso() };
		saveState(state);
		audit("auth.login", user.id, `email=${user.email}`);
		setShellForUser(user);
		navigate("dashboard");
	});

	$("#formRegister").addEventListener("submit", (e) => {
		e.preventDefault();
		const role = $("#regRole").value;
		const email = $("#regEmail").value.trim().toLowerCase();
		const name = $("#regName").value.trim();
		const password = $("#regPassword").value;
		if (state.users.some((u) => u.email.toLowerCase() === email)) {
			toast("error", "Registration failed", "Email already exists.");
			return;
		}
		const u = {
			id: uid("u"),
			role,
			email,
			name,
			password,
			profile: { affiliation: "", phone: "", country: "", orcid: "" },
		};
		if (role === "reviewer") {
			u.reviewer = { expertise: [], availability: "Available" };
			u.coi = { affiliations: [], authors: [] };
		}
		state.users.push(u);
		saveState(state);
		audit("auth.register", u.id, `role=${role}; email=${email}`);
		toast("success", "Account created", "You can now sign in.");
		closeModal();
	});

	$("#formReset").addEventListener("submit", (e) => {
		e.preventDefault();
		toast("success", "Reset requested", "Backend required to send reset email securely.");
		closeModal();
	});

	$("#btnLogout").addEventListener("click", () => {
		const user = getSessionUser();
		state.session = null;
		saveState(state);
		if (user) audit("auth.logout", user.id, "");
		setShellForUser(null);
		navigate("auth");
	});

	// Notifications
	$("#btnOpenNotifications").addEventListener("click", openNotifications);
	$("#btnCloseNotifications").addEventListener("click", closeNotifications);

	// Profile save
	$("#formProfile").addEventListener("submit", (e) => {
		e.preventDefault();
		const user = getSessionUser();
		if (!user) return;
		user.name = $("#profileName").value.trim();
		user.profile.affiliation = $("#profileAffiliation").value.trim();
		user.profile.phone = $("#profilePhone").value.trim();
		user.profile.country = $("#profileCountry").value.trim();
		user.profile.orcid = $("#profileOrcid").value.trim();
		saveState(state);
		audit("profile.updated", user.id, "");
		toast("success", "Saved", "Profile updated.");
		setShellForUser(user);
	});

	$("#btnChangePassword").addEventListener("click", () => {
		toast("error", "Backend required", "Implement password change securely server-side.");
	});

	// Author: new submission
	$("#btnAuthorNew").addEventListener("click", () => {
		resetWizard();
		loadWizardFromProfile();
		navigate("author-new");
	});
	$("#btnQuickNewAbstract").addEventListener("click", () => {
		resetWizard();
		loadWizardFromProfile();
		navigate("author-new");
	});

	// Wizard controls
	$$(".wizard__step").forEach((b) =>
		b.addEventListener("click", () => {
			const target = Number(b.dataset.step);
			// prevent skipping past required fields
			for (let s = 0; s < target; s++) {
				if (!validateStep(s)) return;
			}
			wizard.step = clamp(target, 0, 7);
			renderWizard();
		}),
	);

	$("#btnPrev").addEventListener("click", () => {
		wizard.step = clamp(wizard.step - 1, 0, 7);
		renderWizard();
	});
	$("#btnNext").addEventListener("click", () => {
		if (!validateStep(wizard.step)) return;
		wizard.step = clamp(wizard.step + 1, 0, 7);
		renderWizard();
	});
	$("#btnBackToEdit").addEventListener("click", () => {
		wizard.step = 0;
		renderWizard();
	});
	$("#btnSaveDraft").addEventListener("click", () => wizardSaveDraft());
	$("#btnExitWizard").addEventListener("click", () => navigate("author-submissions"));
	$("#btnAddCoAuthor").addEventListener("click", () => addCoAuthorRow());
	$("#coAuthorsList").addEventListener("click", (e) => {
		const btn = e.target.closest("[data-action]");
		if (!btn) return;
		if (btn.dataset.action === "remove-coauthor") btn.closest(".coauthor").remove();
	});
	$("#btnSubmitAbstract").addEventListener("click", wizardSubmit);

	// Autosave drafts after input activity
	$("#formWizard").addEventListener("input", () => {
		if (wizard.autosaveTimer) clearTimeout(wizard.autosaveTimer);
		wizard.autosaveTimer = setTimeout(() => wizardSaveDraft({ silent: true }), 800);
	});

	// Filters
	$("#authorSearch").addEventListener("input", renderAuthorSubmissions);
	$("#authorStatusFilter").addEventListener("change", renderAuthorSubmissions);
	$("#reviewerSearch").addEventListener("input", renderReviewerQueue);
	$("#reviewerStatusFilter").addEventListener("change", renderReviewerQueue);

	$("#adminSearch").addEventListener("input", renderAdminAbstracts);
	$("#adminStatus").addEventListener("change", renderAdminAbstracts);
	$("#adminTrack").addEventListener("change", renderAdminAbstracts);
	$("#adminFrom").addEventListener("change", renderAdminAbstracts);
	$("#adminTo").addEventListener("change", renderAdminAbstracts);

	// Admin actions
	$("#btnAdminAssignAuto").addEventListener("click", autoAssignReviewers);
	$("#btnAdminBulkNotify").addEventListener("click", () => toast("error", "Backend required", "Bulk notifications should be sent server-side."));
	$("#btnAdminExport").addEventListener("click", exportAbstractsCsv);
	$("#btnQuickExport").addEventListener("click", exportAbstractsCsv);

	$("#formAdminDecision").addEventListener("submit", (e) => {
		e.preventDefault();
		adminSaveStatus();
	});
	$("#btnAdminReassign").addEventListener("click", () => toast("error", "Backend required", "Manual reassignment should be validated server-side."));

	$("#btnAddReviewer").addEventListener("click", () => toast("error", "Prototype", "Add reviewer UI can be implemented here (server-side in production)."));

	$("#btnClearAudit").addEventListener("click", () => {
		state.audit = [];
		saveState(state);
		renderAudit();
		toast("success", "Cleared", "Audit trail cleared (demo only).");
	});

	// Global click handler for table actions
	document.body.addEventListener("click", (e) => {
		const btn = e.target.closest("[data-action]");
		if (!btn) return;
		const action = btn.dataset.action;
		const id = btn.dataset.id;

		if (action === "edit-abstract") {
			startEditAbstract(id);
		}
		if (action === "view-abstract") {
			toast("success", "Info", "In production, open a read-only details view." );
		}
		if (action === "open-review") {
			openReviewModal(id);
		}
		if (action === "open-admin-abstract") {
			openAdminAbstractModal(id);
		}
	});

	// Review form submit
	$("#formReview").addEventListener("submit", (e) => {
		e.preventDefault();
		const fd = new FormData(e.target);
		submitReview(fd);
	});

	// Close modals on Escape
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeModal();
			closeNotifications();
		}
	});
}

function startEditAbstract(abstractId) {
	const user = getSessionUser();
	if (!requireRole(user, ["author"])) return;
	const a = state.abstracts.find((x) => x.id === abstractId);
	if (!a || a.authorId !== user.id) return;
	if (a.status !== "Draft") {
		toast("error", "Not editable", "Only drafts can be edited in this demo." );
		return;
	}
	resetWizard();
	wizard.editingAbstractId = a.id;
	$("#wProfileName").value = a.presenter?.name ?? "";
	$("#wProfileAffiliation").value = a.presenter?.affiliation ?? "";
	$("#wProfileEmail").value = a.presenter?.email ?? "";
	$("#wProfileOrcid").value = a.presenter?.orcid ?? "";
	$("#wTitle").value = a.title ?? "";
	$("#wBody").value = a.body ?? "";
	$("#wKeywords").value = a.keywords ?? "";
	$("#wTrack").value = a.track ?? "";
	$("#wCategory").value = a.category ?? "";
	$("#coAuthorsList").innerHTML = "";
	for (const ca of a.coAuthors ?? []) addCoAuthorRow(ca);
	$("#wizardStatus").textContent = a.status;
	navigate("author-new");
}

// ------------------------
// Init
// ------------------------

function init() {
	bindEvents();
	const user = getSessionUser();
	setShellForUser(user);
	enforceRoute();

	// populate admin status update select (modal)
	$("#adminStatusUpdate").innerHTML = STATUSES.map((s) => `<option>${escapeHtml(s)}</option>`).join("");
}

init();
