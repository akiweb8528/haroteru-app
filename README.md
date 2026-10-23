# サブスク払ろてる

Next.js + Go を用いたフルスタック実装です。

以下にて閲覧可能です。

https://haroteru.com

サブスク払ろてるは、登録なしですぐ使える「サブスクの軽量ダッシュボード」です。

サブスクって、払いたいから払っている。
だから別に、悪いことじゃない。
でも、「結局いくら払ってるんだっけ？」と、ふと確認したくなる。

このアプリは、必要なサブスクも、なんとなく続いているサブスクも、まとめて把握するためのものです。
ロックして残しておきたいものと、見直し候補を同じ一覧で管理できます。

## 現在の実装範囲

- 登録なしでローカル保存してすぐ使える
- Googleサインインで同期できる
- サブスクの追加、編集、削除ができる
- 月額 / 年額ベースで支出の目安を一覧できる
- ロック状態とカテゴリで整理できる
- テーマ設定、アバター設定を保持できる

課金機能は実装準備はしていますが、この段階では非表示です。

## アーキテクチャ

- Frontend: Next.js App Router + TypeScript
- Backend: Go + Echo + GORM
- Local DB: PostgreSQL
- Production DB: Neon PostgreSQL
- Auth: Google OAuth + NextAuth
- Storage strategy:
  - ゲスト利用時はブラウザの localStorage
  - ログイン利用時は Backend + PostgreSQL

### フロントエンドの構築方針

- このプロジェクトは `SSR 中心` ではなく、`静的 shell + client hydration + PWA` を基本方針にしています
- `/`, `/subscriptions`, `/settings`, `/auth/signin`, `/terms`, `/privacy` は build 時に静的生成し、表示速度と offline 対応を優先します
- ログイン状態、サブスク一覧、設定など利用者ごとのデータは hydration 後に client 側で取得します
- PWA では静的ページ shell と訪問済みルートの HTML / RSC をキャッシュし、offline 時も画面を開きやすくしています

### ログインあり PWA の設計

- 認証済みユーザーでも、PWA 利用時は直近のサブスク一覧を端末にキャッシュして開けるようにしています
- オフライン中の追加、編集、削除、並び替えは端末内の pending operation queue に積み、通信復帰後に順番に Backend へ反映します
- サーバーが正本であることは維持しつつ、PWA では「まず一覧を開けること」と「変更を失いにくいこと」を優先しています
- iOS では `beforeinstallprompt` が使えないため、Safari の共有メニューからホーム画面追加する案内を別導線で出します

### ローカルでの PWA / オフライン挙動確認

`npm run dev` で起動すると画面右下に `PWA [ONLINE] SW:○` パネルが表示されます。

- **[ONLINE] ボタン** を押すとオフライン模擬が始まり、オフラインバナー表示・API エラー・pending queue への振る舞いをそのまま確認できます
- **SW:●** になると dev SW がアクティブになり、フェッチのインターセプトとキャッシュからのページ提供もテスト可能になります
- ハードリロード中のオフライン模擬は `/_next/static` のチャンクをキャッシュしない設計のため HMR との兼ね合いで部分的に崩れます（クライアントサイドルーティングでの遷移テストは問題ありません）

本番ビルドでの完全な動作確認は引き続き `cd frontend && npm run preview:pwa` を使ってください。

### フロントエンド構成

- `frontend/src/app`: ルーティング、レイアウト、メタデータ
- `frontend/src/features/subscriptions`: サブスク管理の UI / hooks / API 呼び出し
- `frontend/src/features/account`: 設定画面、ユーザー情報取得
- `frontend/src/providers`: セッション、テーマ、表示設定
- `frontend/src/shared`: HTTP クライアントなどの共通境界

### バックエンド構成

- `backend/cmd/server`: エントリポイント
- `backend/internal/handlers`: HTTP ハンドラ
- `backend/internal/services`: ユースケース
- `backend/internal/repositories`: DB アクセス
- `backend/internal/models`: 永続化モデル
- `backend/internal/database/migrations`: DB マイグレーション

### AI 開発構成

