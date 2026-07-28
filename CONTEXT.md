# BTD Battles Profile Save Editor

Browser tool for decrypting, editing, and re-encrypting Bloons TD Battles `Profile.save` files.

## Language

**Profile save**:
The encrypted on-disk player profile (`Profile.save`) for Bloons TD Battles.
_Avoid_: save file (when meaning the decrypted JSON), account

**Catalog**:
A known list of game entity IDs (with display labels) for one Profile concern, derived from Assets.
_Avoid_: enum, whitelist, database

**Quick action**:
A toolbar control that edits one known Profile concern through a dedicated UI, rather than the tree or raw JSON.
_Avoid_: shortcut, preset, tool

**Reference panel**:
An in-editor browser of catalogs with optional Add/Remove into the open Profile save.
_Avoid_: encyclopedia, wiki, sidebar

**Assets**:
JSON definitions unpacked from the game client's `data.jet`, used only as the local source for catalogs.
_Avoid_: game files, resources, dump

**data.jet**:
The password-protected ZIP pack in the Android game client that holds the Asset JSON tree.
_Avoid_: zip, archive (alone)

**Pack password**:
The ZipCrypto password for `data.jet` (sixteen uppercase hex digits from the password seed). Not stored in the repo.
_Avoid_: zip password (alone), key

**Password seed**:
The u64 embedded as AArch64 immediates in Android `libnative.so`; formatting it as uppercase hex yields the pack password.
_Avoid_: mixer blob, pack password (the hex string is the password; this is the integer)

**Specimen**:
A real decrypted profile JSON used to discover IDs and fields the editor does not yet handle.
_Avoid_: sample save, test fixture (unless it is literally a test fixture)
