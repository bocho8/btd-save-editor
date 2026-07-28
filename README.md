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

`catalogs.json` is generated from a local `Assets/` unpack of `data.jet`:

```bash
npm run extract-catalogs
```

`Assets/` and `Assets.zip` are gitignored; only the derived catalogs ship with the site.
