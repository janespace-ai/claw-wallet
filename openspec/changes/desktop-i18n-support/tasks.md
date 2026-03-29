# Desktop i18n Implementation Tasks

## Phase 1: Infrastructure Setup

### 1.1 Install Dependencies
- [ ] Install i18next: `npm install i18next`
- [ ] Install i18next-resources-to-backend: `npm install i18next-resources-to-backend`
- [ ] Verify package.json updated correctly

### 1.2 Create Translation File Structure
- [ ] Create `desktop/locales/` directory
- [ ] Create `desktop/locales/en/` directory
- [ ] Create `desktop/locales/zh-CN/` directory
- [ ] Create empty placeholder files for all namespaces (common, setup, activity, security, settings, errors, pairing)

### 1.3 Create i18n Configuration Module
- [ ] Create `desktop/src/renderer/i18n.js`
- [ ] Implement `initI18n()` function with i18next configuration
- [ ] Implement `detectLanguage()` with localStorage + system language detection
- [ ] Implement `changeLanguage(lng)` with persistence
- [ ] Export i18next instance

### 1.4 Integrate i18n into App
- [ ] Import i18n.js in app.js
- [ ] Call `initializeI18n()` in init() function
- [ ] Create `updateStaticTexts()` function for DOM updates
- [ ] Test initialization in both languages

## Phase 2: Static Content Translation (Critical Path)

### 2.1 Setup Flow Translation
- [ ] Extract English text from Setup screen HTML
- [ ] Create `locales/en/setup.json` with hierarchical structure
- [ ] Translate to Chinese in `locales/zh-CN/setup.json`
- [ ] Add data-i18n attributes to Setup screen HTML elements
- [ ] Test Setup flow in both languages

### 2.2 Error Messages Translation
- [ ] Identify all error messages in JavaScript
- [ ] Extract to `locales/en/errors.json`
- [ ] Translate to `locales/zh-CN/errors.json`
- [ ] Replace hardcoded error strings with i18next.t() calls
- [ ] Test error scenarios in both languages

### 2.3 Common Elements Translation
- [ ] Extract common buttons (Create, Import, Back, Continue, etc.)
- [ ] Extract common labels (Address, Balance, etc.)
- [ ] Create `locales/en/common.json`
- [ ] Translate to `locales/zh-CN/common.json`
- [ ] Add data-i18n attributes to common HTML elements
- [ ] Replace common JavaScript strings with i18next.t()

### 2.4 HTML Markup Updates
- [ ] Add data-i18n attributes to all <h1>, <h2>, <h3> tags
- [ ] Add data-i18n attributes to all <button> tags
- [ ] Add data-i18n-placeholder attributes to all <input> placeholders
- [ ] Add data-i18n attributes to all <label> tags
- [ ] Add data-i18n attributes to all <p> text elements
- [ ] Test updateStaticTexts() updates all marked elements

## Phase 3: Dynamic Content Translation (High Priority)

### 3.1 Settings Tab Translation
- [ ] Extract Settings tab text
- [ ] Create `locales/en/settings.json`
- [ ] Translate to `locales/zh-CN/settings.json`
- [ ] Update Settings rendering code with i18next.t()
- [ ] Test Settings tab in both languages

### 3.2 Security Tab Translation
- [ ] Extract Security Events text
- [ ] Extract Signing History text
- [ ] Create `locales/en/security.json`
- [ ] Translate to `locales/zh-CN/security.json`
- [ ] Update `loadSecurityEvents()` with i18next.t()
- [ ] Update `loadSigningHistory()` with i18next.t()
- [ ] Test Security tab in both languages

### 3.3 Activity Tab Translation
- [ ] Extract Activity tab text (filters, labels, etc.)
- [ ] Create `locales/en/activity.json`
- [ ] Translate to `locales/zh-CN/activity.json`
- [ ] Update `renderActivityRecord()` with i18next.t()
- [ ] Update activity filter buttons with data-i18n
- [ ] Test Activity tab in both languages

### 3.4 Pairing Flow Translation
- [ ] Extract Pairing tab text
- [ ] Create `locales/en/pairing.json`
- [ ] Translate to `locales/zh-CN/pairing.json`
- [ ] Update pairing code generation messages
- [ ] Update device list rendering
- [ ] Test Pairing flow in both languages

### 3.5 Refactor JavaScript Strings
- [ ] Replace alert() messages with i18next.t()
- [ ] Replace confirm() messages with i18next.t()
- [ ] Replace innerHTML string literals with template + i18next.t()
- [ ] Replace textContent assignments with i18next.t()
- [ ] Grep for remaining hardcoded English text: `grep -r "Create\|Import\|Welcome" desktop/src/renderer/`
- [ ] Fix any remaining hardcoded strings

## Phase 4: Language Switcher UI (Medium Priority)

### 4.1 Design and Implement UI Component
- [ ] Add language switcher HTML to Header (`<select>` dropdown)
- [ ] Position in top-right corner of Header
- [ ] Add CSS styles for language selector (.language-switcher, .language-select)
- [ ] Ensure responsive design (works on small windows)
- [ ] Test visual appearance

### 4.2 Wire Up Functionality
- [ ] Create `initializeLanguageSwitcher()` function
- [ ] Add onChange event handler for language selector
- [ ] Call `changeLanguage()` on selection
- [ ] Update DOM via `updateStaticTexts()`
- [ ] Show current language as selected on page load
- [ ] Test language switching flow

