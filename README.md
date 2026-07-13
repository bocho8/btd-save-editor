# BTD Battles Profile Save Editor

Decrypt, edit, and re-encrypt Bloons TD Battles `Profile.save` files in the browser.

**Live:** https://bocho8.github.io/btd-save-editor/

## Usage

1. Drop `Profile.save` onto the page (Steam path below)
2. Hit Decrypt. Set Medallions, Premiums, Farmers, or Battle Score; or edit any field in the tree / raw JSON
3. Sanitize zeros `DetectedHacks`, deletes `StreamID`, and sets `DateTime` / `Timestamp` to now
4. Encrypt & Download (Sanitize is pre-checked). Replace the file in the Steam folder

**Steam path:**

```
Steam\userdata\[steamid]\444640\local\Data\Docs\64878ecb93c456c059ea530d
```

**Android path:**
```
/data/data/com.ninjakiwi.bloonstdbattles/files/64878ecb93c456c059ea530d/
```

Close the game before replacing the file. Keep a backup of the original `Profile.save`.
