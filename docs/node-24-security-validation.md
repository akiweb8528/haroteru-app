# Node.js 24 セキュリティ更新の検証

検証日: 2026-10-22（日本時間）。作業起点は `origin/staging` の `e1c4841d`。当時の `origin/main` は `f6d3d308` で、差は AGENTS.md の UI quality gate 追記のみ。

## 更新内容

- ホスト選択用 `.nvmrc`、Dev Container Node feature、CI を `24.22.1` に固定。CI では `process.version` を表示し、完全一致を確認する。
- Docker builder / runner / 開発用を公式 `node:24.22.1-alpine` に固定。
- `frontend/package.json` の engines は `>=24.22.1 <25`。Node.js 20 / 24.22.0 / 25 を拒否し、24.22.1 / 24.23.0 を許容する制約。
- `@types/node` を 24 系へ揃えた。Next.js 14.2.35 / React 18 と既存のテストツールは維持。
- Docker が要求する `.next/standalone` を出力する設定を追加。standalone の画像最適化に必須の `sharp` を production 依存へ追加し、ホストの `node_modules` / `.next` / env ファイルを Docker build context から除外した。
- Dev Container / Docker 開発用の依存導入は `npm ci`。Dev Container は frontend 内で lock 済み Playwright を導入する。
- E2E の `PLAYWRIGHT_FRONTEND_URL` のポートを起動コマンドにも反映。他セッションが利用する 3000 番を変更せず検証可能にした。

## ホストでの検証

WSL Linux x64 に、公式配布物の SHA256 を照合した Node.js `v24.22.1` / npm `11.19.1`、Go `go1.26.10 linux/amd64` を一時領域へ導入した。既存 fnm にも 24.22.1 を追加導入して実行し、default は 24.19.0 のまま維持した。グローバルの Node.js / Go 選択や他シェルの実行環境は変更していない。ホストから継承された `DEBUG` が Next.js 14 の test-mode 判定を有効化し、開発起動時に npm registry へのバージョン確認で待機することがあった。手動ブラウザ確認用の起動では当該プロセスだけ `env -u DEBUG -u NEXT_TEST_MODE -u __NEXT_TEST_MODE` とし、通常の開発起動を確認した。

- `cd frontend && npm ci --no-audit --no-fund`: 成功。
- `npm run lint`: 成功（ESLint 警告・エラーなし）。
- `npm run type-check`: 成功。
- `npm test`: 16 ファイル、97 テスト成功。認証キャッシュ、PWA / offline navigation、offline 設定同期、操作キューのテストを含む。
- `npm run build`: 成功。Next.js 14.2.35、静的 13 ページ、PWA Service Worker、standalone を生成。
- `cd backend && go test ./...`: 成功。
- `sharp` の native libvips をロードし、PNG の resize / encode が成功。

### Playwright

Node.js `v24.22.1`、Playwright `1.55.0` / Chromium `140.0.7339.16`、Go `1.26.10`、今回専用のローカル PostgreSQL コンテナを使用。frontend は `http://127.0.0.1:3300`、backend は `http://127.0.0.1:8080`。本番 DB、外部認証情報、通常のローカル DB は使用していない。

```bash
PLAYWRIGHT_FRONTEND_URL=http://127.0.0.1:3300 \
PLAYWRIGHT_E2E_DATABASE_URL='postgres://haroteru_user:haroteru_password@127.0.0.2:15432/haroteru_db?sslmode=disable' \
PLAYWRIGHT_E2E_DEV_AUTH_EMAIL=node24-migration@haroteru.local \
npm run test:e2e
```

既存 E2E 全 10 件が成功（2.0 分）。ゲストの追加・reload 後保持、NextAuth 検証用認証と Go / DB 接続、追加・削除・編集・設定同期、検索、支払周期、金額順、drag-and-drop 並び替えと reload 後保持を確認した。

CI の E2E runner は、Playwright 1.55 が対応する `ubuntu-24.04` に固定した。`ubuntu-latest` の Ubuntu 26.04.1 ではブラウザ導入時に `Playwright does not support chromium on ubuntu26.04-x64` で失敗したため、Dev Container とローカル検証に揃えた。Node.js 24.22.1 と既存 Playwright の組み合わせは維持している。

## コンテナとブラウザ

Docker の最終 runner を `http://localhost:3301` で起動。`/`、`/api/auth/providers`（ダミー Google 設定）、`/api/auth/session`、`/sw.js` は HTTP 200。`/_next/image?url=%2Ficon.png&w=64&q=75` に `Accept: image/webp` を付けたリクエストは HTTP 200 / `image/webp`（1516 bytes）となり、sharp の実変換も成功。

Chrome DevTools MCP の隔離 context で Docker production runner を実操作した。Service Worker は activated、ページは `/sw.js` に制御され、precache / RSC / images cache を確認。ゲスト項目を UI から 500 円で追加して reload 後保持し、DevTools の Offline 状態で 750 円とメモに編集して offline reload 後の保持を確認した。Offline のままプライバシーポリシーへリンク遷移し、ホームへ戻れた。通信解除後は session API が HTTP 200 となり、編集も保持された。BrandLogo 画像も読み込み成功（naturalWidth > 0）。

