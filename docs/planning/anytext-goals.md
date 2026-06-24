# AnyText Paste-Ready Goals

These goals are ordered. Run them one at a time through `/goal`.

Completion target: after all goals pass, AnyText should be a fully usable MVP for transferring Markdown text, code blocks, images, and files between the user's own devices.

## Goal 1: Frontend Foundation And Local Command Deck

```text
【核心目標】
在 /Users/ken/Documents/AnyText 根據 docs/product/anytext-mvp-requirements.md、docs/technical/anytext-technical-framework.md、docs/design/command-deck-ui-design.md、docs/design/command-deck-ux-interactions-motion.md，建立 Vite + React + TypeScript + Tailwind 的 AnyText 前端基礎，完成 Command Deck 靜態 UI、本地 mock queue、Markdown preview、code block copy、附件選取/拖入、驗證與本地 queue 操作。此 goal 不接 Supabase。

【成功標準】
1. 建立可運行的前端專案，包含 build/test/lint scripts、GitHub Pages base/path 設定、Supabase env placeholder，但不得提交任何 secrets。
2. 實作 Command Deck UI：desktop 左 Compose 右 Queue；mobile Send/Queue tabs；first-run/pairing placeholder；empty/loading/error/disconnected/upload states。
3. 實作本地資料模型與 helper：room key generation、sha256(roomKey)、Markdown 500KB limit、單附件 25MB、最多 10 attachments、image/download classification、1 小時 expires_at/time remaining。
4. Markdown preview 支援 GFM、table、blockquote、inline code、code block syntax highlighting、HTML/script sanitization、Copy Markdown、每個 code block 單獨 Copy；shell/command block 要有更醒目樣式。
5. Mock queue 可新增、展開、刪除、過期隱藏；圖片可開大圖 preview，文件只顯示下載 row。
6. 通過 fresh verification：npm run lint、npm test、npm run build；用本機瀏覽器檢查 desktop + mobile layout、keyboard tab order、reduced motion。
7. 更新 docs/product/anytext-decision-log.md 或新增 implementation notes，記錄本 goal 已完成內容與任何偏離 spec 的理由。完成後 commit 並 push。

【限制條件】
1. 不實作帳戶、協作、長期歷史、搜尋、tags、clipboard watcher、share extension、native app、E2E encryption。
2. 不接 Supabase、不建立真 backend、不提交 secrets。
3. UI 必須跟 Command Deck dark developer-first 方向一致，不做 landing page 或 marketing page。
4. 不用大型 design system；可用小型本地 components 與單一 icon family。

【相關內容】
- docs/product/anytext-mvp-requirements.md
- docs/technical/anytext-technical-framework.md
- docs/planning/anytext-development-sequence.md
- docs/design/command-deck-ui-design.md
- docs/design/command-deck-ux-interactions-motion.md
- docs/technical/anytext-supabase-project.md

【錯誤處理與預算】
最多自主修復 6 輪。若 package 安裝、build tool、或 browser verification 連續 3 次卡在同一 blocker，停止並輸出 blocker report：已嘗試步驟、錯誤摘要、剩餘風險、下一步選項。不得在 lint/test/build 失敗時宣稱完成。
```

## Goal 2: Supabase Backend, Pairing, And Realtime Text Relay

