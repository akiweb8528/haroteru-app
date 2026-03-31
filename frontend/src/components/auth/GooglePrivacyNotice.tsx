import Link from 'next/link';

interface Props {
  className?: string;
}

export function GooglePrivacyNotice({ className = '' }: Props) {
  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-100 ${className}`.trim()}
    >
      <p className="font-medium">Google 連携で扱う情報</p>
      <p className="mt-2 leading-6">
        Google 連携では、アカウント識別子、メールアドレス、表示名、プロフィール画像を本人確認と同期アカウント管理のために利用します。
        登録したサブスク情報は、同期を有効にした場合のみサーバーへ保存されます。Gmail、Google Drive、Google Calendar
        などの追加データにはアクセスしません。
      </p>
      <p className="mt-2 leading-6">
        Google ユーザーデータを広告目的で販売・共有することはありません。詳しくは
        {' '}
        <Link href="/privacy" className="font-semibold underline underline-offset-2">
          プライバシーポリシー
        </Link>
        {' '}
        をご確認ください。
      </p>
    </div>
  );
}
