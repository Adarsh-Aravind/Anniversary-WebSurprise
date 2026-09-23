# Flight Log · Year 3: how to finish and send it

## 1. Write your letters
Open `private/content.js` and edit everything. Replace every `[bracketed]` bit with your real memories, and change the `passcodeHint`. The hint is shown **before** the passcode, so anyone can read it.

## 2. Add photos (optional)
Put them in `private/photos/` using these names:

| File | Where it shows |
|---|---|
| `story1.jpg` … `story6.jpg` | Timeline chapters: takeoff, year 1, year 2, turbulence, recovery, future |
| `scene1.jpg` … `scene10.jpg` | The in-flight movie, played in number order (captions are in `movie.scenes`) |

Phone photos are huge, so shrink them first. Originals are kept in `private/photos/originals`.
```bash
powershell -ExecutionPolicy Bypass -File tools/shrink-photos.ps1
```

## 3. Seal it with your real passcode
```bash
node tools/seal.js "your passcode"
```
Run this **every time** you change letters or photos. Passcodes ignore capital letters and extra spaces.

## 4. Test locally
```bash
python -m http.server 8765
```
- `http://localhost:8765/year3/` shows the countdown she'll see
- `http://localhost:8765/year3/?preview` skips the countdown
- `http://localhost:8765/year3/?now=2026-10-02T00:00:05%2B04:00` pretends it's a given time in Dubai (for checking daily letters)

The movie and letters remember progress in the browser. To reset, open DevTools → Application → Local Storage → delete the `y3-` keys.

## 5. Publish on GitHub Pages
1. **Rename the repo** to something plain like `flight-notes` (repo → Settings → General). The repo name appears in the link.
2. Commit and push. `private/` is git-ignored, so your letters and photos never upload, only the encrypted `year3/sealed.json` and `year3/data/`.
3. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
4. Her link: `https://adarsh-aravind.github.io/<repo-name>/year3/`
   Send it any time before 29 Sep. It stays locked until 00:00 on 29 Sep (India time), and after that it needs the passcode.

## Privacy features
- The tab says "Flight Notes". There are no hearts in the link preview, and search engines are told not to index it.
- The **eye button** (top right) instantly swaps to boring METAR study notes. **Triple-tap or long-press** the notes title to come back.
- Nothing plays sound.

⚠️ `private/` exists only on your computer. **Back it up** (USB, Drive), or you lose the editable letters.