```text
【核心目標】
在既有前端基礎上，使用 docs/technical/anytext-supabase-project.md 記錄的 Supabase project `cizmpumlliowigimhwqr`，實作 metadata backend、no-login room key 配對流程、text-only realtime relay。完成後兩個 browser/device 可以加入同一 room，傳送 Markdown 文字並即時同步、複製、刪除。

【成功標準】
1. 使用 docs/technical/anytext-supabase-project.md 的本機 Supabase 設定；Supabase CLI 已登入且 project linked，開始 backend work 前先用 `supabase projects list` 做 fresh verification。不得把 token/key 貼進 chat 或 committed files。
2. 建立 Supabase migrations/schema：rooms、messages、attachments metadata、必要 indexes、RLS policies、storage bucket placeholder；raw room key 不得存入 DB，room_id 使用 sha256(roomKey)。
3. 實作 restricted RPC 或 Edge Functions 作為資料邊界，至少支援 createRoom/listMessages/createMessage/deleteMessage；不得讓 frontend 直接做 broad table/bucket access。
4. 實作 first-run flow：Create Device Circle、Join Existing Circle、QR/join link/manual pairing code、localStorage 保存 room key、Reset this browser、Rename device、Copy join link、Show QR。
5. 實作 text-only send/list/delete：Markdown text 儲存到 Supabase，expires_at 預設 1 小時，deleted_at soft delete 或等效安全刪除。
6. 實作 Realtime：app load 先 fetch active queue，再 subscribe room messages；insert/update/delete 在另一 browser 即時反映；realtime disconnected 時顯示小型 warning 和 manual refresh。
7. 保留 Goal 1 的 Markdown rendering、sanitization、syntax highlighting、per-code-block copy；確認 Supabase 來的內容不可執行 script。
8. 通過 fresh verification：npm run lint、npm test、npm run build；至少用兩個 browser profile 測試 create room、join、refresh persistence、send Markdown with multiple code blocks、copy code block exactness、delete sync。
9. 更新 docs/product/anytext-decision-log.md：記錄選用 Edge Functions/RPC、RLS/security decision、local env setup。完成後 commit 並 push。

【限制條件】
1. 不做附件 upload/download；attachments 可保留 metadata/types 但不要半成品 UI 破壞流程。
2. 不使用 Supabase Auth；不新增帳戶登入。
3. 不提交 .env secrets；只提交 .env.example 或 README setup。
4. 使用 docs/technical/anytext-supabase-project.md 中的 project ref 與本機 `.env.local`；若 fresh verification 發現 CLI auth/link 失效，停止在清楚 blocker，不要硬編假 key。

【相關內容】
- docs/technical/anytext-supabase-project.md
- docs/technical/anytext-technical-framework.md
- docs/planning/anytext-development-sequence.md Phase 3-5
- docs/product/anytext-mvp-requirements.md

【錯誤處理與預算】
最多自主修復 7 輪。若 Supabase 權限、CLI login、project secrets、或 RLS policy 連續 3 次阻塞，停止並輸出 blocker report。任何完成宣稱都必須附 fresh verification；build/test 失敗不得宣稱完成。
```

## Goal 3: Attachments, Image Preview, File Download, And Delete Cleanup

```text
【核心目標】
完成 AnyText MVP 的完整 content model：一筆 message 可包含 Markdown + 最多 10 個 attachments；單附件最多 25MB；圖片可 thumbnail/large preview/download；PDF/zip/doc 等文件只顯示檔名/大小/type 並下載。

【成功標準】
1. 實作安全 upload flow：createUploadUrl 或等效 restricted backend function、Supabase Storage upload、attachments metadata 寫入、safe storage path：rooms/{roomId}/messages/{messageId}/{attachmentId}-{safeFileName}。
2. 實作 signed download URL：按 room/message/attachment 驗證後產生短效 URL；不可 expose bucket listing 或 public broad paths。
3. Composer 支援 Markdown + 多附件同筆 send；每個附件有 progress rail、成功/失敗狀態、可 retry/remove；失敗時保留未成功附件讓使用者處理。
4. Queue/detail 顯示 attachment count、image thumbnails、large preview modal、download action；非圖片不做 preview。
5. Validation 完整落地：Markdown 500KB、最多 10 attachments、單附件 25MB、MIME/type conservative classification；錯誤必須 inline 顯示。
6. Delete message 後所有 paired devices 隱藏該 item，並透過 backend flow 刪除或標記待清 Storage objects；不得只做前端隱藏。
7. 通過 fresh verification：npm run lint、npm test、npm run build；兩個 browser 測試 Markdown+image、Markdown+PDF/zip、超過 10 個附件、超過 25MB、delete sync、download URL 可用且不 broad expose。
8. 更新 docs/product/anytext-decision-log.md 或 implementation notes，記錄 storage URL strategy、delete/cleanup strategy。完成後 commit 並 push。

【限制條件】
1. 不做 PDF/Word/Excel/zip preview，只下載。
2. 不加入 public sharing links。
3. 不把原始 file name 當 storage path 信任來源。
4. 不降低既有 Markdown/code copy/security 行為。
5. 不提交 service role key 或 access token；如 backend deployment 需要 secret，只能放在本機/部署平台 secrets。

【相關內容】
- docs/technical/anytext-supabase-project.md
- docs/product/anytext-mvp-requirements.md Attachment Requirements
- docs/technical/anytext-technical-framework.md Storage Strategy
- docs/planning/anytext-development-sequence.md Phase 6

【錯誤處理與預算】
最多自主修復 7 輪。若 Supabase Storage/RLS/signed URL 權限連續 3 次卡住，停止並輸出 blocker report。不得以「本地 mock 可用」代替真 Supabase 附件驗收。
```