### 4.3 Add User Feedback (Optional)
- [ ] Add loading state during language switch (if needed)
- [ ] Add transition animation for smooth updates (optional)
- [ ] Test user experience

## Phase 5: Testing & Polish (Medium Priority)

### 5.1 Comprehensive Manual Testing
- [ ] Test all screens in English
- [ ] Test all screens in Chinese
- [ ] Test language switcher in all tabs
- [ ] Test first launch language detection
- [ ] Test language persistence after restart
- [ ] Test with zh-CN, zh-TW, zh-HK system languages (should all use zh-CN)
- [ ] Test with unsupported language (should fallback to English)
- [ ] Test missing translation keys (should fallback gracefully)

### 5.2 Layout and Visual Testing
- [ ] Check for text overflow in English
- [ ] Check for text overflow in Chinese
- [ ] Verify button sizes accommodate both languages
- [ ] Verify modal dialogs look good in both languages
- [ ] Check placeholder text visibility
- [ ] Test on different window sizes

### 5.3 Chinese Translation Review
- [ ] Review Setup flow translations with native speaker
- [ ] Review error messages for natural phrasing
- [ ] Review button/label translations for consistency
- [ ] Check for any awkward literal translations
- [ ] Ensure professional tone throughout
- [ ] Update translations based on feedback

### 5.4 Edge Case Testing
- [ ] Test rapid language switching
- [ ] Test language switch while on different tabs
- [ ] Test with malformed translation files (error handling)
- [ ] Test with missing namespace (fallback behavior)
- [ ] Test localStorage quota exceeded (unlikely but possible)

### 5.5 Code Quality
- [ ] Remove any remaining hardcoded strings
- [ ] Ensure all translation keys follow naming conventions
- [ ] Check for duplicate translation keys
- [ ] Verify all namespace files are properly organized
- [ ] Run linter/prettier on new code
- [ ] Add comments to complex i18n logic

### 5.6 Documentation
- [ ] Update README with i18n architecture section
- [ ] Document how to add a new language
- [ ] Document translation key naming conventions
- [ ] Document how to use i18next.t() for developers
- [ ] Add translation workflow to CONTRIBUTING.md
- [ ] Document testing procedures

## Phase 6: Final Integration & Deployment

### 6.1 Build and Package Testing
- [ ] Test npm run build includes translation files
- [ ] Test Electron packaging includes locales/ directory
- [ ] Verify app works correctly when packaged (.app or .exe)
- [ ] Test language switching in packaged app
- [ ] Verify file size increase is reasonable (~25KB expected)

### 6.2 Git and Version Control
- [ ] Commit changes with descriptive messages
- [ ] Push to feature branch
- [ ] Create pull request
- [ ] Address code review feedback
- [ ] Merge to main branch

### 6.3 Release Preparation
- [ ] Update CHANGELOG with i18n feature
- [ ] Bump version number (minor version for new feature)
- [ ] Tag release
- [ ] Update documentation on GitHub

---

## Task Dependencies

```
Phase 1 (Infrastructure)
  ├─ Must complete before all other phases
  └─ Blocks: Phase 2, 3, 4

Phase 2 (Static Content)
  ├─ Depends on: Phase 1
  ├─ Can parallelize with Phase 3 (different files)
  └─ Blocks: Phase 5 (testing)

Phase 3 (Dynamic Content)
  ├─ Depends on: Phase 1
  ├─ Can parallelize with Phase 2
  └─ Blocks: Phase 5 (testing)

Phase 4 (UI Component)
  ├─ Depends on: Phase 1
  ├─ Can parallelize with Phase 2 & 3
  └─ Needed for: Phase 5 (user testing)

Phase 5 (Testing)
  ├─ Depends on: Phases 1-4
  └─ Blocks: Phase 6 (deployment)

Phase 6 (Deployment)
  ├─ Depends on: Phases 1-5
  └─ Final phase
```

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | 4 subtasks (13 items) | 2-3 hours |
| Phase 2 | 4 subtasks (23 items) | 4-5 hours |
| Phase 3 | 5 subtasks (27 items) | 5-6 hours |
| Phase 4 | 3 subtasks (11 items) | 2 hours |
| Phase 5 | 6 subtasks (32 items) | 3-4 hours |
| Phase 6 | 3 subtasks (10 items) | 1-2 hours |
| **Total** | **25 subtasks (116 items)** | **17-22 hours** |

## Priority Labels

- 🔴 **CRITICAL**: Blocks other work, must complete first
- 🟠 **HIGH**: Core functionality, high user impact
- 🟡 **MEDIUM**: Important but not blocking
- 🟢 **LOW**: Nice-to-have, polish work

## Quick Start Guide

To start implementation:

1. Begin with **Phase 1** (Infrastructure)
2. Complete **Task 1.1** (Install dependencies)
3. Work sequentially through Phase 1
4. Once Phase 1 is done, **Phases 2-4 can be done in parallel** by different people or sequentially
5. Complete **Phase 5** (Testing) only after Phases 2-4 are done
6. Finish with **Phase 6** (Deployment)

## Success Criteria

✅ All 116 tasks completed  
✅ All screens work in both English and Chinese  
✅ Language switcher functional in Header  
✅ Preference persists across restarts  
✅ No hardcoded English text remaining  
✅ Passes all manual tests  
✅ Chinese translations reviewed by native speaker  
✅ Documentation updated  
✅ Packaged app tested and working  
