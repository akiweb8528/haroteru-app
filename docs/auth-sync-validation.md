# 認証・同期の修正と検証

確認日: 2026-10-22（JST）。ローカル実行は Node.js 24.22.1、Go 版は Go 1.24.7、隔離 PostgreSQL 16 を使用しました。既存の保存データを消去せず、認証済みの同期キューと関連する認証経路を修正した記録です。

## 保持する条件

- 操作 ID と送信内容を固定し、成功確認した ID だけを除去する。送信中の編集・削除・並び替えを別操作として保持する。
- create の成功確認、仮 ID とサーバー ID の対応、後続操作の付け替えを同じブラウザ保存にまとめる。応答待ちの間に一覧へ現れたサーバー行は、保存した作成操作 ID と照合して仮項目との二重表示・二重集計を防ぐ。
- 一覧取得開始時の revision と現在値が違えば古い応答を採用しない。未同期操作は取得結果に重ね、失敗操作によって一覧取得を止めない。
- 同じ項目の操作と一覧全体の並び替えは順序を守る。独立した項目の失敗は別項目の同期を止めない。
- 送信時に所有者を固定し、ログイン変更後の利用者へ別ユーザーの操作を送らない。画面のローカル状態も利用者 ID に結び付ける。
- localStorage の既存 v1 キーを継続する。欠けている revision・再試行 metadata は既定値で読み、JSON 破損や保存失敗を空データ・保存成功に置き換えない。

再送は同じ ID を使います。サーバーは変更と実行済み台帳を同一トランザクションで保存し、同じ ID・同じ要求には初回結果を返します。異なる内容で同じ ID を使う要求は拒否します。成功応答の消失、部分成功、遅延した update/reorder の再送でも、後続の変更を再適用で巻き戻さない設計です。

自動送信は操作ごと最大 5 回、2 / 4 / 8 / 16 秒の間隔で再試行します。1 回の送信と一覧取得は各 15 秒で打ち切ります。1 回の処理は 100 操作までで区切り、残りは次の処理へ回します。待機中に再読み込みしても回数・時刻を保持し、上限後は一覧・変更・手動再試行を残します。明確なトランザクション拒否だけを識別し、訂正・削除で新しい操作に置き換えられます。通信結果が不明な操作を推測で削除・畳み込みしません。

Web Locks 対応ブラウザでは利用者別の送信ロックと、短時間の保存用ロックを分離します。ネットワーク待ち中も編集でき、別タブの保存・完了確認との競合を抑えます。非対応ブラウザでは同一タブ内の送信をまとめます。

## 再現テストと確認結果

修正前に URL 正規化、create 中の編集・削除、update 中の更新、reorder の書き換え、一覧応答による未同期変更の上書きで失敗を確認し、修正後に同じ経路が通ることを確認しました。

- storage: exact / 重複 / 先頭以外の完了確認、仮 ID 変換、後続編集・削除、一覧先行、古い drag snapshot、既存 v1、別ユーザー、破損・保存容量不足、確定拒否の訂正・削除。
- guest migration: queue への引き渡し、コピー先保存と source marker の同時保存、ack 後の再 import、コピー中の追加・編集、保存失敗・破損、ユーザー切替・別ユーザーへの再 import 拒否、移行待機中のログアウトと同アカウントへの再ログイン後の再開。
- runner / hook: 応答待ち中の編集・削除、個別失敗後の別項目、同 ID 再送、timeout、回数上限、再読み込み・オンライン復帰、認証変更、一覧取得中の新操作、一覧表示の継続。
- API / DB: mutation と台帳の atomic commit、rollback、別ユーザーの分離、同キー別内容の拒否、削除後の再送、後続更新後の古い再送、検証条件変更後の replay。

- Frontend: `npm run lint`、`npm run type-check`、`npm test`、`npm run build` を実行。全 218 件が通過。
- Backend: `go test ./...` を実行。`TEST_DATABASE_URL` 指定時は隔離 schema へ実 migration を適用し、台帳 integration 5 件も実行。
- Playwright: 既存 10 件、redirect 回帰 2 件、同期遅延・部分失敗・成功応答消失の回帰 4 件が通過。
- CI の backend job に PostgreSQL 16 と `TEST_DATABASE_URL` を追加。既存 lint・型検査・unit・E2E の区分を維持。
- GitHub CI で `ubuntu-latest` の Ubuntu 26.04 と Playwright 1.55 が非対応と分かったため、E2E の runner だけを対応する Ubuntu 24.04 に固定。backend / frontend の成功ログを確認し、修正後に CI を再実行。

