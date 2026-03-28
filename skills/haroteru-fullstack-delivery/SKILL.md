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

## Typical Work Pattern

1. まず product skill で前提を確認する
2. 影響範囲を `frontend` / `backend` / `docs` で切り分ける
3. 機能単位で UI と API を揃える
4. 必要なら migration と README を更新する
