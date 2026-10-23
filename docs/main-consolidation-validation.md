# main一本化と本番移行の検証

確認日: 2026-10-23（JST）。変更対象は `akiweb8528/haroteru-app` のみです。

## 採用した実装

- 認証・同期候補 `b9204f29330d37a7e1cb845978c121753ed7ac07` を基準に、stagingの認証防御、利用者別の永続キュー、ゲスト移行、操作ID・再送台帳、migration 000005、旧Backend混在時の保全テストを保持しました。
- Node候補 `4f0ad91e12052a1deae180e7be1a27e1d1d9a446` からNode.js 24.22.1、Docker / Dev Container / CI、sharp、Next standalone、lockfileを統合しました。
- CIはmain push / PRに統一し、Frontend build、専用PostgreSQL 16によるBackend integrationとPlaywrightを実行します。外部・通常利用DBへのE2E接続を廃止しました。
- 自動タグ生成・main/staging同期・旧ブランチ整理のWorkflow計4件を撤去し、既存のactiveなタグ生成・同期WorkflowもGitHub側で停止しました。staging環境用Blueprintはmainから手動配備する設定です。
- PWAの実操作で見つかった、オンラインでもquery付きサインインURLがoffline shellになる問題を修正しました。navigationはNetworkFirstとし、通信・cache両方の失敗時だけoffline shellを返します。認証APIはcache / fallback対象外です。
- 通信失敗を匿名sessionと区別し、tokenを永続化しないキャッシュからも本人の一覧・未同期操作を表示・編集できるようにしました。サーバー通信は有効なsession tokenが復帰するまで停止し、所有者チェックを維持します。navigatorがonlineを返したまま通信に失敗した場合も、onlineイベントからsessionを再取得して自動同期を再開します。

## ローカル検証

Node.js 24.22.1 / Go 1.24.7 / 新規の隔離PostgreSQL 16.15を使用しました。既存の開発DB・本番DB・通常のブラウザ保存には接続していません。

- Frontend: `npm ci --no-audit --no-fund`、lint、type-check、unit 229件、production buildが成功。静的13ページ、Service Worker、standaloneを生成しました。sharpのnative PNG変換も成功しました。
- Backend: `TEST_DATABASE_URL`を指定した `go test -count=1 ./...` が成功。再送台帳integration 5件と追加した既存データ保全integration 1件を含みます。
- Playwright: 正規の検証用認証・実Go Backend・専用DBで17件成功。認証、CRUD、設定、並び替え、遅延応答中の編集・削除、部分失敗、応答消失、旧Backendの404と復旧を含みます。

### production PWAの実操作

Chrome DevTools MCP 1.12.0のheadless / isolated接続と、Playwrightの独立したheadless Chromiumで、standalone production build・検証用認証・実Go Backendを使用しました。390×844で、次を確認しました。

- Service Worker active後のquery付きサインインURLを、オンライン・オフラインで再読み込みしても正しい画面を保持。
- 認証後、通信を切って900円で追加、1600円とメモへ編集。保存完了後にoffline reloadし、同じ操作ID・編集・既存一覧を保持。
- navigatorがonlineを返すまま通信不能となる条件でも、tokenを永続保存せず本人のキャッシュを表示。通信復帰イベントでsessionを再取得し、pending 0・サーバー行1件・1600円とメモを保持。
- offline削除とoffline reload後も削除状態を保持し、復帰後にサーバー削除を完了。既存の検証行は保持。
- 訪問済みprivacyのoffline reloadが成功。最後の通し操作でpage errorは0件。

[未同期データを保持したmobile表示](evidence/main-pwa-offline-mobile.png)で、端末への保存・未同期件数と既存カードを同時に確認しました。初回の実測で見つかった不具合は修正し、同じ経路を再実行しました。通常のブラウザ保存には触れず、専用contextを閉じ、検証server・隔離PostgreSQLを終了して一時clusterを削除しました。Docker DesktopのWSL接続は利用できなかったため、今回のDocker / Dev Container再buildは未実施です。過去の実測は[Node移行記録](node-24-security-validation.md)と区別します。

### migrationと旧クライアント

旧main `f6d3d3089a80fa45ef92fc28beb41abe36af642a` の実Backendでschema 4と既存データを作り、統合Backendでschema 5へ移行しました。ユーザーID・Google identity・設定・全サブスク属性・日本語メモ・日時が保持され、旧access/refresh token、旧CRUD/reorder、新同期APIの再送が成功しました。稼働中の旧Backendもmigration後にread/create/updateでき、新Backendでその変更を読めました。

