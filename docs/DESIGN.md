# DESIGN.md — CMES-ADMIN Design System

> Visual reference สำหรับ Admin Dashboard ของ CMES
> ใช้ร่วมกับ [`SKILL.md`](./SKILL.md) (coding rules & architecture)
> Source of truth: `frontend/src/theme.css` + `frontend/src/App.css`

---

## 1. Design Philosophy

| Principle | Detail |
|-----------|--------|
| **Theme** | Light mode เป็นหลัก (ต่างจาก CMES-USER ที่ใช้ Dark mode) |
| **Style** | Glassmorphism — `rgba()` backgrounds + `backdrop-filter: blur()` |
| **Feel** | สะอาด เรียบ เป็นมืออาชีพ มี depth ด้วย shadow + gradient |
| **Language** | UI copy เป็นภาษาไทย — ใช้ฟอนต์ Prompt/Kanit |

---

## 2. Color System (`theme.css` → `:root`)

### 2.1 Primary — Indigo
| Variable | Hex | Usage |
|----------|-----|-------|
| `--primary-50` | `#f0f4ff` | Light background / hover tint |
| `--primary-100` | `#e0e9ff` | Soft background |
| `--primary-200` | `#c7d2fe` | Border highlight |
| `--primary-300` | `#a5b4fc` | Subtle accent |
| `--primary-400` | `#818cf8` | Medium emphasis |
| `--primary-500` | `#6366f1` | ★ Primary color |
| `--primary-600` | `#4f46e5` | ★ Buttons, headers, links — ใช้บ่อยที่สุด |
| `--primary-700` | `#4338ca` | ★ Gradient end / darker variant |
| `--primary-800` | `#3730a3` | Deep accent |
| `--primary-900` | `#312e81` | Darkest |

### 2.2 Accent — Pink
| Variable | Hex | Usage |
|----------|-----|-------|
| `--accent-50` | `#fdf2f8` | Light pink background |
| `--accent-100` | `#fce7f3` | Soft pink |
| `--accent-200` | `#fbcfe8` | Subtle accent |
| `--accent-300` | `#f8b4d6` | Medium pink |
| `--accent-400` | `#f472b6` | Pink emphasis |
| `--accent-500` | `#ec4899` | ★ Accent color |
| `--accent-600` | `#db2777` | ★ Accent gradient end |
| `--accent-700` | `#be185d` | Deep pink |

### 2.3 Status Colors
| Color | Variable Range | Main | Usage |
|-------|---------------|------|-------|
| **Success** (Green) | `--success-50` → `--success-700` | `--success-500: #10b981` | สำเร็จ, ราคา, ยืนยัน |
| **Warning** (Amber) | `--warning-50` → `--warning-700` | `--warning-500: #f59e0b` | เตือน, pending |
| **Danger** (Red) | `--danger-50` → `--danger-700` | `--danger-500: #ef4444` | ลบ, error, reject |

### 2.4 Neutral — Gray
| Variable | Hex | Usage |
|----------|-----|-------|
| `--gray-50` | `#f9fafb` | ★ Page background (`body`) |
| `--gray-100` | `#f3f4f6` | Card background / disabled input |
| `--gray-200` | `#e5e7eb` | Border / divider |
| `--gray-300` | `#d1d5db` | Input border |
| `--gray-400` | `#9ca3af` | Placeholder text |
| `--gray-500` | `#6b7280` | Muted text |
| `--gray-600` | `#4b5563` | Secondary text |
| `--gray-700` | `#374151` | Strong secondary |
| `--gray-800` | `#1f2937` | Heading text |
| `--gray-900` | `#111827` | ★ Body text |

### 2.5 Special Colors (Hardcoded in Components)
| Color | Hex | Where Used |
|-------|-----|------------|
| Primary gradient start | `#667eea` | Home page, nav links, gradient text |
| Gradient end purple | `#764ba2` | Home page gradient |
| Home BG gradient | `#667eea → #764ba2 → #f093fb → #4facfe → #00f2fe` | Home background (animated) |

---

## 3. Typography

### 3.1 Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
  'Prompt', 'Kanit', sans-serif;