## ブラウザで確認した範囲

隔離 PostgreSQL、開発用認証、実 Go backend と Next frontend を Playwright の headless Chromium で操作しました。create をサーバーで成功させて応答だけ保留し、その間に編集・削除しました。500 応答と、成功後の応答破棄も実行し、保存・一覧・実 UI 再試行・再読み込み後の結果を確認しました。通常 desktop と mobile 390×844 を使用し、保存済み・未同期のカードと再試行が同時に使える表示を確認しました。

専用テスト用 server は終了し、ブラウザ context を閉じました。他作業が利用し始めた 3000 番ポートは触らず、後半は専用 3300 / 38080 を使用しました。

[390px 幅の同期失敗時の表示](evidence/auth-sync-mobile.png)では、失敗・端末内の保存・未同期件数・再試行を一覧の手前にまとめています。失敗後もカードと編集操作が残り、再試行で同じ内容が同期されることを確認しました。新しい画面は追加していません。

## デプロイと未確認事項

同期キューはキー必須の `/api/v1/sync/subscriptions` を使います。旧 backend に新 frontend を接続しても専用 URL が 404 になるため、キーを無視する旧 API へ操作を送らず保持します。一般的な 404・400 は過去の適用結果が不明なままなので、確定拒否として操作を削除・置換しません。

backend 起動時に migration `000005` が適用されます。backend を先に配備し、その後 frontend を切り替えます。本番の手動管理 Render 設定と backend 配備結果は未確認です。`ENVIRONMENT=production` では dev auth を拒否し、不適切な JWT 秘密鍵は起動時に拒否します。staging の Blueprint は `ENVIRONMENT=staging` に揃えました。

実際の Vercel / Render の環境変数・秘密鍵・Google OAuth 認証は、この確認だけでは検証できていません。コードや設定例の安全性から、本番の設定が正しいとは判断していません。

今回の E2E 全体再実行では、成功応答の消失後にサーバー行と仮項目が一時的に二重表示される失敗も検出しました。サーバーに作成操作 ID を保持し、ACK 前の一覧でも対応する仮項目を優先する修正と、編集・削除・集計・別操作の同内容項目を区別する回帰を追加しました。

旧実装がすでに送信して成功応答を失っていた create には、サーバーの実行済み台帳がありません。その履歴を新実装から遡って一意に照合することはできません。既存の未送信操作は保持しますが、この移行以前の不明な成功について重複防止を保証しません。旧版を開いたままの別タブも新しい保存ロックに参加しません。

台帳に自動 TTL は設けていません。無期限のオフライン再送と、削除後の遅延再送を保護するためです。容量は成功操作数に比例し、利用者削除時に cascade で削除します。ロールバック時も台帳・利用者データを消去しません。localStorage が上限に達した場合は新しい保存を失敗として返し、既存保存は保持します。料金・本番 CPU・本番 DB 容量は計測していません。

## staging 反映後の確認（2026-10-23 JST）

