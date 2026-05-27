# Conference Abstract Submission & Review Management System (Front-end Prototype)

This is a **modern, responsive, role-based** front-end prototype inspired by professional manuscript systems (Editorial Manager / ScholarOne style UI).

## What’s included
- **Three roles**: Author (Respondent), Reviewer, Administrator
- **Role-based dashboards** + sidebar navigation (client-side RBAC demo)
- **Abstract submission wizard** (multi-step)
	- Profile details
	- Title
	- Body
	- Keywords
	- Track/category
	- Co-authors
	- Optional file selection (metadata only)
	- Final confirmation
	- Autosave draft (localStorage)
	- Validation + progress bar
- **Tracking / statuses**:
	- Draft
	- Submitted
	- Under Screening
	- Under Review
	- Revision Requested
	- Accepted
	- Rejected
	- Scheduled
- **Reviewer workflow**:
	- Review queue shows only assigned abstracts
	- Rubric scoring (1–5) + comments + recommendation
	- Independence: no access to other reviewer scores/comments
- **Administrator features (prototype)**:
	- View/filter all abstracts
	- Auto-assign exactly **two independent reviewers** per abstract (heuristic)
	- Manual status updates + audit trail entries
	- Analytics cards (completion, acceptance, average turnaround)
	- CSV export (browser download)
	- Audit trail view
- **Notifications panel** (in-app; server-side email/SMS requires backend)

## Running locally
Open `index.html` in a browser.

For a simple local server:
- `python -m http.server 8000`
- visit `http://localhost:8000/abstract-system/`

## Demo accounts
- **Admin**: `admin@demo.test` / `Password123`
- **Reviewer**: `reviewer@demo.test` / `Password123`
- **Author**: `author@demo.test` / `Password123`

## Critical backend requirements (for production)
This project is UI-only; to make it **secure and fully functional** you must add a backend for:
- Password hashing (argon2/bcrypt) + account policies
- Sessions (secure cookies), CSRF protection, rate limiting, lockouts
- Real RBAC authorization checks on every request
- Abstract storage + file uploads (virus scanning, size/type limits)
- Reviewer assignment enforcement + conflict of interest rules
- Reminder jobs after **48 hours** inactivity (cron/queue worker)
- Audit trail immutability + reporting exports (CSV/PDF)