```
- **System fonts** มาก่อนเพื่อความเร็ว
- **Prompt + Kanit** สำหรับภาษาไทย
- **ห้ามเปลี่ยน font stack** — ดู rules ใน `SKILL.md`

### 3.2 Font Sizes
| Element | Size | Weight |
|---------|------|--------|
| Page title (`h1`) | `1.75rem` – `2.2rem` | 700 |
| Section title (`h2`) | `1.3rem` – `1.5rem` | 700 |
| Subsection (`h3`) | `1.1rem` – `1.3rem` | 700 |
| Body text | `1rem` | 400 |
| Small text / label | `0.9rem` – `0.95rem` | 600 |
| Mobile small | `0.9rem` | 400 |

### 3.3 Font Rendering
```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### 3.4 Gradient Text (Headings)
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```
ใช้สำหรับ: page titles, section headers, brand title

---

## 4. Spacing System

| Class | Value | Usage |
|-------|-------|-------|
| `mt-1` / `mb-1` | `0.25rem` (4px) | Micro gap |
| `mt-2` / `mb-2` | `0.5rem` (8px) | Small gap |
| `mt-4` / `mb-4` | `1rem` (16px) | Default gap |
| `mt-6` / `mb-6` | `1.5rem` (24px) | Section gap |
| `mt-8` / `mb-8` | `2rem` (32px) | Large gap |
| `p-4` | `1rem` | Default padding |
| `p-6` | `1.5rem` | Card padding |
| `p-8` | `2rem` | Large padding |
| `gap-2` | `0.5rem` | Small flex/grid gap |
| `gap-4` | `1rem` | Default flex/grid gap |
| `gap-6` | `1.5rem` | Large flex/grid gap |

---

## 5. Shadows

| Variable | Value | Usage |
|----------|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | ★ Cards, buttons default |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | ★ Hover state |
| `--shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | Elevated modals |
| `--shadow-2xl` | `0 25px 50px -12px rgba(0,0,0,0.15)` | Hero elements |

### Glassmorphism Shadows (Custom)
```css
/* Cards ที่ใช้ glassmorphism */
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5);

/* Button hover */
box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);

/* Deep hover */
box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
```

---

## 6. Border Radius

| Class | Value | Usage |
|-------|-------|-------|
| `rounded` | `8px` | Input, small elements |
| `rounded-lg` | `12px` | ★ Cards, buttons, modals |
| `rounded-full` | `999px` | Circular / pill shape |
| Custom | `16px` | Medium cards |
| Custom | `20px` | Large glassmorphism panels |
| Custom | `24px` | Header bottom, hero cards |

---

## 7. Gradients

| Variable | Definition | Usage |
|----------|-----------|-------|
| `--gradient-primary` | `linear-gradient(135deg, var(--primary-600), var(--primary-700))` | Buttons, headers |
| `--gradient-accent` | `linear-gradient(135deg, var(--primary-600), var(--accent-600))` | Special highlights |
| `--gradient-soft` | `linear-gradient(135deg, var(--primary-50), var(--primary-100))` | Soft backgrounds |

### Commonly Used Hardcoded Gradients
```css
/* Home gradient background (animated) */
background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%);
background-size: 400% 400%;
animation: gradientShift 15s ease infinite;

/* Primary gradient for buttons & text */
linear-gradient(135deg, #667eea 0%, #764ba2 100%)

/* App-level gradient background */
linear-gradient(135deg, #f0f4ff 0%, #e0e9ff 100%)
```

---

## 8. Component Styles

### 8.1 Buttons (`App.css` → `.btn`)
```css
/* Base */
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}
```

| Variant | Background | Hover |
|---------|-----------|-------|
| `.btn-primary` | `var(--gradient-primary)` + white text | `translateY(-2px)` + `shadow-lg` |
| `.btn-secondary` | `var(--gray-200)` + dark text | `var(--gray-300)` + `translateY(-2px)` |
| `.btn-success` | `var(--success-500)` + white text | `var(--success-600)` + `translateY(-2px)` |
| `.btn-danger` | `var(--danger-500)` + white text | `var(--danger-600)` + `translateY(-2px)` |
| `:disabled` | `opacity: 0.5` | `cursor: not-allowed`, no transform |

