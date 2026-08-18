# AccomplishPro Design System

## Product direction

AccomplishPro is an independent productivity tool built for a local-government reporting workflow. It must not imply government ownership, endorsement, or affiliation. The interface should feel dependable, calm, precise, and welcoming without competing with the report itself.

## Visual language

- Style: clean editorial dashboard with restrained depth and a document-first workspace.
- Primary: civic navy `#0C2742`; action blue `#155C8C`; coastal teal `#17766D`; gold highlight `#C38B2C`.
- Surfaces: warm off-white application background `#F5F4EF`, white cards, blue-gray borders.
- Typography: Poppins for headings, labels, and controls; Questrial for readable interface copy; Times New Roman for the document preview/export.
- Radius: 10–16px for app surfaces, 8–10px for fields, square edges for the report paper.
- Elevation: mostly border-defined surfaces; stronger shadow only for modals and the paper preview.

## Interaction rules

- All fields have persistent labels and nearby error/helper text.
- Touch targets are at least 44px; focus indicators are visible and keyboard navigation follows reading order.
- The editor and report preview appear side-by-side on large screens and stack on smaller screens.
- Motion stays within 150–250ms and is disabled for `prefers-reduced-motion`.
- AI actions explain what Gemini will change and never overwrite user data without review.
- Saving, loading, export, success, and failure always show explicit feedback.
- Small report totals read as a single human sentence; avoid repeated icon cards for low-density summary data.

## Report document rules

- The preview is white, print-oriented, and visually separate from the application UI.
- The government header, Boac seal, office, report title, reporting period, DATE/DESCRIPTION/UNITS table, and signatories mirror the supplied workbook.
- Dates are grouped visually, descriptions are wrapped, units remain centered, and exported spreadsheets use portrait A4 with a one-page-wide print area.
