# LuminaLog — iOS (Swift) App Design Prompts

Design prompts for the design team. Each section below is a self-contained prompt describing one screen (or shared component) of the LuminaLog iOS app — an AI-powered personal journaling app backed by Firebase, with LLM features (insights, prompts, chat) powered by Together AI.

**Global context to include with every prompt:**

> LuminaLog is a personal journaling iOS app. Users capture journal entries as text, voice recordings, video recordings, or photos of handwritten pages (with OCR). The app provides AI-generated summaries, insights, journaling prompts, and an AI chat companion that knows the user's biography and journal history. The design language should feel calm, warm, and reflective — a private sanctuary, not a productivity tool. Native iOS (SwiftUI) conventions: SF Symbols where appropriate, support for Dynamic Type, light and dark mode variants for every screen, safe-area aware layouts for all modern iPhones.

---

## 1. Shared Component — Bottom Navigation Bar

**Prompt:**

Design the persistent bottom navigation bar used across the app. It contains 5 items, left to right:

1. **Home** — house icon, label "Home"
2. **List** — list/journal icon, label "Journal"
3. **Create (+)** — a large circular floating action button, visually distinct (filled, brand accent color, subtle shadow). It sits centered in the bar and extends so that the top half of the circle rises above the top edge of the navigation bar. Tapping it opens the Create Journal Entry view.
4. **Chats** — chat bubble icon, label "Chats"
5. **Settings/Profile** — person icon, label "Profile"

Requirements:

- Show selected vs. unselected states (color, weight, optional small indicator).
- The center "+" button is always prominent and never shows a selected state — it's an action, not a tab.
- The bar must respect the home-indicator safe area.
- Provide light and dark mode variants.
- Show how the bar behaves when a keyboard is visible (it hides).

Deliverables: component spec with dimensions, the raised-circle geometry (how far above the bar edge the button extends — target ~50% of its diameter), touch targets (min 44pt), icon set, and all states.

---

## 2. Home Screen

**Prompt:**

Design the LuminaLog Home screen — the emotional anchor of the app. Vertical layout, top to bottom:

1. **Header:** App name "LuminaLog" with a warm welcome title (e.g., "Good morning, Anna"). Keep it light and personal.
2. **Daily personalized prompt card:** The hero element. A card displaying today's personalized journaling prompt as a quoted question, e.g. *"What moment today made you pause and notice?"*. Below or inside the card, a primary CTA button: **"Start Journaling"** — tapping it opens the Create Journal Entry view with this prompt pre-filled as the question.
3. **Streak counter:** Daily journaling streak count (e.g., "🔥 12-day streak"). Should celebrate consistency without inducing guilt. Consider a compact stat card.
4. **Word count stat:** Total number of words written across the user's journal (e.g., "24,310 words in your journal"). Pair visually with the streak — these two can sit side by side as stat cards.
5. **Recent entries list:** Section titled "Recent entries". A lazily-loaded list of the latest 10 journal entries, each row showing:
   - Date
   - Title
   - First 100 characters of the entry content (truncated with ellipsis)
   - A small type indicator (text / voice / video / image) is welcome but secondary
   - The list expands ("Show more") to load additional entries lazily as the user scrolls.
   - Tapping a row navigates to the Journal Detail view.

Bottom: the shared bottom navigation bar (Home tab selected).

States to design:

- **Default** (user with history)
- **Empty state** (new user: no streak, no entries — inviting first-entry CTA)
- **Loading state** for the entries list (skeleton rows)

Deliverables: full-screen comps for default/empty/loading, light + dark, spacing and typography spec, prompt-card emphasis treatment.

---

## 3. List View (All Journals)

**Prompt:**

Design the Journal List screen — a complete, scrollable archive of all journal entries.

Layout:

- **Header:** Title "Journal". Optional: search field and/or filter chips by entry type (All / Text / Voice / Video / Image) — propose a treatment.
- **Entry rows**, same row anatomy as Home:
  - Title
  - Date **and time**
  - First 100 characters of the entry content
  - Entry-type tag (text / voice / video / image)