#### Home Page Button (Glassmorphism variant)
```css
.save-btn {
  width: 100%;
  height: 40px;
  padding: 12px 24px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
  /* Ripple effect on :active::before */
}
```

#### Mode/Toggle Buttons
```css
.mode-btn-minimal {
  height: 40px;
  padding: 12px 24px;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  background: #f8f9fa;
  color: #667eea;
  font-size: 14px;
  font-weight: 600;
}
.mode-btn-minimal.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: 2px solid transparent;
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
}
```

#### Danger & Edit Buttons (Class-based, no inline styles)
```css
.btn-danger-custom {
  height: 40px;
  padding: 12px 24px;
  border-radius: 12px;
  background: var(--danger-500);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
.btn-edit-custom {
  height: 40px;
  padding: 12px 24px;
  border-radius: 12px;
  background: var(--primary-600);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
```

### 8.2 Cards (`App.css` → `.card`)
```css
.card {
  background: white;
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  padding: 1.5rem;
  transition: all 0.3s ease;
}
.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

#### Glassmorphism Card (Home Page variant)
```css
.setting-card-minimal {
  width: 440px;  /* ★ Updated from 380px to 440px for balanced, wider layout */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5);
  padding: 36px 32px;  /* ★ Updated from 2.5rem 1.8rem for professional whitespace */
  border: 1px solid rgba(255, 255, 255, 0.7);
  animation: scaleUp 0.6s ease 0.1s both;
}
```

### 8.3 Inputs (`App.css` — Global)
```css
/* Base input style */
input, textarea, select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.3s ease;
}

/* Focus state */
:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* Disabled state */
:disabled {
  background: var(--gray-100);
  color: var(--gray-500);
  cursor: not-allowed;
}
```

#### Home Page Input (Enhanced)
```css
input {
  padding: 1rem;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  background-color: #f8f9fa;
  font-family: 'Prompt', 'Kanit', sans-serif;
}
input:focus {
  border-color: #667eea;
  background-color: #fff;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  transform: translateY(-2px);
}
```

### 8.4 Badges / Status Indicators
```css
/* Status text badges */
.system-status-text.on {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 700;
  text-transform: uppercase;
}

.system-status-text.off {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(244, 67, 54, 0.05));
  color: #d32f2f;
  border: 1px solid rgba(244, 67, 54, 0.3);
}
```

### 8.5 Toggle Switch
```css
.switch-minimal {
  width: 56px;
  height: 32px;
  border-radius: 16px;
  position: relative;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.switch-minimal.on {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
}
.switch-minimal.off {
  background: #f0f0f0;
  border: 2px solid #e0e0e0;
}
.switch-dot {
  width: 26px; height: 26px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  left: 3px; top: 2px;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.switch-minimal.on .switch-dot { left: 27px; }
```

### 8.6 Warning / Alert Banners
```css
.system-off-msg {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(232, 245, 233, 0.1));
  border-left: 4px solid #e74c3c;
  color: #d32f2f;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 600;
  text-align: center;
}
```

### 8.7 Empty State
```css
.empty-history {
  text-align: center;
  color: #aaa;
  padding: 2rem;
  border: 2px dashed #e0e0e0;
  border-radius: 12px;
  background: #f8f9fa;
}
```

### 8.8 Header / Navbar
```css
/* Glassmorphism header */
.admin-header-minimal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  border-radius: 0 0 24px 24px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  padding: 1rem 1.5rem;
}

/* Nav links */
.nav-minimal a {
  color: #667eea;
  font-weight: 600;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: 2px solid rgba(102, 126, 234, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.nav-minimal a:hover {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
  border-color: transparent;
}
```

### 8.9 Scrollbar
```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--gray-100); }
::-webkit-scrollbar-thumb { background: var(--gray-300); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--gray-400); }
```

---

## 9. Layout System

### 9.1 Utility Classes
```css
/* Flexbox */
.flex                     /* display: flex */
.flex-center              /* flex + align-items: center + justify-content: center */
.flex-between             /* flex + align-items: center + justify-content: space-between */
.flex-col                 /* flex-direction: column */

