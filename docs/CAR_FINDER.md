# REVV Smart Car Finder — implementation and verification

Date: 25 November 2026. Scoring version: 2.0.

## Delivered

The local `/ai-car-finder` page uses `POST /api/v1/recommendations/cars`. It ranks existing active public listings, uses existing uploaded listing photos, and links to existing vehicle details. No vehicle, account, message, offer or watchlist records are created or changed. Existing security work is preserved. No commit or push was made.

Advanced controls include adjustable criterion importance, manufacturer/fuel exclusions, minimum seating, explicit must-have filters, optional hiding of marked demo listings, sorting, budget ranges and up to three vehicles compared side by side. Empty results offer explicit preference adjustments; hard limits are never silently relaxed. Near matches are opt-in, separate and at most 10% over budget, with the exact excess shown.

## Evidence-based scoring

Supported fit = 100 × earned weighted points / all selected criterion weights. Unknown information earns no supported points but remains explicitly unknown, rather than being described as a defect. Evidence coverage is the proportion of selected weight with recorded data. Fit on recorded criteria is also available in the expanded explanation. Each criterion returns its weight, weight share, fit, status, explanation and score contribution.

Base weights: budget 3; manufacturer, model, body, fuel and seating 2; kilometres, transmission and drivetrain 1.5; minimum year and location 1. User criterion importance scales these by 0.5, 1 or 1.5. Personal preference weights are 2 × importance (1–3). Family practicality uses listed seating only; family and seating overlap is combined into one criterion. Reliability, performance, economy, luxury and ownership cost stay unknown because this database does not provide sufficient verified evidence. There are no brand-based quality assumptions.

Budget is fully matched within the ceiling; optional over-budget fit decreases linearly to zero at 10% excess. Year preference loses 10 percentage points per year below the selected minimum. Mileage preference decreases linearly with excess relative to max(preferred kilometres, 10,000). Categorical preferences match exactly, models normalize hyphens/spaces and the demo suffix, and location uses case-insensitive substring matching. Default ties resolve by evidence coverage, price, year, kilometres and ID. Alternative sorts use price/year/kilometres first, with deterministic matching ties.

## Free architecture and limitations

`REVV_AI_PROVIDER=rules` selects a deterministic interpreter through a provider interface. No AI SDK, paid API, external model or buyer-profile storage is used. Unsupported providers fail closed with 503. Tests block outbound socket/URL connections for recommendation execution.

Text parsing supports a maintained subset of makes/models, NZ locations, vehicle attributes, currency/budget ranges, kilometres, minimum years and seating phrases. Required seating can become a hard limit. Most text preferences remain soft; users can explicitly mark structured filters mandatory. Filled-in form values take precedence. Structured exclusions override inferred preferences. Negated/ambiguous language is surfaced for review rather than guessed. Review interpreted preferences or use explicit controls for exact requirements. The European brand group is curated and non-exhaustive; it is not a manufacturing-origin claim.

The endpoint validates lengths, enums, ranges and conflicting exclusions, applies the existing shared 30/minute IP rate limiter and origin protections, uses parameterized SQLAlchemy queries, exposes only public listing fields and excludes drafts/deleted entries and their photos. Photo identifiers must match existing canonical upload names. Searches consider at most 2,000 eligible candidates with a disclosed truncation note, a two-second database statement timeout and bounded selected-image queries. Ranking is therefore not exhaustive above that cap. Consider database search/index tuning before a large production catalogue.

## Validation

- Backend: **140 tests passed**, including the existing 77 security regression cases and 63 finder cases. Tests use connection-local PostgreSQL temporary tables, never production rows.
- TypeScript: **passed** (`npx tsc --noEmit`). Removed duplicate `* 2.ts` generated files in `.next/types`, which had caused a duplicate LayoutProps diagnostic; no source typing was suppressed.
- Next.js production build: **passed**, `/ai-car-finder` generated successfully. The existing homepage dynamic-render diagnostic does not fail the build.
- Scoped ESLint: **0 errors**, one existing Navbar logout navigation warning. Checked finder page, SmartCarFinder, RecommendationCard, VehicleComparison and Navbar.
- Full-project ESLint: **25 existing errors and 2 warnings**, largely existing React hooks/hero components and unescaped text. These are unresolved; unrelated marketplace and hero files were preserved. The project's installed lint toolchain stalled, so checks used a temporary clean ESLint/Next configuration toolchain, without changing application dependencies.
- Frontend live testing on port 3000: real-listing matching, visible unknown performance evidence, expanded weighted breakdown, changing manufacturer importance, hard BMW exclusion, comparison selection and desktop/mobile dialog verified. At 390px the document width equals the viewport; comparison table intentionally scrolls horizontally.
- Homepage rendering and the existing manufacturer filter verified (BMW returned 4 of 19 listings, with model options populated). Existing vehicle-detail navigation and gallery Next photo verified, advancing from photo 1 to 2 of 5. Earlier finder smoke checks covered missing-budget errors, empty results, mandatory sedan filters and separated over-budget results.

## Modified finder files

- backend/app/recommendations/{schemas,interpreter,engine,__init__}.py
- backend/app/routes/recommendations.py and route registration in backend/app/main.py
- backend/tests/test_recommendations.py and recommendation DB override in conftest.py
- backend/.env.example (rules provider setting)
- frontend/src/app/ai-car-finder/page.tsx
- frontend/src/components/{SmartCarFinder,RecommendationCard,VehicleComparison}.tsx
- frontend/src/components/Navbar.tsx (finder link)
- docs/CAR_FINDER.md

Existing dirty security files are separate baseline work. No database migration, new runtime dependency, global CSS or 3D hero change is required for this feature.

## Remaining recommendations

Populate trustworthy structured performance, equipment, consumption and ownership-cost data before ranking those preferences. Expand the tested model/phrase taxonomy deliberately; unsupported free text is not general language understanding. Seller data and demo markers are not independently verified. Add scheduled browser regression coverage and resolve existing project-wide lint debt separately. This work does not certify all existing marketplace features or production security.