- Infinite scroll with lazy loading; show a loading indicator at the bottom while fetching the next page.
- Tapping any row opens the Journal Detail view.
- Consider date grouping (e.g., "This week", "May 2026") to aid scanning — propose with and without grouping.

States: default, loading (skeletons), empty ("No entries yet"), search-no-results.

Bottom navigation bar visible (List tab selected). Light + dark variants.

---

## 4. Journal Detail View

**Prompt:**

Design the Journal Detail screen. Every journal entry has one of four types — **text**, **voice**, **video**, or **image** (photo of a handwritten journal page, which also carries an OCR text field). The entry is stored in Firebase.

**Fixed chrome:**

- Back button (top left).
- **Entry-type tag in the top right** — a small pill labeled "Text", "Voice", "Video", or "Image" with a matching icon. Design all four variants.
- **Tab bar at the top of the content area** with three tabs: **Main · Insights · Prompts**.

### Tab 1 — Main

Top to bottom:

1. **Title** of the entry, with date/time beneath it.
2. **Expandable AI summary:** a collapsed card showing the AI-generated summary of the entry (2–3 lines collapsed, tap to expand). Include a **"Regenerate" button** on the summary card — used when the entry was edited after the summary was generated. Design the regenerating/loading state.
3. **Content area, varies by type:**
   - **Text:** the full journal text.
   - **Image:** the photo(s) of the handwritten journal page(s), tappable to zoom; below the image(s), the **OCR text content** in a clearly labeled section ("Transcribed text").
   - **Voice:** an audio player (play/pause, scrubber, duration); below it the **transcript**.
   - **Video:** an inline video player (16:9 or native aspect, with fullscreen affordance); below it the **transcript**.

   Design all four content variants.

### Tab 2 — Insights

- **Initial state:** an empty-state illustration plus a prominent **"Generate Insights"** button. Tapping it calls the Together AI LLM with the journal content (system prompt lives in a centralized prompts file) and asks it to analyze the entry.
- **Loading state:** the button becomes a progress state ("Analyzing your entry…").
- **Result state:** the generated insights rendered as readable, well-spaced content (cards or sections — themes, emotions, observations). Insights are saved to the entry's `insights` field in Firebase, so on revisit this tab shows the saved insights directly, with an option to regenerate.

### Tab 3 — Prompts

- **Initial state:** empty state plus a **"Generate Prompts"** button. Tapping it calls the Together AI LLM (centralized system prompt) to generate **5 journaling prompts** related to this entry's theme.
- **Loading state.**
- **Result state:** 5 prompt cards, each showing the prompt question and a **"→" button** that opens the **Create Journal Entry view with that prompt pre-filled at the top as the question**.

Deliverables: comps for all three tabs × relevant states, the four type-tag pills, the four Main-tab content variants, light + dark.

---

## 5. Create Journal Entry View

**Prompt:**

Design the Create Journal Entry screen — opened from the center "+" button in the bottom nav, from "Start Journaling" on Home, or from a generated prompt (in which case the prompt question appears pre-filled at the top of the view).

Layout, top to bottom:

1. **Title:** "Journal Entry" at the top. Include a Cancel/close affordance and a **Save** action.
2. **Optional prompt banner:** when launched from a daily prompt or a generated prompt, the question is displayed at the top of the view (above the input) as a styled quote/banner. Design with and without this banner.
3. **Large text input box:** the dominant element — a big, inviting multiline editor that grows with content. Placeholder like "Write what's on your mind…".
4. **Speech-to-text button:** below the text box, a button to start live speech-to-text transcription into the editor. Design idle / actively-listening (waveform or pulsing mic) / paused states.
5. **Bottom media row** — a row of capture buttons along the bottom of the view:
   - **Mic (record)** — record a voice entry.
   - **Photo** — opens a choice: take a photo or select from the photo library; **multiple photos** can be taken/uploaded (these become image-type entries with OCR).
   - **Video** — record a video or upload one from the library.

   Design the row's icons and the photo source-selection (action sheet or custom popover), plus a thumbnail strip showing attached photos/video with remove (×) controls.