- `AGENTS.md`: このリポジトリ全体で共有する最小ルール。プロダクトの形、責務分離、UX / auth / security の判断基準を記載
- `CLAUDE.md`: `AGENTS.md` を指すシンボリックリンク。Claude Code 側から同じガイドを参照するために利用
- `skills/`: repo 専用 skill 群。各 skill の詳細は配下の `SKILL.md` を参照
- `.codex/skills`: `skills/` を指すシンボリックリンク。Codex 側から repo 専用 skill を読み込むために利用
- `.claude/skills`: `skills/` を指すシンボリックリンク。Claude Code 側から repo 専用 skill を読み込むために利用
- `.serena/project.yml`: Serena のプロジェクト設定。Go / TypeScript を対象にしたローカルエージェント運用の前提

## 開発用環境変数

`.env.example` をコピーして `.env` を作成してください。

最低限必要なもの:

- PostgreSQL 接続情報
- `DATABASE_URL` または `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
- `JWT_SECRET`: `openssl rand -hex 32` などで生成したランダムな秘密鍵
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

## 起動

推奨の開発環境は Dev Container です。

1. Docker Desktop を起動する
2. VS Code で `Dev Containers: Reopen in Container` を実行する
3. 必要なら `.env.example` を `.env` にコピーする
4. 必要なら `docker-compose.override.sample.yml` を `docker-compose.override.yml` にコピーする
5. Dev Container 作成後に次を実行する

```bash
docker compose up
```

`.devcontainer/devcontainer.json` で Node.js 24.22.1 / Go 1.26 / Docker を揃えており、`postCreateCommand` で `frontend` の `npm ci --no-audit --no-fund` と `backend` の `go mod download` を自動実行します。

主な起動先:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

backend を Docker ではなくローカルで直接起動する場合も、リポジトリ直下の `.env` を読めます。`DATABASE_URL` が無い場合は `POSTGRES_*` からローカル向け接続文字列を自動で組み立てます。

```bash
cd backend
go run ./cmd/server
```

## Playwright E2E

Node.js 24.22.1 / Go と、通常利用・本番から分離したローカル PostgreSQL 16 を使います。テストは専用DB内のデータを書き換えるため、通常の開発DBや Neon の本番DBを指定しないでください。

```bash
cd frontend
PLAYWRIGHT_E2E_DATABASE_URL='postgres://haroteru_test:haroteru_test@127.0.0.1:5432/haroteru_e2e?sslmode=disable' npm run test:e2e
```

先に専用DBを作成してください。設定は `PLAYWRIGHT_E2E_DATABASE_URL` を必須とし、通常の `DATABASE_URL` や本番の認証情報へフォールバックしません。接続先は loopback のみ許可します。Playwright が frontend / backend と検証専用認証を起動し、終了時にサーバーを止めます。PostgreSQL は自動起動・初期化しません。

別ポートを使う場合は `PLAYWRIGHT_FRONTEND_URL` と `PLAYWRIGHT_BACKEND_URL` を指定します。CI は job 専用の PostgreSQL を使い、外部DBの secret は不要です。

## 本番 DB / デプロイ

本番 DB は Neon を前提にしています。`DATABASE_URL` には Neon が発行する接続 URL をそのまま設定してください。

- ローカル開発: `postgres://...@localhost:5432/...?...`
- 本番 / staging: Neon の `postgres://...neon.tech/...` を使用

バックエンドでは Neon ホストの URL に `sslmode` が未指定でも `sslmode=require` を補うため、そのまま接続できます。

backend 用の Render Blueprint は `infra/render/` 配下で管理しています。

- staging: `infra/render/staging.yaml`

staging の Blueprint 作成時は Render の `Blueprint Path` で `infra/render/staging.yaml` を指定してください。production は region を Render 側で柔軟に選べるように、Blueprint ではなく通常の Web Service として作成・管理します。

初回作成時に Render で入力する値:

- `haroteru-backend-staging`
- `DATABASE_URL`: Neon の接続 URL
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_API_URL`: backend の公開 URL。例: `https://haroteru-backend-staging.onrender.com`
- `FRONTEND_URL`: frontend の公開 URL。例: `https://haroteru-staging.vercel.app`

production backend を Render に作成する場合は、Blueprint ではなく Render ダッシュボードから Web Service を新規作成してください。

