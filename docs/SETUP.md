# 設定與上線指引

本專案已包含真正的後端規則與 AI 呼叫。尚未建立 Supabase / OpenAI 帳戶時，畫面會顯示設定狀態，不會以假資料冒充服務。

## 1. 本機啟動

需要 Node.js 22.18+（建議 Node 24；測試使用 Node 的 TypeScript type stripping）。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

先完成以下 Supabase 設定，再將專案 URL 與公開 anon / publishable key 填入 `.env.local`，重啟開發伺服器。只有 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 會進入瀏覽器，不能在任何 `VITE_` 變數放私人金鑰。

## 2. 建立 Supabase

1. 在 Supabase 建立新專案。
2. 在 SQL Editor **依序**執行以下檔案，每個只執行一次：
   - `supabase/migrations/202610140001_core.sql`
   - `supabase/migrations/202610140002_dashboard.sql`
3. Authentication → URL Configuration：設定正式 Site URL；開發期間加入 `http://localhost:5173/**`、`http://127.0.0.1:5173/**`，正式網域加入 `https://你的網域/**`。QR 和重設密碼連結依照目前網站網域產生。
4. 啟用 Email / Password 登入和 email confirmation。正式發送註冊、重設密碼信前設定自己的 SMTP，確認發送限制。依活動人數配置 signup rate limits / CAPTCHA；不要開放無限制大量註冊。
5. Settings → API：取得專案 URL 與**公開** anon / publishable key，填入前端環境變數。

如已有 Supabase CLI，也可用 `supabase link --project-ref YOUR_PROJECT_REF` 後 `supabase db push` 執行遷移。勿把以上初始遷移重跑到已有同名資料表的資料庫。

## 3. 真正 AI 波波

本專案使用 OpenAI Responses API。需要有 API 使用權與額度；ChatGPT 訂閱不會自動提供本網站的 API 額度。

在 Supabase Dashboard 的 Edge Functions → Secrets 設定：

| Secret           | 用途                                                |
| ---------------- | --------------------------------------------------- |
| `OPENAI_API_KEY` | OpenAI 專案 API 金鑰，只存在伺服器                  |
| `OPENAI_MODEL`   | 你的 API 專案可用、支援 Responses API 的完整模型 ID |

