# Desktop Internationalization (i18n) Support

## Summary

Add internationalization support to the Claw Wallet Desktop app, enabling users to use the application in English or Simplified Chinese, with the infrastructure to easily add more languages in the future.

## Motivation

Currently, the Desktop app has all text hardcoded in English. To serve a global user base, especially Chinese-speaking users, we need multi-language support.

**User Value**:
- Chinese users can use the app in their native language
- Reduced friction for international adoption
- Professional appearance in target markets

**Business Value**:
- Expands addressable market
- Increases user satisfaction and retention
- Positions product as international-ready

## Goals

### Primary Goals
1. ✅ Support English (en) and Simplified Chinese (zh-CN)
2. ✅ Auto-detect system language on first launch
3. ✅ Allow manual language switching via UI (Header)
4. ✅ Persist language preference across sessions
5. ✅ Runtime language switching (no app restart needed)

### Non-Goals
- Traditional Chinese (zh-TW) support - future enhancement
- Right-to-left (RTL) language support - not needed yet
- Main process translation - handle in next iteration
- Translation management platform integration - manual for now
- Pluralization/number formatting - simple text replacement only

## Scope

### In Scope
- **Renderer Process**: All UI text in HTML and JavaScript
- **Translation Coverage**:
  - Setup flow (welcome, password, mnemonic)
  - All tabs (Home, Pairing, Settings, Security, Activity)
  - Buttons, labels, placeholders
  - Error messages and validation text
  - Modal dialogs

- **Infrastructure**:
  - i18next framework integration
  - Translation file structure
  - Language detection and fallback
  - Language switcher UI component
  - Preference persistence

### Out of Scope
- Main process notifications/system tray (future)
- Dynamic content re-rendering (Activity lists, etc.) - only static UI updates
- Complex i18n features (plurals, ICU format, date/time localization)
- Translation tooling/automation

## User Experience

### First Launch
```
1. User opens Desktop app for first time
2. System detects OS language via app.getLocale()
3. If zh-*, load zh-CN; otherwise load en
4. User sees UI in detected language
```

### Language Switching
```
1. User clicks language selector in Header (top-right)
2. Dropdown shows: English | 简体中文
3. User selects language
4. Static UI updates immediately (buttons, labels, tabs)
5. Preference saved to localStorage
6. Dynamic content (lists) updates on next navigation
```

### Language Persistence
```
1. Language preference stored in localStorage
2. On app restart, loads saved language
3. Falls back to system language if no preference
```

## Technical Approach

### Architecture

