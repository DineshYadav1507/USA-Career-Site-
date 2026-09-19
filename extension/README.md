# Talent Inspirations Apply Assistant

This MV3 extension is the initial autofill foundation.

1. Load extension/ as an unpacked extension in Chrome.
2. Sign in to Talent Inspirations in the normal website.
3. Copy the user JWT from the browser application storage into the extension popup.
4. Enter the Talent Inspirations job ID.
5. Open the employer application page.
6. Use Fetch package + fill page.

The extension currently fills supported text fields and exposes the tailored package. It does not auto-submit forms. Site-specific resume-file attachment and final submission adapters should be implemented per ATS after testing the target form.