/* Grid */
.grid                     /* display: grid */
.grid-cols-2              /* repeat(2, 1fr) → 1fr on tablet */
.grid-cols-3              /* repeat(3, 1fr) → 2fr on tablet → 1fr on mobile */

/* Display */
.hidden                   /* display: none */
.block                    /* display: block */
.inline-block             /* display: inline-block */

/* Opacity */
.opacity-50               /* opacity: 0.5 */
.opacity-75               /* opacity: 0.75 */
```

### 9.2 Page Container Pattern
```css
/* Container max-width varies by page */
.admin-main          { max-width: 750px; margin: 32px auto; }
.admin-dashboard-grid { max-width: 1500px; grid-template-columns: 440px 440px 440px; }
```

### 9.3 Dashboard Grid (Home Page)
```css
/* ★ Updated: card widths increased from 380px → 440px for modern proportions */
.admin-dashboard-grid {
  display: grid;
  grid-template-columns: 440px 440px 440px;
  gap: 2rem;
  max-width: 1500px;
  margin: 0 auto;
  justify-content: center;
}
```

---

## 10. Responsive Breakpoints

| Breakpoint | Screen | Behavior |
|------------|--------|----------|
| `> 768px` | Desktop (default) | Grid columns ตาม design |
| `≤ 768px` | Tablet | `.grid-cols-2` → 1 column, `.grid-cols-3` → 2 columns |
| `≤ 480px` | Mobile | `.grid-cols-3` → 1 column, font ลดขนาด |

### Tablet (`max-width: 768px`)
```css
@media (max-width: 768px) {
  .grid-cols-2 { grid-template-columns: 1fr; }
  .grid-cols-3 { grid-template-columns: repeat(2, 1fr); }
  .hidden-mobile { display: none; }
  .app-header { padding: 1rem; }
  .app-header h1 { font-size: 1.5rem; }
  .btn { padding: 0.625rem 1.25rem; font-size: 0.9rem; }
}
```

### Mobile (`max-width: 480px`)
```css
@media (max-width: 480px) {
  .grid-cols-3 { grid-template-columns: 1fr; }
  .text-mobile-sm { font-size: 0.9rem; }
  .p-mobile-4 { padding: 1rem; }
}
```

---

## 11. Animation System

### 11.1 Keyframes (`theme.css`)
| Name | Effect | Duration |
|------|--------|----------|
| `fadeIn` | Opacity 0 → 1 | 0.4s ease |
| `slideUp` | translateY(20px) → 0 + fade | 0.4s ease |
| `slideDown` | translateY(-20px) → 0 + fade | 0.6s ease |
| `slideLeft` | translateX(20px) → 0 + fade | 0.4s ease |
| `slideRight` | translateX(-20px) → 0 + fade | 0.4s ease |
| `pulse` | Opacity 1 → 0.5 → 1 | looping |
| `scaleUp` | scale(0.95) → 1 + fade | 0.6s ease |
| `gradientShift` | background-position 0% → 100% → 0% | 15s infinite |
| `marquee-scroll` | translateX(0) → translateX(-50%) | 8s linear infinite |

### 11.2 Animation Utility Classes
```css
.animate-fade-in  { animation: fadeIn 0.4s ease; }
.animate-slide-up { animation: slideUp 0.4s ease; }
```

### 11.3 Transition Standards
```css
/* Default transition */
transition: all 0.3s ease;

/* Material Design standard easing */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Common hover effects */
transform: translateY(-2px);   /* Lift effect */
transform: translateY(-3px);   /* Strong lift (primary buttons) */
```

### 11.4 Staggered Entry (Cards)
```css
/* ใช้ animation-delay เพื่อให้ cards เข้ามาทีละใบ */
animation: scaleUp 0.6s ease 0.1s both;  /* delay 0.1s */
```

---

## 12. Glassmorphism Pattern

### Recipe
```css
.glass-card {
  background: rgba(255, 255, 255, 0.95);  /* ความโปร่ง */
  backdrop-filter: blur(10px);              /* เบลอพื้นหลัง */
  border-radius: 20px;                      /* มุมมนใหญ่ */
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25),
              0 0 0 1px rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.7);
  padding: 2.5rem 1.8rem;
}
```

### ใช้ในที่ไหน
- Header (`.admin-header-minimal`)
- Setting cards (`.setting-card-minimal`)
- Function panels (`.functions-panel`)
- System status row (`.system-status-row`)

---

## 13. Background Patterns

### Page Background (Home)
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%);
background-size: 400% 400%;
animation: gradientShift 15s ease infinite;
```

