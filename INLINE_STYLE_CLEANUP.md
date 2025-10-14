# Inline Style Cleanup Guide

## Problem
Hard-coded colors in inline styles break dark mode and hurt maintainability.

## Solution
Replace inline styles with CSS classes that adapt to theme.

---

## Replacement Patterns

### 1. **Text Colors**

❌ **Before:**
```html
<p style="color: #6b7280;">Some text</p>
<label style="color: #374151;">Label</label>
<span style="color: #667eea;">Brand text</span>
```

✅ **After:**
```html
<p class="text-muted">Some text</p>
<label class="text-primary-color">Label</label>
<span class="text-brand">Brand text</span>
```

### 2. **Labels**

❌ **Before:**
```html
<label style="display: block; color: #374151; font-weight: 600; margin-bottom: 8px; font-size: 14px;">
    Symbol
</label>
```

✅ **After:**
```html
<label class="label">Symbol</label>
```

### 3. **Helper Text**

❌ **Before:**
```html
<p style="font-size: 12px; color: #6b7280;">Help text</p>
<div style="font-size: 12px; color: #6b7280; margin-top: -8px;">Helper</div>
```

✅ **After:**
```html
<p class="helper-text">Help text</p>
<div class="helper-text" style="margin-top: -8px;">Helper</div>
```

### 4. **Close Buttons**

❌ **Before:**
```html
<button onclick="closeAnalysis()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #6b7280;">×</button>
```

✅ **After:**
```html
<button onclick="closeAnalysis()" class="close-btn">×</button>
```

### 5. **Info Boxes (with colored left border)**

❌ **Before:**
```html
<div style="border-left: 4px solid #3b82f6; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
    Content
</div>
```

✅ **After:**
```html
<div class="info-box info-box-blue">
    Content
</div>
```

Available colors: `.info-box-blue`, `.info-box-green`, `.info-box-yellow`, `.info-box-red`

### 6. **Section Backgrounds**

❌ **Before:**
```html
<div style="margin-top: 15px; padding: 15px; border-radius: 8px;">
    Content
</div>
```

✅ **After:**
```html
<div class="section-bg" style="margin-top: 15px;">
    Content
</div>
```

### 7. **Discovery Info Panel**

❌ **Before:**
```html
<div id="discovery-info" style="display: none; margin-bottom: 15px; padding: 10px; border-radius: 4px; font-size: 13px; color: #6b7280;">
```

✅ **After:**
```html
<div id="discovery-info" class="discovery-info-panel" style="display: none; margin-bottom: 15px;">
```

### 8. **Analysis Result Panel**

❌ **Before:**
```html
<div id="analysisResult" style="display: none; margin-top: 30px; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
```

✅ **After:**
```html
<div id="analysisResult" class="analysis-result-panel" style="display: none; margin-top: 30px;">
```

---

## Priority Fixes in index.html

### High Priority (Breaking Dark Mode)
1. **Lines 59, 210, 209, 277, 281, 293**: Labels with `color: #374151` → use `.label` or `.text-primary-color`
2. **Lines 68, 74, 140, 192, 210, 234, 271**: Muted text with `color: #6b7280` → use `.text-muted`
3. **Line 139**: Analysis title `color: #667eea` → use `.text-brand`
4. **Line 140**: Close button → use `.close-btn`
5. **Line 192**: Discovery info div → use `.discovery-info-panel`
6. **Line 137**: Analysis result div → use `.analysis-result-panel`
7. **Line 58**: AI Model section → use `.section-bg`

### Medium Priority (Improving Consistency)
8. Info boxes in modal (lines 454+) → use `.info-box .info-box-*`
9. Helper text throughout → use `.helper-text`

---

## CSS Classes Available

### Text Utilities
- `.text-muted` - Gray text (#6b7280 → theme-aware)
- `.text-primary-color` - Dark text (#374151 → theme-aware)
- `.text-brand` - Brand purple (#667eea)
- `.helper-text` - Small gray helper text

### Component Classes
- `.label` - Form labels
- `.close-btn` - Close/dismiss buttons
- `.section-bg` - Light background sections
- `.discovery-info-panel` - Discovery status panel
- `.analysis-result-panel` - Analysis results container

### Info Boxes
- `.info-box` + `.info-box-blue/green/yellow/red` - Colored left-border boxes

---

## Benefits
✅ Dark mode works automatically  
✅ Consistent styling across app  
✅ Easy theme customization  
✅ Reduced code duplication  
✅ Better maintainability  