PR [#103](https://github.com/akiweb8528/haroteru-app/pull/103) は head `fa41c0d` の Backend Test / Frontend Check / Playwright E2E 成功と base `staging`、対象差分を再確認しました。未解決 review thread はなく、merge commit `07cee577957bb1ab9e8b65e70b0fc51ca4089835` で反映しました。[staging push の CI](https://github.com/akiweb8528/haroteru-app/actions/runs/39811675454) も全 job 成功です。`main` の起点は `f6d3d3089a80fa45ef92fc28beb41abe36af642a` で、今回の昇格先にはしていません。

### 実配備と公開経路

- [Vercel staging deployment](https://vercel.com/akiweb8528s-projects/haroteru-frontend-staging/DxFE8vJ2ntJ1NPUkFjBCLfpfmbEr) は `07cee57` で 01:11:16 JST に成功。
- Render の最初の [deployment](https://dashboard.render.com/web/srv-d73rukbuibrs73aps1tg/deploys/dep-dbd3aqk9v7es73c73f80) は 01:12:14 JST に failure。その直後の同じ `07cee57` の [deployment](https://dashboard.render.com/web/srv-d73rukbuibrs73aps1tg/deploys/dep-dbd3ar7j6onc73c874og) は 01:13:33 JST に success。GitHub deployment status で確認しました。最初の failure の description は空で、Render 管理接続がないため詳細ログと原因は未取得です。
- 実際の branch 連携では frontend が backend より先に完了しました。backend 先行を自動的に保証する gate はありません。この間のデータ保全を下記の実旧 backend 検証で確認しました。
- 公開 [backend readiness](https://haroteru-backend-staging.onrender.com/health/ready) は 200。staging frontend origin からの preflight は 204 で、追加した `Idempotency-Key` が許可ヘッダーに含まれることを確認しました。旧 `e1c4841` の CORS にはこのヘッダーはありません。
- 起動コードは `config.Load()` → DB 接続 → `RunMigrations()` → HTTP listen の順で、設定検証・migration の失敗時は起動しません。同 SHA の Render success、新 CORS と readiness の応答は、設定検証と migration `000005` を通った間接証拠です。staging DB の `schema_migrations`・台帳テーブルの直接 SELECT、Render 起動ログ、秘密鍵など実設定の値は取得していません。
- [staging.haroteru.com](https://staging.haroteru.com/) と `/auth/signin` は 200。headless Chromium で Google ボタンを実際に押し、`accounts.google.com` への遷移、`redirect_uri=https://staging.haroteru.com/api/auth/callback/google`、`openid email profile`、page error なしを確認しました。`/api/auth/providers` は Google のみで検証用認証はありません。Vercel の deployment 固有 URL は Vercel Authentication の 302 です。

staging の Google アカウント・ログイン済み session・検証用認証コードは利用できませんでした。このため実 staging の認証完了後の一覧・追加・編集・削除・同期・再試行は未実施です。以下の隔離環境の結果を実 staging の認証済み確認とは扱いません。

### 旧 backend 混在と更新後の復旧

通常の認証・CRUD・失敗後の UI 再試行・応答消失に加え、旧 backend の専用 URL への 404 を再現する E2E を追加しました。保存済みの一覧を表示したまま未同期項目を編集し、再読み込み後も create の操作 ID と編集が残ること、旧 `/subscriptions` へ fallback しないこと、専用 API 復旧後に同 ID で 1 件だけ作成されることを検証します。新しいテストの最初の実行では、自動復旧の完了後に消えた手動 retry ボタンを待つテスト側の競合がありました。自動復旧結果を待つよう修正し、全 17 件が成功しました。

さらに別の隔離 PostgreSQL 16 DB と、実際の旧 `e1c4841` binary、新 `07cee57` binary、新 frontend を使い、390×844 の headless Chromium で次を実測しました。

1. 旧 backend の migration version は `4` / dirty false。検証用サインイン後、新 frontend の入力から create と続く編集を保存。旧 CORS に `Idempotency-Key` がなく送信が拒否されても、画面と再読み込み後の browser storage に create / update が残り、create ID は同じ、サーバー行数は 0、旧変更 API への fallback は 0 件。
2. 同じ DB・ポート・JWT 設定で新 backend に切り替え、起動時の migration `000005` を適用。新 frontend の自動再送後、migration version は `5` / dirty false、台帳 2 件、サーバー行 1 件、未同期 0 件。編集したメモが保たれ、再読み込み後のカードも 1 件。
3. PostgreSQL を指定した `go test ./...`（integration 5 件を含む）、frontend lint・型検査・unit 218 件、Playwright 17 件を再実行。検証用の browser context / browser、Next frontend、Go binary と隔離 PostgreSQL は終了しました。通常のブラウザ保存・既存 DB・別作業のプロセスには触れていません。

上記の実測用 DB は既存データを持たない別 cluster です。staging DB・本番 DB の初期化や再作成は行っていません。