### App Background (Other Pages)
```css
background: linear-gradient(135deg, #f0f4ff 0%, #e0e9ff 100%);
```

### Body Default
```css
background: var(--gray-50);  /* #f9fafb */
```

---

## 14. Icon System

| Library | Version | Usage |
|---------|---------|-------|
| FontAwesome | 6.x | Primary icons — ใช้ `<FontAwesomeIcon icon={...} />` |
| Emoji | — | Decorative prefixes เช่น ⚙️, ⚡, ⚠️ |

### Common Icon Usages
```jsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faGift, faCog, faTrash } from "@fortawesome/free-solid-svg-icons";

<FontAwesomeIcon icon={faImage} />
```

---

## 15. Design DO / DON'T

### DO ✅
- ใช้ **CSS variables** จาก `theme.css` — `var(--primary-600)` ไม่ hardcode
- ใช้ **glassmorphism pattern** สำหรับ panels หลัก
- ใช้ **`cubic-bezier(0.4, 0, 0.2, 1)`** สำหรับ transition
- ใช้ **`translateY(-2px)`** สำหรับ hover lift
- ใช้ **gradient text** สำหรับ headings สำคัญ
- ใช้ **`border-radius: 12px`** เป็นค่า default สำหรับ cards + buttons
- เพิ่ม **entry animation** (`fadeIn`, `slideUp`, `scaleUp`) ให้ทุก card/section
- ใช้ **responsive breakpoints** ที่ `768px` และ `480px`
- ใช้ **utility classes** จาก `theme.css` ก่อนเขียน CSS ใหม่

### DON'T ❌
- **อย่า hardcode สี** — อ้างอิง variables เสมอ
- **อย่าเปลี่ยน font stack** — ใช้ system font + Prompt/Kanit
- **อย่าใช้ border-radius ต่ำกว่า 8px** (ยกเว้น scrollbar)
- **อย่าลืม `backdrop-filter`** เมื่อใช้ `rgba()` background
- **อย่าใช้ `transition: all 0.1s`** — ใช้ 0.3s ขั้นต่ำเพื่อความ smooth
- **อย่าสร้าง utility class ใหม่** ที่ซ้ำกับที่มีใน `theme.css`
- **อย่าใช้ `box-shadow` แบบ flat** — ใช้ multi-layer shadows จาก design system
- **อย่าลืม hover state** ให้ interactive elements ทุกตัว

---

## 16. Component Architecture (Clean Architecture)

> ★ ตั้งแต่ v2.0 หน้า Home ถูก refactor จาก monolith (`home.js` ~2,100 lines) เป็น Clean Architecture

### 16.1 Dashboard Subcomponents (`src/components/dashboard/`)
| Component | Responsibility |
|-----------|----------------|
| `FeatureSwitches.jsx` | คอลัมน์ซ้าย — switches (image, text, gift, birthday) + birthday threshold input |
| `PackageConfig.jsx` | คอลัมน์กลาง — timing package, mode selector, inputs, QR code uploader |
| `VipSupporters.jsx` | คอลัมน์ขวา — VIP rank lists, date/month/year selectors, summary box |
| `DashboardModals.jsx` | Modals ทุกตัว (All Ranks, QR Linker, OBS Studio, Premium Perks) |

### 16.2 Custom Hooks (`src/hooks/`)
| Hook | Responsibility |
|------|----------------|
| `useSocket.js` | Socket.IO listeners (status, public ranking toggles) + cleanup |
| `useDashboardData.js` | HTTP API fetches, drag-and-drop, card ordering + perks CRUD |
| `useDashboardSocket.js` | Legacy socket hook (real-time system config) |
| `useRankingStats.js` | Ranking API interactions, date parameters, birthday config |
| `useCardReorder.js` | Card drag-and-drop mechanics + localStorage persistence |

