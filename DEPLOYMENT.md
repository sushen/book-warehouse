Book Warehouse uses GitHub Pages for the static application and the existing Firebase staging project for shared data. The GitHub workflow tests and builds dist, including only allowlisted public settings. No credentials or tokens belong in this repository.

The reader catalogue is index.html; admin.html requires a server-validated active admin grant. Drive OAuth additionally requires the GitHub Pages origin in the configured Google client. Local emulator mode is available only on localhost with ?emulator=1.