## Goal 4: Expiry, UX Polish, GitHub Pages Production, And Fully MVP Verification

```text
【核心目標】
完成 AnyText MVP 的 1 小時臨時隊列、清理機制、Command Deck UX polish、accessibility、GitHub Pages production deploy 文件與完整端到端驗收。完成後應可直接用於 MacBook/iPhone/iPad/Windows browser 之間傳 Markdown、圖片、文件。

【成功標準】
1. Expiry 完整落地：所有 list query 只返回 expires_at > now() 且未 deleted 的 items；UI 顯示 1h/42m/5m left；expired item 自動從 queue 消失；open item 到期時顯示 expired state。
2. 實作 physical cleanup：scheduled cleanup 或可部署的 cleanup function，按 docs/technical order 清除 expired/deleted attachments storage objects、attachment records、messages；可用 shortened expiry 在 dev 驗證。
3. UX polish 完成：Send/Copy/Delete/Room menu/Queue expand/Mobile detail sheet/Drag over/Upload progress/New item arrival/Expired item motion 符合 docs/design/command-deck-ux-interactions-motion.md；支援 reduced motion。
4. Accessibility 完成：WCAG AA contrast、visible focus、keyboard menu navigation、Escape/outside click close、icon buttons aria-label/tooltips、delete touch affordance、textarea/file input labels。
5. Production readiness：GitHub Pages build/deploy config、README setup、.env.example、Supabase migration/function deployment instructions；不得提交 secrets。
6. 完整 E2E fresh verification：fresh browser creates room；second browser/device joins by QR/link/manual code；refresh 後 room persists；send ChatGPT-style Markdown with code；copy raw Markdown；copy individual code block；send image preview/download；send document download；delete from receiver syncs; shortened expiry hides item；mobile layout works。
7. npm run lint、npm test、npm run build 全部通過；如有 Playwright/browser test，加入並通過。
8. 更新 docs/product/anytext-decision-log.md 和 README，標記 MVP 已完成、列出 production URL 或本機/部署步驟。完成後 commit 並 push。

【限制條件】
1. 不擴 scope 到 accounts、E2E encryption、native apps、clipboard watcher、search、tags、folders、team collaboration、long-term archive。
2. 不在 UI 加 marketing landing page；打開 app 直接進入 setup 或 Command Deck。
3. 不提交 Supabase service role key、access token、dashboard session token；anon/publishable key 也應走環境變數/部署設定。
4. 不用未驗證的部署結果宣稱完成；若 GitHub Pages 或 Supabase production 權限缺失，要明確 blocker report。

【相關內容】
- docs/technical/anytext-supabase-project.md
- docs/planning/anytext-development-sequence.md Phase 7-9
- docs/design/command-deck-ui-design.md
- docs/design/command-deck-ux-interactions-motion.md
- docs/product/anytext-mvp-requirements.md

【錯誤處理與預算】
最多自主修復 8 輪。若 deployment credentials、Supabase project access、GitHub Pages permissions、或 external service settings 連續 3 次阻塞，停止並輸出 blocker report：已完成項目、未完成驗收、需要 user 提供的值或權限、下一步命令。不得在 E2E 未通過時宣稱 fully MVP。
```
