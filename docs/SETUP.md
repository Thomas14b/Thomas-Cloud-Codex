# Netlify 正式環境設定

網站： https://school-of-failure-game.netlify.app
專案 ID：`62dadbfb-f663-408c-9ff3-199a7d7d810a`

1. 使用 Netlify CLI 登入，執行 `netlify link --id 62dadbfb-f663-408c-9ff3-199a7d7d810a`。
2. Identity 已在專案控制台啟用。預設註冊須驗證電郵。網站另設為 Private，只有獲 Netlify 團隊授權者能載入；遊戲帳戶與 Netlify 帳戶是兩層登入。
3. 先提交 SQL migrations，再執行 `netlify deploy --prod`。CLI 會建置程式並自動處理 `netlify/database/migrations`。不要手動在正式資料庫重跑初始 SQL。
4. Gateway 自動提供伺服器憑證，不需自備 API key。預設 `gpt-4.1-mini`，可用 server-only `BOBO_MODEL` 覆寫；先查官方支援型號。不要設定自備 `OPENAI_API_KEY`，以免繞過 Gateway。
5. 在網站建立你的遊戲帳戶、確認電郵。Identity > Users > 選取本人 > Roles 加入 `admin`，登出再登入。不要透過玩家可修改的 metadata 賦予權限。
6. 每次部署前確認 General > Powered by Netlify badge 顯示停用；只能使用官方設定。

## 上線驗收

- 未登入 Netlify 時，正式 URL 應要求 Netlify 登入。
- 遊戲登入後可建立任務、提交反思並重新整理保留資料。
- 管理員看得到玩家階段、反思與回饋；看不到 AI 私人對話。
- AI 真實回覆可保存、清除；失敗不冒充成功。清除亦使仍在處理的回覆失效。
- 雙人任務與交換需兩個遊戲帳戶驗證。Private 限制仍生效，不能直接邀請外部玩家測試。
- AI 每日／每月額度以 UTC 計算，失敗呼叫亦佔用保守額度。未開啟自動充值；實際 Netlify 費用另包括 compute、資料庫、流量。

本次為手動部署。若日後啟用 Git 自動部署，production branch 的下一次部署可覆蓋手動版本，應先合併對應分支。