### 16.3 Pages (`src/pages/`)
| Page | Description |
|------|-------------|
| `Home.jsx` | Dashboard wrapper — declares `HomeProvider`, assembles header + 3-column layout (~50 lines) |
| `Login.jsx` | Login wrapper — wraps `Register.js` in a clean container |

### 16.4 Reusable UI Components (`src/components/ui/`)
| Component | Description |
|-----------|-------------|
| `Card.jsx` | Standard panel layout with native Drag & Drop binding |
| `Button.jsx` | Gradient buttons, outline buttons, danger action styles — zero inline styles |
| `Switch.jsx` | Toggle switch with glassmorphism styling |
| `Select.jsx` | Clean dropdown picker for date presets and year selectors |
| `ErrorBoundary.jsx` | Error Boundary for lazy-loaded component crash interception |

---

## 17. Z-index System

| Layer | Value | Usage |
|-------|-------|-------|
| Base content | `0` | Default |
| Sticky elements | `10` | Sticky rows, floating buttons |
| Header / Navbar | `100` | Fixed/sticky header (`app-header`) |
| Dropdown / Popover | `200` | Select menus, tooltips |
| Modal backdrop | `9998` | Overlay ด้านหลัง modal |
| Modal content | `9999` | Modal / drawer content |
| Toast / Alert | `10000` | Notifications บนสุด |

### Usage Rule
```css
/* ใช้ค่าตาม table ด้านบน — ห้ามใช้ค่าแปลกๆ เช่น z-index: 999999 */
.header { z-index: 100; }
.modal-overlay { z-index: 9998; }
.modal-content { z-index: 9999; }
```

---

## 18. Loading States

### 17.1 Skeleton Loading
```css
/* Placeholder ขณะโหลดข้อมูล */
.skeleton {
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease infinite;
  border-radius: 8px;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 17.2 Spinner (Button Loading)
```css
.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--gray-200);
  border-top-color: var(--primary-600);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 17.3 Disabled State (During API Call)
```css
.btn:disabled,
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  pointer-events: none;
}
```

### 17.4 Loading Pattern (React)
```jsx
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await adminFetch(url, { method: "POST", body: JSON.stringify(data) });
  } finally {
    setLoading(false);
  }
};

<button disabled={loading}>
  {loading ? <span className="spinner" /> : "บันทึก"}
</button>
```

---

## 19. CSS Naming Convention

### 18.1 Pattern
```
{page}-{component}-{modifier}
```

### 18.2 Examples
| Class | Pattern | Page |
|-------|---------|------|
| `.admin-home-minimal` | page container | Home |
| `.admin-header-minimal` | header variant | Home |
| `.setting-card-minimal` | card variant | Home |
| `.mode-btn-minimal` | button variant | Home |
| `.nav-minimal` | nav variant | Home |
| `.system-status-text.on` | modifier via state | Home |
| `.package-item` | item in list | Home |
| `.gift-card` | card component | Gift |
| `.report-row` | row in list | Report |

### 18.3 Rules
- ใช้ **kebab-case** เสมอ (`setting-card` ไม่ใช่ `settingCard`)
- Page-specific classes ขึ้นต้นด้วยชื่อ page: `admin-`, `gift-`, `report-`
- State modifiers ใช้ class เสริม: `.on`, `.off`, `.active`, `.disabled`
- Utility classes (จาก `theme.css`) ใช้ตรงๆ ไม่ต้อง prefix

---

## 20. Accessibility Checklist

| Rule | Detail |
|------|--------|
| **Focus visible** | ทุก interactive element ต้องมี `:focus` style ที่มองเห็นได้ |
| **Color contrast** | Text บน gradient/colored background ต้องเป็น `#fff` |
| **Button cursor** | `:disabled` → `cursor: not-allowed`, active → `cursor: pointer` |
| **Touch target** | ขนาดขั้นต่ำ `44px × 44px` สำหรับ mobile |
| **Alt text** | รูปภาพทุกรูปต้องมี `alt` attribute |
| **Form labels** | ทุก input ต้องมี `<label>` หรือ `aria-label` |