- Name: `haroteru-backend-singapore`（既存本番サービス）
- Root Directory: `backend`
- Runtime: `Go`
- Build Command: `go build -o bin/server ./cmd/server`
- Start Command: `./bin/server`
- Health Check Path: `/health/ready`
- Region: 運用したいリージョンを Render 上で選択

production backend の env は次を設定します。

- `ENVIRONMENT=production`
- `DATABASE_URL`: Neon の接続 URL
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_API_URL`: `https://haroteru-backend-singapore.onrender.com`（2026-10-23の公開Frontend接続先）
- `FRONTEND_URL`: Vercel production frontend の公開 URL
- `DEV_AUTH_ENABLED=false`

本番では開発用認証を有効にすると backend の起動を拒否します。`JWT_SECRET` も起動時に検査し、32 bytes 未満、サンプル値、空白を含む値、単純な反復・順序列を拒否します。この検査は乱数性の保証ではありません。デプロイ先の環境名・秘密鍵・OAuth 設定は、実際の設定と起動結果で確認してください。

frontend は Vercel にデプロイします。Vercel 側で設定する主な env は次のとおりです。

- `NEXTAUTH_URL`: frontend の公開 URL
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_API_URL`: backend の公開 URL
- `BACKEND_URL`: backend の公開 URL
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: Google Analytics の Measurement ID
- `NEXT_PUBLIC_APP_ENV`: staging は `staging`、production は `production`
- `DEV_AUTH_ENABLED`: staging で検証用サインインを使う場合だけ `true`

frontend と backend の接続は公開 URL ベースです。

- frontend の `BACKEND_URL` は backend の `PUBLIC_API_URL` と同じ値
- frontend の `NEXT_PUBLIC_API_URL` も backend の `PUBLIC_API_URL` と同じ値
- backend の `FRONTEND_URL` は frontend の `NEXTAUTH_URL` と同じ値
- frontend 切り替え中は backend の `FRONTEND_URL` に複数 origin をカンマ区切りで指定可能

Google OAuth の設定では、以下の callback / origin を追加してください。

- Authorized JavaScript origins: frontend の公開 URL
- Authorized redirect URIs: `https://<frontend-domain>/api/auth/callback/google`

Google OAuth の切り分け用に、開発・検証専用の簡易サインインも用意しています。

- backend: `DEV_AUTH_ENABLED=true`, `DEV_AUTH_CODE=<secret>`
- frontend: `DEV_AUTH_ENABLED=true`。production ビルドを使う staging では、サーバー環境変数 `ENVIRONMENT=staging` も指定
- 必要に応じて backend 側で `DEV_AUTH_EMAIL`, `DEV_AUTH_NAME` も指定可能

この導線は staging / debug 用です。backend の `ENVIRONMENT=production`、frontend の本番環境指定（`VERCEL_ENV` / `NEXT_PUBLIC_APP_ENV` を含む）があれば無効になります。環境名の誤記も backend の起動時に拒否します。

## 認証済みの保存と同期

ログイン中の変更も、まず利用者別のブラウザ保存領域へ記録します。既存の `authenticated_subscriptions_sync_v1` と未送信操作を読み込み、データ消去を伴う移行は行いません。操作ごとに ID を付け、送信中の内容を変更せず、成功確認できた ID だけをキューから除きます。作成後のサーバー ID と後続の編集・削除は一度に保存します。

ゲストからの移行も、コピー先と元項目の対応を永続保存してこのキューへ渡します。コピー先の保存が成功した項目だけをゲスト保存から除き、途中の追加・編集・保存失敗では元データを保持します。

一覧取得は未同期の変更や個別操作の失敗があっても続けます。取得開始時のローカル revision を確認し、未同期の追加・編集・削除・並び替えを重ねて表示します。通信失敗時も一覧を残し、端末への保存済み件数と再試行を表示します。保存領域が使えない場合は保存成功として扱いません。

送信・一覧取得の待機は各 15 秒、自動送信は操作ごとに最大 5 回、待ち時間を空けて再試行します。上限後もデータを保持し、手動で再試行できます。同じ項目の後続操作は順番を守り、独立した項目は先行する個別失敗があっても同期します。サーバーが確実に拒否した操作は再編集・削除で修復し、結果不明の通信失敗は同じ操作 ID で再送します。

