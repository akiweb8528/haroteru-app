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

- Frontend unit/component: `cd frontend && npm run lint && npm run type-check && npm test`
- Frontend E2E: `cd frontend && npm run test:e2e`
- Backend: `cd backend && go test ./...`
- UI 変更は mobile での見え方とスクロール位置も確認する

## Test Boundaries

- unit/component test は `frontend/src/**/*.{test,spec}.{ts,tsx}` に寄せる
- Playwright E2E は `frontend/e2e/**/*.spec.ts` に寄せる

## Git Workflow

- PR を作成する場合は、base branch を `staging` にする

## コミット規約 (Conventional Commits)

コミットメッセージは以下の形式に従う。リリースタグの自動判定に使用される。

```
<type>[optional scope][optional !]: <description>
```

### type 一覧

| type | 用途 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみの変更 |
| `refactor` | リファクタリング（機能変更なし） |
| `test` | テストの追加・修正 |
| `chore` | ビルド設定・依存関係・補助ツールの変更 |
| `perf` | パフォーマンス改善 |
| `style` | コードスタイルの変更（動作に影響なし） |

### Breaking Change

`type` の後に `!` をつける。

```
feat!: 認証フローを刷新
fix(api)!: レスポンス形式を変更
```

### バージョン自動判定ルール

`main` へのマージ時に GitHub Actions がタグを自動生成する。

| マージ元ブランチ | 判定ルール | バージョン変化例 |
|-----------------|-----------|----------------|
| `hotfix/*` | 常に patch | `v1.2.3` → `v1.2.4` |
| その他 (`staging` など) | コミット解析 | — |
| └ `fix:` のみ含む | patch | `v1.2.3` → `v1.2.4` |
| └ `feat:` を含む | minor | `v1.2.3` → `v1.3.0` |
| └ `!` を含む | major | `v1.2.3` → `v2.0.0` |

## Skills

- `skills/haroteru-product`: プロダクト前提、用語、UX の判断基準
- `skills/haroteru-fullstack-delivery`: 実装配置、変更規律、認証とセキュリティ確認
