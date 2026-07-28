# BTD Battles Profile Save Editor

Decrypt, edit, and re-encrypt Bloons TD Battles `Profile.save` files in the browser.

**Live:** https://bocho8.github.io/btd-save-editor/

## Usage

1. Drop `Profile.save` onto the page (Steam path below)
2. Hit Decrypt. Set Medallions, Premiums, Farmers, or Battle Score; or edit any field in the tree / raw JSON
3. Use **Known from game data** under the editor to browse catalogs from the client extract and Add/Remove them on the save
4. Sanitize zeros `DetectedHacks`, deletes `StreamID`, and sets `DateTime` / `Timestamp` to now
5. Encrypt & Download (Sanitize is pre-checked). Replace the file in the Steam folder

**Steam path:**

```
Steam\userdata\[steamid]\444640\local\Data\Docs\64878ecb93c456c059ea530d
```

**Android path:**

```
/data/data/com.ninjakiwi.bloonstdbattles/files/64878ecb93c456c059ea530d/
```

Close the game before replacing the file. Keep a backup of the original `Profile.save`.

## Catalogs

`catalogs.json` ships with the site. It is generated from a local `Assets/` unpack of the game’s `data.jet` (premiums, towers, skins, etc. for the reference panel).

```bash
npm run extract-catalogs
```

`Assets/` and `Assets.zip` are gitignored; only the derived catalogs are committed.

## Unpacking Android `data.jet`

For regenerating catalogs from an **Android** client build (APK unpack). Steam packaging is different; this script expects Android `libnative.so` (arm64-v8a) and that build’s `data.jet`.

`data.jet` is a ZipCrypto ZIP. The pack password is not a fixed string — each client build embeds a **password seed** in `libnative.so`. The extract script turns that seed into the **pack password**, verifies it with `unzip -t`, and writes `Assets/` for the catalog step above.

```bash
npm run extract-data-jet -- \
  --so /path/to/lib/arm64-v8a/libnative.so \
  --jet /path/to/assets/Assets/data.jet
npm run extract-catalogs
```

Use the **same** Android build for both files. `--password-only` prints the pack password and skips writing `Assets/`. Passwords are not checked into this repo.