追加した `migration_integration_test.go` は既存行のJSON全体を比較し、migration再実行、version 5 / dirty false、架空の作成ID・台帳が追加されないことも確認します。

schema 5を知らない旧Backend binaryは再起動に失敗しました。**ロールバックにもmigration 000005を含むBackendが必要です。DBのdown migrationや台帳削除で戻してはいけません。**

## 本番の確認と未反映工程

公開Frontendの実接続先は、配信JSとCSPで `https://haroteru-backend-singapore.onrender.com` と確認しました。READMEに以前あった別の `haroteru-backend.onrender.com` の成功を、本番接続先の成功とは扱っていません。

- `https://haroteru.com`、サインイン、privacy、Google provider、匿名session、manifest、SW、offline shellは200。
- 公開ブラウザでGoogleボタンを実際に押し、Googleへ遷移、callback `https://haroteru.com/api/auth/callback/google`、scope `openid email profile` を確認しました。
- 一本化前のSingapore Backendの `/health/ready` はコールド起動後200。CORSはharoteru.comを許可しましたが、`Idempotency-Key` は許可ヘッダーに含まれていませんでした。
- 一本化前の本番Frontend buildIdは `Ip9q4_eIn5ltyETnNo9Le`。GitHubのVercel本番最新記録は旧main `f6d3d308` です。Singapore Backendの配備SHA・DB接続先・schema versionは取得できませんでした。

Vercel・Render・Neonの管理接続・CLI認証情報・配備用secretが利用できませんでした。このためSingapore Backendの管理APIからの手動配備、migration 000005の直接SELECT、実DBの行照合、認証済み本番保存・同期は実施できませんでした。DB・OAuth設定・秘密鍵への直接操作はしていません。配備は既存のGit連携と公開応答から確認しています。

新Frontendだけが先行しないよう、最初のmain反映ではroot / frontend両方の `vercel.json` に `git.deploymentEnabled: false` を設定しました。初回反映後11:04 JSTにも新規Vercel deploymentは0件、既存buildIdと公開ページ・Google provider・PWAの200応答を確認しました。[VercelのGit設定](https://vercel.com/docs/project-configuration/git-configuration)と公開結果に基づく順序制御です。

初回main pushでは、別の旧Renderサービス `haroteru-backend.onrender.com` / `srv-d756aobuibrs73bhloug` が自動配備されました。GitHub deployment `7268326629` は11:04:24 JSTに成功し、readinessも200です。手動管理のRenderサービス設定はsourceのstaging Blueprintとは別で、main pushによる配備をsourceだけで無効にはできませんでした。起動コードはmigration後にlistenするため、この成功はそのサービスのmigration・設定検証が通った間接証拠です。ただし接続先DB・実schema・利用者行は取得できず、公開経路のSingapore Backendへの移行完了とは扱っていません。

11:06:01 / 11:06:18 JSTには、実公開経路のSingapore Backendも新CORS（`Idempotency-Key`許可）とreadiness 200を返しました。config検証・DB接続・migration成功後にlistenする実装と合わせ、公開Backend更新・migration通過の間接証拠です。サービスID・実SHA・接続DB・schema versionの直接取得はできず、この限界は保持します。

この後、両Vercel設定を `{"git":{"deploymentEnabled":{"**":false,"main":true}}}` に変更してmainだけを再有効化しました。Backend先行確認後、既存の正規Git連携でFrontendを配備する運用です。最終SHAのProduction deploymentと公開buildId・新同期JS・Google/PWAを確認します。Node 24のpatch選択はVercel管理のため、ホスト/CI/Docker指定の24.22.1と実Vercel patchの確認を区別します。

旧クライアントが移行前に成功応答を失ったcreateの過去照合と、旧版タブの同時利用の限界は[認証・同期の記録](auth-sync-validation.md)に記載しています。

## Gitの確認方法

リモートの旧4ブランチ、ローカルの旧3ブランチ、リモート・ローカル双方の13タグ、旧Release記録10件（未公開draft 1件を含む）を削除し、PR #102・#104を閉じました。linked worktreeは元から0件でした。保存用branchは作成していません。

最終採用ツリーを親指定なしの `git commit-tree` で作成し、Author / Committerとも `akiweb8528 <269185556+akiweb8528@users.noreply.github.com>` に統一します。反映には最新main SHAを指定したforce-with-leaseを使い、更新があれば再評価します。

GitHub反映後、深さ制限なしの新規cloneで、main以外のbranch・tagがないこと、commit数1・親なし・指定identity・採用tree SHAとの一致・開発依存の導入を確認します。GitHub CIは対象main SHAのchecksで確認できます。GitHub管理のPR内部参照は開発branchとは区別し、repositoryの再作成は行いません。
