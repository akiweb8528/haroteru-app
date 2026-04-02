---
name: haroteru-fullstack-delivery
description: Full-stack implementation guidance for サブスク払ろてる. Use when making code changes across Next.js and Go, deciding where logic belongs, updating auth or env handling, or checking repo-specific security and verification steps.
---

# Haroteru Fullstack Delivery

## Goal

`サブスク払ろてる` を Next.js + Go の既存構成に沿って安全に変更するための実装ガイドです。

## Boundaries

- Frontend routes / layouts: `frontend/src/app`
- Frontend feature UI / hooks / API calls: `frontend/src/features`
- Frontend shared base: `frontend/src/shared`, `frontend/src/providers`
- Backend HTTP entry: `backend/internal/handlers`
- Backend use cases: `backend/internal/services`
- Backend persistence: `backend/internal/repositories`, `backend/internal/models`
- Schema changes: `backend/internal/database/migrations`

新しい機能は、frontend ではまず `features` に閉じ込め、backend では `handlers -> services -> repositories` を崩さないことを優先します。

## Change Rules

- Todo アプリ由来の概念を残さない
- サブスク管理ドメインに沿わない概念を持ち込まない
- 課金関連は削除ではなく「非表示かつ復帰しやすい状態」を優先する
- 実装変更に README や運用メモを追従させる

## Auth And Security

- `next-auth`、`signIn`、`signOut`、`callbackUrl` を触るなら open redirect を疑う
- `callbackUrl` はアプリ内相対パスだけを許可する
- `NEXT_PUBLIC_*` に秘密情報を入れない
- client component から server-only な auth 設定を直接 import しない
- `NEXTAUTH_URL`、backend の `FRONTEND_URL`、Google OAuth callback を揃える
- auth 失敗は「資格情報不正」と「到達不能」を分ける
- Google 連携変更時は `/privacy` とアプリ内 disclosure も更新する
- `CORS` は明示 origin、security headers は frontend / backend 両方で確認する

## Inspect First For Auth / Security Work

- `frontend/src/lib/auth.ts`
- `frontend/src/app/auth/signin/page.tsx`
- `frontend/src/components/auth/SignInButton.tsx`
- `frontend/src/lib/utils.ts`
- `frontend/next.config.js`
- `backend/internal/router/router.go`
- `backend/internal/middleware/cors.go`
- `backend/internal/middleware/security.go`
- `README.md`

## Typical Workflow

1. 必要なら `haroteru-product` skill で前提を確認する
2. 影響範囲を `frontend` / `backend` / `docs` で切り分ける
3. UI と API を機能単位で揃える
4. auth / env / domain 変更では security を先に確認する
5. 必要なら migration と README を更新する
6. frontend は `npm run type-check` と `npm test`、backend は `go test ./...` で確認する