サーバー側は利用者・操作 ID ごとの実行済み台帳と変更を同じトランザクションで保存し、再送には初回の結果を返します。同じ ID で別の内容を送る要求は拒否します。台帳は削除済み項目への遅延再送にも必要なため、自動保持期限を設けず、アカウント削除時に削除します。容量は成功操作数に比例します。台帳を手動削除すると再送保護が失われます。

同期キューの送信はキー必須の `/api/v1/sync/subscriptions` を使い、旧 backend の 404 では変更を保持します。既存 `/subscriptions` への fallback は行いません。backend を先に更新してください。起動時に migration `000005_subscription_operation_receipts` が適用されます。その後 frontend を更新します。旧 backend へ新 frontend だけを接続した状態では再送保護を確認できません。

検証範囲と移行時の限界は [認証・同期の検証記録](docs/auth-sync-validation.md) を参照してください。

## CI / CD と Git 運用

開発の正本は `main` です。PR を使う場合も base は `main` にします。staging 環境は `main` のソースから検証する別の配備先で、Git の staging ブランチは使いません。

`.github/workflows/ci.yml` は `main` の push / PR で次を実行します。

- backend: job 専用 PostgreSQL 16 で migration・台帳 integration を含む `go test ./...`
- frontend: Node.js 24.22.1 の完全一致確認、`npm ci --no-audit --no-fund`、lint、type-check、unit test、production build
- e2e: Ubuntu 24.04 / Playwright と job 専用 PostgreSQL 16 で実 API を使ったテスト

自動タグ生成と main / staging 間の同期・旧ブランチ作成処理は撤去しました。配備したソースはコミットSHAと Vercel / Render の deployment ID で特定します。Git タグを作成するリリース手順はありません。

### Backend を先に配備する

Vercel の Git 自動配備はリポジトリ直下と `frontend/vercel.json` で `main` だけを有効にしています。Backend / DB の互換性が変わる更新では、まず両ファイルの `git.deploymentEnabled` を `false` にして main を反映し、Backend・migration・readiness の確認後に main のみ有効な設定へ戻して Frontend を配備します。Render staging Blueprint は `branch: main` / 自動配備なしです。既存の手動管理Renderサービスの自動配備設定はBlueprintとは別なので、実際の配備結果を確認してください。

1. main の CI を確認し、隔離環境で移行と旧 API 互換性を検証する。
2. Vercel / Render の対象サービス、現在の配備SHA、Neon の接続先、環境変数を確認する。既存の `DATABASE_URL`、JWT / NextAuth 秘密鍵、Google OAuth 設定は保持する。
3. Render Backend を対象の main SHA から配備する。起動時に migration `000005` が実行される。DBを初期化せず、migration version `5` / dirty false、起動ログ、既存データ保持を確認する。
4. `/health/ready`、既存 `/api/v1/subscriptions`、新 `/api/v1/sync/subscriptions` と CORS を確認する。旧クライアントは既存 API を継続利用できる。
5. 両 `vercel.json` を `{"git":{"deploymentEnabled":{"**":false,"main":true}}}` の設定へ戻して main を反映する。既存Vercelプロジェクトの本番配備成功と公開ドメインへの切り替えを確認する。Node runtime は24系、既存の環境変数・OAuth callback を保持する。
6. 公開ページ・Google認証・保存・未同期操作の再送・PWAのオフライン復帰を確認する。

migration は既存テーブルのデータを消さず、作成操作IDの列と再送用台帳を追加します。ロールバックには migration 000005 を含む Backend を使います。schema version 5 を知らない旧 Backend は再起動できません。台帳を削除・down migrationしないでください。新 Frontend は旧 Backend への送信を保留して端末データを保持しますが、同期を完了させるには Backend の更新が必要です。

2026-10-23の一本化時点の実施結果と本番アクセスの制約は [統合・移行の検証記録](docs/main-consolidation-validation.md) を参照してください。

## フロントエディタエラー解消

フロントエンドの依存関係は Dev Container 作成時に自動インストールされるため、`next` / `react` / `@types/*` 未導入が原因のエディタエラーは基本的に Dev Container で解消できます。

依存関係を入れ直したい場合だけ、Dev Container 内で次を実行してください。

```bash
cd frontend && npm ci --no-audit --no-fund
```

## ライセンス

元のソースコードは MIT License です。詳細は `LICENSE` を参照してください。