DevTools のネットワーク遮断は session API の `ERR_INTERNET_DISCONNECTED` で確認した。この Chrome の実測では navigator.onLine は true のままだったため、ネットワーク遮断と online 状態は区別した。online の console に問題はなく、遮断中のみ NextAuth CLIENT_FETCH_ERROR / ネットワークエラーが発生した。検証用ページを閉じ、元の about:blank ページだけが残ったことをページ一覧で確認。

Dev Container CLI で実際に構築・起動し、`vscode` ユーザーで Node.js `v24.22.1` / npm `11.19.1` / Go `1.26.10` を実測した（feature 導入後の実行。postCreateCommand は省略し、同じ lock の npm ci / 検証はホストと Docker で別途実行）。今回の Dev Container と新規 DinD volume は実測後に除去した。

Docker 開発用と builder の実測は Node.js `v24.22.1` / sharp `0.35.5` / vips `8.18.7` / heif `1.23.5`。runner も Node.js `v24.22.1` / sharp `0.35.5` / vips `8.18.7`。runner は standalone trace が versions.json を含めないため heif のメタデータは undefined だが、実ロードする libvips.so の SHA256 は heif 1.23.5 を実測した開発用 image と一致した（`979b625437190a1970b835164e0e30d47dc60159ce6a394ce78cc40cb9d59ab8`）。

認証済み操作も Chrome DevTools MCP の隔離 context で実施。実際の検証コードフォームから専用ユーザーでサインインし、DevPwaPanel の OFFLINE ボタンと DevTools のネットワーク遮断を併用した（navigator.onLine = false、dev SW active）。

- offline で UI から 900 円の項目を追加し、1200 円とメモに編集。キューは create 1 件へ統合され、PostgreSQL の `public.tracked_subscriptions` は 0 件のまま。通信解除と ONLINE ボタン操作後は pending 0、サーバー ID が採番され、DB の 1200 円 / メモが一致した。
- 既存項目を offline で 1500 円へ編集。キューは update、DB は 1200 円を維持。復帰後は pending 0 / DB 1500 円となった。
- 既存項目を offline で削除。キューは delete、DB は 1 件を維持。復帰後は pending 0 / DB 0 件となった。

DB の各状態は専用 PostgreSQL に対する psql の直接照会で確認。認証済み検証の console warning / error は 0 件。検証ページを閉じ、元の about:blank ページだけが残ることを確認した。今回起動したホスト frontend / backend は所有 PID とポートを確認して停止した。

Dockerfile と CI の npm ci は registry の audit endpoint 待ちを依存導入から切り離すため `--no-audit --no-fund` とした。CI でも依存導入が 4 分以上続くことを観測したため、同じ方針へ揃えた。依存監査の結果は別途記録している。最終 flags で builder / runner / 開発用の全 image を再 build し、すべて exit 0。各 image 内の Node.js が `v24.22.1` であることを再確認した。最終 runner を再起動し、上記 HTTP 応答と WEBP 変換も再確認した。

検証ログは当セッションの `/tmp/haroteru-node24-verification/`（`final-runtime-verification.json` と各 build / runtime log）。今回作成した runner / Dev Container / DinD volume / PostgreSQL と匿名 volume は削除し、検証用 DB のユーザー・データも残していない。既存の別作業のサーバー（3000 番など）には操作していない。

## 残る確認と運用

- Google の実 OAuth フローは外部アカウントを使わず未実施。NextAuth / Google provider、callback の構造は変更していない。
- `npm audit --json` は移行前から固定されている依存に 40 件（critical 2 / high 28 / moderate 9 / low 1）を報告した。今回の Node.js ランタイム修正とは別の依存監査であり、一斉アップグレードや `audit fix` は行っていない。
  - Next.js の critical には Windows hosting と [AVIF 画像最適化](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)の RCE がある。検証した実行先は Linux。後者の advisory は Next 15.5.24 / 16.3.3 の AVIF 最適化無効化を示す。今回導入した sharp 0.35.5 はホストで libheif 1.23.5 を実測し、[libheif の元 advisory](https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497) が示す修正版 1.23.2 以降を使用している。Next.js パッケージ自体への audit 指摘は引き続き残り、依存監査・メジャー更新は別課題。
  - NextAuth の [email 正規化](https://github.com/advisories/GHSA-7rqj-j65f-68wh)は email / magic-link provider が対象。このリポジトリの provider は Google / 検証用 Credentials で、該当 provider は未使用。
- Vercel project は本番 `haroteru-frontend`、staging `haroteru-frontend-staging`。Project Settings の Node.js version / Root Directory の現在値と稼働中の正確な Node.js patch は接続権限のある設定 API がなく未確認。
- Vercel 側で Root Directory が `frontend`（engines 宣言のある package.json）であることと Node.js 24.x を確認・設定し、staging Preview の build / function 実行ログで 24.22.1 以上の 24 系を確認後、通常のリリース手順で production を再デプロイする。既存デプロイは Git 更新だけでは置き換わらない。設定変更・本番デプロイは今回実施していない。
- Go backend の Render は Node.js 移行対象外。

公式情報: [2026-10 セキュリティリリース](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)、[Node.js 24.22.1](https://nodejs.org/en/blog/release/v24.22.1/)、[Next.js 14.2.35 の sharp / standalone 要件](https://github.com/vercel/next.js/blob/v14.2.35/errors/sharp-missing-in-production.mdx)。
