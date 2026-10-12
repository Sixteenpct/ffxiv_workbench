# FF14 Workbench｜舊網址相容轉址

**狀態：RETIRED_SOURCE / REDIRECT_ONLY**（2026-10-12）

本 Repo 不再保存或維護第二份 FF14 網站功能程式。現行正式網頁原始碼與 GitHub Pages 發布都集中在 [Sixteenpct/ffxiv_journey](https://github.com/Sixteenpct/ffxiv_journey)。

## 舊網址仍可使用

- `https://sixteenpct.github.io/ffxiv_workbench/` → [素材製作工坊](https://sixteenpct.github.io/ffxiv_journey/collection/workbench/)
- `https://sixteenpct.github.io/ffxiv_workbench/journey/` → [FF14 Journey 首頁](https://sixteenpct.github.io/ffxiv_journey/)

上述兩個舊入口由 HTML 即時轉址到新網址；不是另一份可獨立維護的功能網站。請不要在這裡重新新增 `app.js`、`catalog.js`、`core.js`、`state.js` 或 `style.css`。

此次移除了重複的舊版程式、樣式和過時的舊 Journey 維護說明，**原始 Git 歷史未刪除**；退役前的最後完整版本為 `27ff046253b3a20e483b22f6241f88e5f8771a7c`。

素材製作工坊的個人存檔不在本 Repo：它使用瀏覽器本機儲存；新舊 GitHub Pages 路徑位於同一個 `https://sixteenpct.github.io` origin，正式站的 `state.js` 與舊站相同，因此這次不遷移、不清除任何個人進度。個人資料仍應由使用者自行定期匯出 JSON 備份。
