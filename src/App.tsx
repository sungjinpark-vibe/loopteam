import { Asset, Button, Top } from "@toss/tds-mobile";
import "./App.css";

/**
 * Scaffold landing content from create-ait-app, kept as-is until T003 adds
 * the real screens (Step 1 is plumbing only — no UI beyond what already
 * shipped from the scaffold).
 *
 * NOT `React.lazy`-split: `main.tsx`'s `TDSMobileAITProvider` itself
 * statically imports from `@toss/tds-mobile` and is required synchronously
 * at boot, so the ~1.1MB `@toss/tds-mobile` barrel is already on the boot
 * critical path before `App` even renders — splitting `App`'s own import of
 * the same package defers zero bytes while adding a Suspense boundary that
 * would render a blank frame. See vite.config.ts for the actual (SDK-level)
 * bundle-size note.
 */
function App() {
  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>반가워요</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>
            앱인토스 개발을 시작해 보세요.
          </Top.SubtitleParagraph>
        }
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "24px",
        }}
      >
        <Button
          as="a"
          variant="weak"
          href="https://developers-apps-in-toss.toss.im"
          target="_blank"
          rel="noopener noreferrer"
        >
          개발자센터
        </Button>
        <Button
          as="a"
          variant="weak"
          href="https://techchat-apps-in-toss.toss.im"
          target="_blank"
          rel="noopener noreferrer"
        >
          개발자 커뮤니티
        </Button>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <Asset.Image
          alt="apps in toss logo"
          frameShape={{ width: 160 }}
          backgroundColor="transparent"
          src={`${import.meta.env.BASE_URL}appsintoss-logo.png`}
        />
      </div>
    </>
  );
}

export default App;