```
┌──────────────────────────────────────────────────────┐
│              Desktop i18n Architecture                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Renderer Process Only                               │
│  ┌────────────────────────────────────────────────┐ │
│  │  app.js                                        │ │
│  │  ├─ i18next.init() on startup                 │ │
│  │  ├─ Detect: localStorage → app.getLocale()    │ │
│  │  ├─ Load: resourcesToBackend                  │ │
│  │  └─ Update: updateStaticTexts()               │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Translation Files (by feature)                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  locales/                                      │ │
│  │    ├─ en/                                      │ │
│  │    │  ├─ common.json    (~20 keys)            │ │
│  │    │  ├─ setup.json     (~25 keys)            │ │
│  │    │  ├─ activity.json  (~20 keys)            │ │
│  │    │  ├─ security.json  (~15 keys)            │ │
│  │    │  ├─ settings.json  (~15 keys)            │ │
│  │    │  ├─ errors.json    (~20 keys)            │ │
│  │    │  └─ pairing.json   (~12 keys)            │ │
│  │    └─ zh-CN/ (same structure)                 │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Language Switcher (Header)                          │
│  ┌────────────────────────────────────────────────┐ │
│  │  <select id="language-selector">              │ │
│  │    <option value="en">English</option>        │ │
│  │    <option value="zh-CN">简体中文</option>    │ │
│  │  </select>                                     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Translation Key Naming

**Hierarchical, semantic structure**:

```json
{
  "feature": {
    "section": {
      "element": "Translation text"
    },
    "buttons": {
      "action": "Button text"
    }
  }
}
```

**Example**:
```json
{
  "setup": {
    "welcome": {
      "title": "Welcome to Claw Wallet",
      "description": "Create a new wallet or import an existing one"
    },
    "buttons": {
      "create": "Create New Wallet",
      "import": "Import Wallet"
    }
  }
}
```

### UI Update Strategy

**Static Elements** (updated on language change):
- Page titles (`<h1>`, `<h2>`, `<h3>`)
- Buttons (`<button>`)
- Labels (`<label>`)
- Input placeholders
- Tab names
- Error/success messages

**Dynamic Elements** (not updated, refresh on navigation):
- Activity record lists
- Balance displays
- Transaction history
- Dynamically generated content

Implementation:
```javascript
function updateStaticTexts() {
  // Update text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = i18next.t(el.getAttribute('data-i18n'));
  });
  
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = i18next.t(el.getAttribute('data-i18n-placeholder'));
  });
}
```

### Language Detection

```javascript
function detectLanguage() {
  // 1. Check localStorage (user preference)
  const saved = localStorage.getItem('language');
  if (saved) return saved;
  
  // 2. Check system language
  const systemLang = navigator.language || navigator.userLanguage;
  
  // 3. Apply fallback logic
  if (systemLang.startsWith('zh')) return 'zh-CN';
  return 'en';
}
```

## Implementation Plan

### Phase 1: Infrastructure (Priority: CRITICAL)
**Goal**: Set up i18next framework and file structure

1.1. Install dependencies
  - `npm install i18next i18next-resources-to-backend`

1.2. Create translation file structure
  - `desktop/locales/en/*.json`
  - `desktop/locales/zh-CN/*.json`

1.3. Initialize i18next in app.js
  - Configure with resourcesToBackend
  - Implement language detection
  - Set up fallback chain: zh-* → zh-CN, * → en

1.4. Create utility functions
  - `updateStaticTexts()` - Update DOM on language change
  - `changeLanguage(lng)` - Switch language and persist
  - `detectLanguage()` - Auto-detect from system/storage

### Phase 2: Static Content Translation (Priority: HIGH)
**Goal**: Translate and mark up all static HTML elements

2.1. Extract and translate Setup flow
  - Welcome screen
  - Password setup
  - Mnemonic backup
  - Create `locales/*/setup.json`

2.2. Extract and translate Error messages
  - Validation errors
  - System errors
  - Create `locales/*/errors.json`

2.3. Extract and translate Common elements
  - Buttons (Create, Import, Back, Continue, etc.)
  - Labels
  - Create `locales/*/common.json`

2.4. Add data-i18n attributes to HTML
  - Mark all translatable elements
  - Call updateStaticTexts() on page load

### Phase 3: Dynamic Content Translation (Priority: HIGH)
**Goal**: Translate JavaScript-generated content

3.1. Refactor app.js hardcoded strings
  - Replace string literals with i18next.t() calls
  - ~62 locations to update

3.2. Translate Settings tab
  - Create `locales/*/settings.json`
  - Update Settings rendering code

3.3. Translate Security tab
  - Create `locales/*/security.json`
  - Update Security Events and Signing History

3.4. Translate Activity tab
  - Create `locales/*/activity.json`
  - Update Activity record rendering

3.5. Translate Pairing flow
  - Create `locales/*/pairing.json`
  - Update pairing UI

### Phase 4: Language Switcher UI (Priority: MEDIUM)
**Goal**: Add user-facing language selection control

4.1. Design and implement language selector
  - Add `<select>` dropdown in Header
  - Position in top-right corner
  - Style to match existing UI

4.2. Wire up language switching
  - onChange handler
  - Call changeLanguage()
  - Update localStorage

4.3. Show current language state
  - Set selected option on page load
  - Visual feedback during switch

### Phase 5: Testing & Polish (Priority: MEDIUM)
**Goal**: Ensure quality and completeness

5.1. Comprehensive testing
  - Test all screens in both languages
  - Verify language persistence
  - Test system language detection
  - Test language switching

5.2. Chinese translation review
  - Native speaker review
  - Fix awkward phrasings
  - Ensure consistency

5.3. Edge case handling
  - Missing translation keys (fallback to English)
  - Long text overflow (Chinese can be shorter/longer)
  - Special characters

5.4. Documentation
  - Update README with i18n architecture
  - Document how to add new languages
  - Document translation key conventions

## Success Metrics

### Functional Requirements
- ✅ All UI text available in English and Chinese
- ✅ Language auto-detected on first launch
- ✅ Language switchable via UI without restart
- ✅ Language preference persists across sessions
- ✅ No hardcoded English text remaining in codebase

### Quality Metrics
- ✅ Zero missing translation keys (fallback to English is acceptable)
- ✅ Chinese translations reviewed by native speaker
- ✅ No visual layout breaks in either language
- ✅ Language switch completes in <100ms

### Code Quality
- ✅ All translation keys use semantic naming
- ✅ No duplicate translation keys
- ✅ Translation files properly organized by feature
- ✅ Code follows established patterns (no ad-hoc i18n hacks)

## Risks and Mitigations

### Risk: Missing Translation Keys
**Impact**: Some text stays in English  
**Likelihood**: High (127+ locations to update)  
**Mitigation**: 
- Systematic extraction using grep/search
- i18next logging for missing keys in dev mode
- Manual QA pass through all screens

### Risk: Chinese Text Layout Issues
**Impact**: UI breaks or looks bad  
**Likelihood**: Medium (Chinese text length can vary significantly)  
**Mitigation**:
- Test all screens with Chinese text
- Use flexible CSS (avoid fixed widths)
- Truncate/ellipsis for very long text

### Risk: Forgetting to Translate New Features
**Impact**: New features only in English  
**Likelihood**: Medium (as codebase grows)  
**Mitigation**:
- Document translation workflow in CONTRIBUTING.md
- ESLint rule to detect string literals (future)
- Include translation in PR checklist

### Risk: Translation File Merge Conflicts
**Impact**: Developer friction  
**Likelihood**: Low (small team)  
**Mitigation**:
- Keep translation files sorted alphabetically
- Clear ownership: one person manages translations
- Use separate files per feature (reduces conflicts)

## Future Enhancements

1. **Traditional Chinese (zh-TW)** - For Taiwan/Hong Kong users
2. **Main Process i18n** - Notifications, system tray, native dialogs
3. **More Languages** - Japanese, Korean, Spanish, etc.
4. **Advanced i18n Features** - Pluralization, number/date formatting
5. **Translation Management** - Integrate Crowdin/Lokalise for community translations
6. **Automated Testing** - Scripts to detect untranslated text
7. **Hot Reload** - Update translations without rebuilding app (dev mode)

## Dependencies

### External
- `i18next` ^23.x - Core i18n framework
- `i18next-resources-to-backend` ^1.x - Dynamic import support

### Internal
- Desktop app architecture (Electron renderer process)
- localStorage API for persistence
- Header component for language switcher placement

## Open Questions

None - all design decisions resolved during exploration phase.

## References

- [i18next Documentation](https://www.i18next.com/)
- [Electron Localization](https://www.electronjs.org/docs/latest/tutorial/localization)
- [BCP 47 Language Tags](https://www.rfc-editor.org/rfc/bcp/bcp47.txt)
