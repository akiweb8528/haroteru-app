# Haroteru Fullstack Delivery

## Goal

この skill は、`サブスク払ろてる` を Next.js + Go の既存構成に沿って変更するための実装ガイドです。

## Frontend Boundaries

- `frontend/src/app`
  - ルーティング、レイアウト、ページエントリ
- `frontend/src/features`
  - 機能単位の UI、hooks、feature 専用 API 呼び出し
- `frontend/src/shared`
  - feature 横断で再利用する共通基盤
- `frontend/src/providers`
  - セッション、テーマ、設定などのアプリ全体状態

Frontend では、新しい機能を追加するときに `app` へロジックを直接積まず、まず `features` に閉じ込めることを優先します。

## Backend Boundaries

- `backend/internal/handlers`
  - HTTP 入出力
- `backend/internal/services`
  - ユースケースと業務ロジック
- `backend/internal/repositories`
  - DB 永続化
- `backend/internal/models`
  - 永続化モデル
- `backend/internal/database/migrations`
  - スキーマ変更

Backend では、handler から repository を直接触らず、service を経由させます。

## Change Rules

- プロダクト名や文言は Todo アプリの面影を残さない
- サブスク管理ドメインに沿わない概念を持ち込まない
- 課金関連は削除ではなく「非表示かつ復帰しやすい状態」を優先する
- 変更時は frontend と backend の責務境界を崩さない
- ドキュメント更新を実装変更に追従させる

## Security Rules

- `next-auth`、`signIn`、`signOut`、`callbackUrl` を触る変更では open redirect を疑う
- `callbackUrl` はそのまま `redirect()` や `window.location` に渡さず、アプリ内相対パスだけを許可する
- `NEXT_PUBLIC_*` に秘密情報を入れない
- client component から server-only な認証設定ファイルを直接 import しない
- staging / production の `NEXTAUTH_URL`、backend の `FRONTEND_URL`、Google OAuth callback を揃える
- auth 系失敗は「資格情報不正」と「到達不能・ネットワーク失敗」を分ける
- frontend / backend の両方で baseline security headers を確認する
- `CORS` は許可 origin を明示し、ワイルドカードを避ける

## Security Files To Inspect First

- `frontend/src/lib/auth.ts`
- `frontend/src/app/auth/signin/page.tsx`
- `frontend/src/components/auth/SignInButton.tsx`
- `frontend/src/components/auth/DevSignInForm.tsx`
- `frontend/src/lib/utils.ts`
- `frontend/next.config.js`
- `backend/internal/router/router.go`
- `backend/internal/middleware/cors.go`
- `backend/internal/middleware/auth.go`
- `backend/internal/middleware/security.go`
- `README.md`

## Typical Work Pattern

1. まず product skill で前提を確認する
2. 影響範囲を `frontend` / `backend` / `docs` で切り分ける
3. 機能単位で UI と API を揃える
4. 認証、redirect、env、domain を触る変更では security rules を先に確認する
5. 必要なら migration と README を更新する
6. frontend は `npm run type-check` と `npm test`、backend は `go test ./...` で確認する
