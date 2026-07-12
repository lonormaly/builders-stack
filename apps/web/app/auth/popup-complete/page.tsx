// Where Better Auth lands the browser after social OAuth completes (passed as
// `callbackURL` from the auth page — a WEB-origin page, so the session cookie for the
// api origin is already set by the time we get here).
//
// The signal runs from an INLINE script that executes at HTML-parse time — NOT a
// React effect — so the opener hears "done" the instant this page's HTML lands,
// with zero Next-runtime download/hydration wait (that lag was the bug). Popup
// flow: broadcast "done" over BroadcastChannel (COOP-safe; the opener also polls
// popup.closed as a backstop) then close. Redirect flow (popup blocked → no
// opener): navigate home so the gate revalidates on mount.
const SIGNAL = `
(function () {
  try {
    if (window.opener) {
      var bc = new BroadcastChannel("stack-oauth-done");
      bc.postMessage("done");
      bc.close();
      window.close();
    } else {
      window.location.href = "/";
    }
  } catch (e) {
    window.location.href = "/";
  }
})();
`;

export default function PopupComplete() {
  return (
    <div className="mx-auto max-w-md">
      <script dangerouslySetInnerHTML={{ __html: SIGNAL }} />
      <p className="text-sm text-muted-foreground">One moment…</p>
    </div>
  );
}