States: empty, text-in-progress, prompt-pre-filled, speech-to-text active, media attached, saving.

Keyboard-avoidance behavior must be shown (editor stays visible; media row relationship with keyboard). Light + dark.

---

## 6. Chats — List View

**Prompt:**

Design the Chats screen (4th tab) — a history of the user's conversations with their AI journal companion. The AI has context about the user's biography, bio, and journal entries.

Layout:

- **Header:** Title "Chats". **Top right: a new-chat button** that, when tapped, expands/presents **two options: "Start Text Chat" and "Start Voice Chat"** — design this disclosure (menu, sheet, or expanding buttons).
- **Chat history list:** each row shows the conversation title or first message snippet, date/time of last activity, and an icon distinguishing text chats vs. voice calls. Tapping a row opens that conversation with full history.
- Swipe-to-delete on rows is welcome.

States: default, empty ("Talk to your journal" invitation with the two start options surfaced), loading.

Bottom navigation visible (Chats tab selected). Light + dark.

---

## 7. Chat Conversation View (Text)

**Prompt:**

Design the text chat conversation screen — an LLM conversation (Together AI, centralized system prompt) where the AI companion knows the user's bio and journal context.

- Standard chat layout: user bubbles right, AI bubbles left; timestamps; AI typing/streaming indicator.
- Input bar at the bottom: text field, send button, and a mic affordance to dictate.
- Back navigation to the Chats list; chat title in the nav bar.
- The AI's voice in the UI should feel like a thoughtful companion, not a generic assistant — reflect that in tone of microcopy and visual softness of bubbles.

States: fresh conversation (AI greeting referencing journal context), active conversation, AI responding (streaming), error/retry on a failed message. Light + dark.

---

## 8. Voice Call View

**Prompt:**

Design the voice call screen — started from "Start Voice Chat". A real-time voice conversation with the AI companion.

Two display modes the user can toggle between:

1. **Voice animation mode (default):** a large, calming audio-reactive animation (orb/waveform) that responds to who's speaking (user vs. AI), with the AI's state shown (listening / thinking / speaking).
2. **Text transcript mode:** a live chat-history view of the conversation transcribed in real time (same bubble language as the text chat).

Controls: mute mic, toggle animation/transcript view, end call (prominent, red). Show call duration.

States: connecting, AI listening, AI speaking, user speaking, ended (with option to view the saved transcript in Chats). Light + dark — this screen can lean into a darker, immersive treatment even in light mode; propose direction.

---

## 9. Profile & Settings View

**Prompt:**

Design the Profile & Settings screen (5th tab).

Layout, top to bottom:

1. **Profile section:**
   - **User photo** with upload/change affordance (tap avatar → take photo or choose from library).
   - **User name** (editable).
   - **User biography:** a multiline text field where the user describes themselves; saved to the `users` collection in Firebase and used as context by the AI chat. Make its purpose clear with helper text (e.g., "Your bio helps your AI companion know you better"). Design view and edit states.
2. **Settings section** (grouped list):
   - **Subscription** — current plan, manage/upgrade entry point.
   - **Sign Out**
   - **Delete Account** — destructive styling, with a confirmation dialog design (type-to-confirm or double confirmation).

States: default, editing bio, photo source action sheet, delete-account confirmation. Bottom navigation visible (Profile tab selected). Light + dark.

---

## 10. Design System Notes (for all prompts)

- **Tone:** calm, warm, reflective; generous whitespace; soft corners; restrained color with one warm accent.
- **Typography:** propose a system — likely SF Pro / New York serif pairing for a journal feel (serif for entry content and prompts, sans for UI chrome).
- **Color:** light and dark palettes; the daily prompt and the "+" button carry the accent.
- **Components to spec once and reuse:** entry row, entry-type pill, stat card, prompt card, AI-action button (generate/regenerate with loading), audio player, transcript block, chat bubble.
- **Accessibility:** Dynamic Type, 44pt touch targets, WCAG AA contrast, VoiceOver labels for all icon-only buttons (especially the media capture row and the "+" FAB).