不寫死模型：依你帳戶的可用模型、品質與成本選擇，設妥專案預算提醒。`SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Edge Function 環境提供，絕不可放到前端或 Git。

登入 Supabase CLI 並連接專案後：

```sh
supabase functions deploy bobo
```

`supabase/config.toml` 對 bobo 關閉閘道的 legacy JWT 檢查；函式本身每次呼叫 `auth.getUser(token)` 驗證使用者，不接受僅有公開 API key 的匿名呼叫。不要刪除函式內的驗證。

每日每帳戶最多 20 次，按 UTC 日重設；失敗的供應商請求也消耗一次額度以避免重試濫用。最多傳送最近 12 則訊息，不會傳送反思、電郵、管理資料。AI 供應商端請求設 `store:false`，仍需參閱供應商資料處理政策；本設定不代表供應商完全沒有安全日誌或備份。玩家可清除資料庫中的對話；既有備份依平台保留政策處理。

## 4. 建立管理員

先用網站註冊並確認電郵。然後只在 Supabase SQL Editor 執行以下 SQL，把 UUID 替換成 Authentication → Users 的指定使用者 ID：

```sql
update public.profiles
set is_admin = true
where id = 'YOUR-USER-UUID';
```

重新整理網站會出現「管理儀表板」。一般玩家不能自行修改管理員身分。

- 總覽：玩家數、任務完成數、等待見證數、回饋數、14 天活動、家族分布。
- 玩家資料：名稱、電郵、加入時間、點數、完成與見證狀態，搜尋及分頁。
- 玩家詳情：各家族等級、每個任務階段、反思文字、回饋、現有卡牌及兌換紀錄。
- 反思 / 回饋：文字搜尋、逐人查看、CSV 匯出本頁（每頁 25 筆，避免誤以為匯出全庫）。個人詳情可匯出該人的任務及反思。
- 任務：新增任務、開放 / 暫停、下載 QR。既有任務規則不直接修改，避免改變已完成紀錄。
- 獎勵：新增、開放 / 停止、輸入兌換碼核銷一次。請只新增能實際供應的獎勵。
- **AI 對話不在管理儀表板、管理 API 或 CSV 開放。** 持有 Supabase 專案管理權或 service-role 金鑰的人仍有基礎設施層權限，與遊戲內管理員是不同角色。

## 5. 遊戲規則

- 六個種子任務保留原作內容。每帳戶每任務只完成一次，獲得一張卡與 100 點。
- 同家族每完成一個新任務提升一級；Lv.1 至 Lv.10。六個種子任務只足以讓各家族到 Lv.1，管理員需新增同家族任務才能繼續升級。未虛構額外任務內容。
- 稀有任務為全體玩家共用供應額度。預留 24 小時，過期後釋放名額；只有正式完成才永久消耗額度。待見證亦佔用有效預留。
- 雙人任務只接受不同帳戶確認。邀請持有者可見任務和玩家名稱，看不到反思。這是同儕見證，不是對現實世界行為的防作弊證明。
- 永久封存不能解除或交換。交換邀請鎖定兩張卡，任一方可取消，指定收件人才能接受。
- 獎勵每人每款兌換一次，扣除點數但不減少成長等級。卡牌交換不轉移經驗。
- 遊戲反思及回饋會明示可供管理員閱讀，玩家不能讀取別人的輸入。
- PWA 快取應用外殼；登入、任務提交、交換與 AI 仍需要網路，未實作離線交易佇列。

## 6. 部署前端

```sh
npm run build
```

`dist/` 為可部署網站。Netlify 已包含 `netlify.toml`：build `npm run build`、publish `dist`。在 Netlify 專案環境變數設定公開 Supabase URL 和 key 後再 build。

依使用者偏好：**每次部署 Netlify 前，透過 Netlify 官方 per-project 設定確認 Powered by Netlify badge 已關閉。不要用 CSS、JS 或 CSP 遮蓋。** 本次未建立或部署 Netlify 專案，因此尚未執行此設定。

正式網域確定後更新 Supabase Auth URLs，再產生印刷 QR，避免印出 localhost 或臨時預覽連結。

## 7. 驗證

```sh
npm test
npm run build
npm run test:ui
```

- SQL 測試使用 PGlite 執行真正 Postgres schema、函式與 RLS。它不是多連線 PostgreSQL；並發交易壓力驗證仍需對正式測試資料庫完成。
- AI 單元測試驗證請求格式、上下文上限、同意與錯誤處理，供應商回覆使用測試替身。
- 瀏覽器測試以明確的 HTTP 測試資料驗證介面、操作與錯誤狀態，不代表已連接雲端。預設使用本機 Google Chrome；其他環境以 `PLAYWRIGHT_CHROME_PATH` 指向 Chrome，或安裝 Playwright Chromium 後使用預設 bundled browser。

服務建立後必做的實際驗收：

1. 註冊 A、B 兩個帳戶，確認電郵、登入及重設密碼，檢查深層連結仍能開任務。
2. A 預留與提交雙人任務；A 不可自行確認，B 開連結可確認；重複按確認不得重複領卡。
3. A/B 交換兩張卡；只有 B 可接受，刷新與重新登入後所有權一致。
4. 以兩個帳戶同時預留只剩一個名額的測試任務；確認最多一個成功。並行測試同一張卡的不同交換邀請，及最後一份獎勵的競爭兌換。
5. 確認管理員讀得到遊戲反思、回饋，但無法讀取玩家 AI 訊息。
6. 波波回覆真實輸入，斷線或缺少金鑰時顯示錯誤；測試每帳戶每日額度。
7. 建立測試獎勵、兌換、核銷；再次兌換不再扣款，再次核銷被拒絕。
8. 在手機及另一裝置登入，確認資料同步；測試正式網域 QR。

資料庫請啟用適合用途的備份與保留政策。恢復前端可回退 Git 版本；不要透過刪除資料表回退已產生的玩家資料。
