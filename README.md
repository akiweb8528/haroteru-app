# サブスク払ろてる

Next.js + Go を用いたポートフォリオ用のフルスタック実装です。

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
- ロック状態、見直し優先度、カテゴリで整理できる
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

- `skills/haroteru-product`: プロダクトの前提、UI コピーの方向性、課金機能の扱いなどをまとめた skill
- `skills/haroteru-fullstack-delivery`: Next.js + Go 構成で変更を入れる際の責務分離と実装方針をまとめた skill
- `.serena/project.yml`: Serena のプロジェクト設定。Go / TypeScript を対象にしたローカルエージェント運用の前提

## 開発用環境変数

`.env.example` をコピーして `.env` を作成してください。

最低限必要なもの:

- PostgreSQL 接続情報
- `DATABASE_URL`
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

## 本番 DB / デプロイ

本番 DB は Neon を前提にしています。`DATABASE_URL` には Neon が発行する接続 URL をそのまま設定してください。

- ローカル開発: `postgres://...@localhost:5432/...?...`
- 本番 / staging: Neon の `postgres://...neon.tech/...` を使用

バックエンドでは Neon ホストの URL に `sslmode` が未指定でも `sslmode=require` を補うため、そのまま接続できます。

backend 用の Render Blueprint は `infra/render/` 配下で管理しています。

- staging: `infra/render/staging.yaml`
- production: `infra/render/production.yaml`

Blueprint 作成時は Render の `Blueprint Path` で対象ファイルを指定してください。

初回作成時に Render で入力する値:

- `haroteru-backend-staging`
- `DATABASE_URL`: Neon の接続 URL
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_API_URL`: backend の公開 URL。例: `https://haroteru-backend-staging.onrender.com`
- `FRONTEND_URL`: frontend の公開 URL例: `https://haroteru-staging.vercel.app`

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

Google OAuth の設定では、以下の callback / origin を追加してください。

- Authorized JavaScript origins: frontend の公開 URL
- Authorized redirect URIs: `https://<frontend-domain>/api/auth/callback/google`

Google OAuth の切り分け用に、開発・検証専用の簡易サインインも用意しています。

- backend: `DEV_AUTH_ENABLED=true`, `DEV_AUTH_CODE=<secret>`
- frontend: `DEV_AUTH_ENABLED=true`
- 必要に応じて backend 側で `DEV_AUTH_EMAIL`, `DEV_AUTH_NAME` も指定可能

この導線は staging / debug 用の補助機能で、production では `false` のまま運用してください。

production 用 backend Blueprint を作る場合も、`infra/render/production.yaml` を指定してください。backend は `haroteru-backend` のままなので、`PUBLIC_API_URL` には `https://haroteru-backend.onrender.com` を設定してください。frontend 側は Vercel の production URL を `NEXTAUTH_URL` と `FRONTEND_URL` に反映します。

## CI / CD

GitHub Actions の CI は `.github/workflows/ci.yml` で管理しています。

- 対象ブランチ: `main`, `staging`
- backend: `go test ./...`
- frontend: `npm ci`, `npm run type-check`, `npm test`

CD は backend が Render Blueprint、frontend が Vercel の branch 連携を前提にしています。

- `staging` ブランチ: staging 用 Blueprint に連携
- `main` ブランチ: production 用 Blueprint に連携

このため、基本運用は次の形です。

1. feature ブランチから `staging` へ PR
2. CI 通過後に `staging` へマージ
3. Render staging backend と Vercel staging frontend が自動デプロイ
4. 動作確認後に `main` へ反映
5. Render production backend と Vercel production frontend が自動デプロイ

## フロントエディタエラー解消

フロントエンドの依存関係は Dev Container 作成時に自動インストールされるため、`next` / `react` / `@types/*` 未導入が原因のエディタエラーは基本的に Dev Container で解消できます。

依存関係を入れ直したい場合だけ、Dev Container 内で次を実行してください。

```bash
cd frontend && npm install
```

## ライセンス

元のソースコードは MIT License です。詳細は `LICENSE` を参照してください。
