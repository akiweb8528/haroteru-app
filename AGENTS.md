# Haroteru Agents Guide

## Product Shape

- `サブスク払ろてる` は、登録なしですぐ使えるサブスク支出ダッシュボード
- 主役は「支出の把握」と「見直しのきっかけ作り」
- ログインは必須機能ではなく、同期のための追加価値
- 家計簿化しすぎず、軽さ・速さ・親しみやすさを保つ

## Architecture

- Frontend: Next.js App Router in `frontend/`
- Backend: Go + Echo + GORM in `backend/`
- Frontend UI / hooks / feature API は `frontend/src/features` を優先
- `frontend/src/app` にはルーティングとページ entry を置く
- Backend は `handlers -> services -> repositories -> models` を守る

## Current Domain Rules

- subscription は管理対象のサブスク項目
- `locked` は継続前提で固定したい項目
- ゲスト利用時のデータはブラウザ保存
- Google ログイン時のみサーバー同期を有効化
- 課金機能は将来復帰しやすい形で非表示にしておく

## UX Rules

- 1 画面で状況把握しやすいことを優先
- 初見ユーザーでもすぐ入力できることを重視
- テキストは `simple` / `ossan` の 2 テイストを壊さない
- 似た役割の UI は見た目と見出しを明確に分ける

## Auth And Security

- `callbackUrl` は相対パスだけを許可する
- auth 失敗は「資格情報不正」と「到達不能」を分ける
- `NEXT_PUBLIC_*` に秘密情報を入れない
- client component から server-only な auth 設定を直接 import しない
- `NEXTAUTH_URL`、backend の `FRONTEND_URL`、Google OAuth callback を揃える
- Google 連携変更時は `/privacy` とアプリ内 disclosure も更新する

## Verification

- Frontend: `cd frontend && npm run lint && npm run type-check && npm test`
- Backend: `cd backend && go test ./...`
- UI 変更は mobile での見え方とスクロール位置も確認する

## Git Workflow

- PR を作成する場合は、base branch を `staging` にする

## Skills

- `skills/haroteru-product`: プロダクト前提、用語、UX の判断基準
- `skills/haroteru-fullstack-delivery`: 実装配置、変更規律、認証とセキュリティ確認
