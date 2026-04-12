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
- `JWT_SECRET`
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

`.devcontainer/devcontainer.json` で Node.js 20 / Go 1.26 / Docker を揃えており、`postCreateCommand` で `frontend` の `npm install` と `backend` の `go mod download` を自動実行します。

主な起動先:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

backend を Docker ではなくローカルで直接起動する場合も、リポジトリ直下の `.env` を読めます。`DATABASE_URL` が無い場合は `POSTGRES_*` からローカル向け接続文字列を自動で組み立てます。

```bash
cd backend
go run ./cmd/server
```

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

- Name: `haroteru-backend`
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
- `PUBLIC_API_URL`: `https://haroteru-backend.onrender.com` など production backend の公開 URL
- `FRONTEND_URL`: Vercel production frontend の公開 URL
- `DEV_AUTH_ENABLED=false`

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
- frontend: `DEV_AUTH_ENABLED=true`
- 必要に応じて backend 側で `DEV_AUTH_EMAIL`, `DEV_AUTH_NAME` も指定可能

この導線は staging / debug 用の補助機能で、production では `false` のまま運用してください。

## CI / CD

GitHub Actions の CI は `.github/workflows/ci.yml` で管理しています。

- 対象ブランチ: `main`, `staging`
- backend: `go test ./...`
- frontend: `npm ci`, `npm run type-check`, `npm test`

CD は frontend が Vercel の branch 連携、backend は staging のみ Render Blueprint を使う前提にしています。

- `staging` ブランチ: Render staging Blueprint と Vercel staging frontend に連携
- `main` ブランチ: Vercel production frontend に連携
- production backend: Render ダッシュボード上の通常 Web Service を更新して運用

このため、基本運用は次の形です。

1. feature ブランチから `staging` へ PR
2. CI 通過後に `staging` へマージ
3. Render staging backend と Vercel staging frontend が自動デプロイ
4. 動作確認後に `main` へ反映
5. Vercel production frontend が自動デプロイ
6. 必要に応じて Render production backend を手動デプロイ、または Render ダッシュボードで設定変更を反映

## フロントエディタエラー解消

フロントエンドの依存関係は Dev Container 作成時に自動インストールされるため、`next` / `react` / `@types/*` 未導入が原因のエディタエラーは基本的に Dev Container で解消できます。

依存関係を入れ直したい場合だけ、Dev Container 内で次を実行してください。

```bash
cd frontend && npm install
```

## ライセンス

元のソースコードは MIT License です。詳細は `LICENSE` を参照してください。
