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
- Database: PostgreSQL
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
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

## 起動

```bash
docker compose up
```

主な起動先:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

## フロントエディタエラー解消

```bash
cd frontend && npm i
```

## ライセンス

元のソースコードは MIT License です。詳細は `LICENSE` を参照してください。
