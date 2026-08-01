import AdminPageIntro from "../../AdminPageIntro";
import NewsletterComposer from "../NewsletterComposer";

export default function ComposeNewsletterPage() {
  return (
    <main>
      <AdminPageIntro title="撰寫電子報" description="建立內容後，可先測試寄送給自己，確認無誤再正式寄出或排程。" />
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <NewsletterComposer />
      </div>
    </main>
  );
}
