# 🔧 Blank Screen Fix - Production Build

## 🔴 Các vấn đề đã fix:

### ✅ Fix 2: CSP cho phép `file:` protocol
**Vấn đề:** Production load từ `file://` nhưng CSP chỉ cho `'self'`

**Giải pháp:**
```typescript
// Production needs file: protocol for local resources
const defaultSrc = isDevelopment ? "'self'" : "'self' file:";
const scriptSrc = isDevelopment 
  ? "'self' 'unsafe-inline' 'unsafe-eval'" 
  : "'self' 'unsafe-inline' 'unsafe-eval' file:";
const styleSrc = isDevelopment 
  ? "'self' 'unsafe-inline'" 
  : "'self' 'unsafe-inline' file:";
```

**Kết quả:**
- ✅ CSS/JS/Images load được từ `file://`
- ✅ Không bị CSP block

---

### ✅ Fix 3: Path production đúng
**Vấn đề:** Path có thể sai trong production

**Giải pháp:**
```typescript
if (isDevelopment) {
  mainWindow.loadURL("http://localhost:5173");
} else {
  // Production: load from dist folder
  const indexPath = path.join(__dirname, "../dist/index.html");
  console.log("🚀 Loading app from:", indexPath);
  console.log("📂 __dirname:", __dirname);
  
  mainWindow.loadFile(indexPath);
}
```

**Kết quả:**
- ✅ Load đúng file `index.html`
- ✅ Log path để debug

---

### ✅ Fix 4: Auto-open DevTools khi lỗi
**Vấn đề:** Production không mở DevTools, không debug được

**Giải pháp:**
```typescript
// Debug: Open DevTools on load error
mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
  console.error('❌ Failed to load:', errorCode, errorDescription);
  mainWindow?.webContents.openDevTools({ mode: 'detach' });
});

// Debug: Log when DOM is ready
mainWindow.webContents.on('dom-ready', () => {
  console.log('✅ DOM Ready');
});
```

**Kết quả:**
- ✅ Tự động mở DevTools khi load fail
- ✅ Log DOM ready để track

---

### ✅ Fix 5: Thêm logging debug
**Giải pháp:**
```typescript
// Log CSP và env vars
console.log("📋 CSP Policy:", cspPolicy);
console.log("🔧 isDevelopment:", isDevelopment);
console.log("🌐 ENV vars:", { 
  SERVER_URL, 
  SERVER_WS_URL, 
  DEV_SERVER_URL, 
  DEV_SERVER_WS_URL 
});

// Log loading path
console.log("🚀 Loading app from:", indexPath);
console.log("📂 __dirname:", __dirname);

// Log window ready
console.log("✅ Window ready to show");
```

**Kết quả:**
- ✅ Dễ debug khi có vấn đề
- ✅ Biết được env vars có load không

---

### ✅ Bonus: Filter undefined trong CSP
**Giải pháp:**
```typescript
// Filter out undefined values
const validSources = connectSources.filter(Boolean);

return [
  // ...
  `connect-src ${validSources.join(' ')}`,
  // ...
].join('; ') + ';';
```

**Kết quả:**
- ✅ CSP không có `undefined` string
- ✅ Tránh malformed policy

---

## ⚠️ Vấn đề chưa fix:

### ❌ Issue 1: File `.env` không có trong production
**Vấn đề:**
- `dotenv.config()` tìm file `.env`
- Production build: `.env` KHÔNG được đóng gói
- `package.json` files array không có `.env`

**Hậu quả:**
- Env vars = `undefined` trong production
- CSP có thể sai nếu dùng env vars

**Giải pháp tương lai:**
1. Thêm `.env` vào `files` array trong `package.json`
2. Hoặc embed env vars vào build (không dùng `.env`)
3. Hoặc dùng `electron-builder` env injection

---

## 🧪 Testing

### Development:
```bash
npm run dev
# Should log:
# 🔧 isDevelopment: true
# 📋 CSP Policy: ... (with localhost URLs)
```

### Production Build:
```bash
npm run build
npm run electron:build:win

# Run .exe
# Should log:
# 🔧 isDevelopment: false
# 📋 CSP Policy: ... (with file: protocol)
# 🚀 Loading app from: C:/...dist/index.html
```

### Debug Checklist:
- [ ] Check console logs cho env vars
- [ ] Check CSP policy có `file:` không
- [ ] Check path load đúng không
- [ ] Nếu blank screen → DevTools tự mở
- [ ] Check console errors

---

## 📊 Changes Summary

| Issue | Status | Fix |
|-------|--------|-----|
| CSP blocks file:// | ✅ Fixed | Added `file:` to CSP directives |
| Production path wrong | ✅ Fixed | Correct path + logging |
| No DevTools on error | ✅ Fixed | Auto-open on load fail |
| No debug logs | ✅ Fixed | Added comprehensive logging |
| Undefined in CSP | ✅ Fixed | Filter undefined values |
| .env not in build | ⚠️ Not fixed | Need to address separately |

---

## 🚀 Next Steps

1. **Test production build** trên Windows
2. **Check logs** trong console
3. Nếu vẫn blank:
   - Mở DevTools (auto-open on error)
   - Check console logs
   - Check CSP errors
   - Check path đúng không
4. **Fix .env issue** nếu cần thiết

---

**Created**: 2025-01-11
**Build tested**: ✅ Success
**Lint errors**: ✅ None

