# Form edit: chống live-reload & đổi dự án an toàn

Tài liệu nội bộ cho admin Next.js (`admin.vitravel.dev`).  
Đọc file này khi thêm trang form edit mới, sửa `ProjectSwitcher`, hoặc debug “form không cập nhật / lưu nhầm dự án”.

---

## 1. Hai yêu cầu cần cùng đúng

| Yêu cầu | Mô tả |
|---------|--------|
| **Chống ghi đè khi refetch** | Trên form edit, background refetch (focus tab, invalidate sau list…) **không** được đè nội dung user/AI đang sửa. |
| **Đổi dự án phải reload form** | User đổi dự án ở header **không rời URL** → form phải xóa data cũ và nạp data dự án mới. Không được lưu nhầm dự án A sang dự án B. |

Hai yêu cầu xung đột nếu chỉ dùng “không hydrate lại khi `query.data` đổi”. Giải pháp: **phân biệt ngữ cảnh** bằng `projectCode` trong hydration key + reset form khi project đổi.

---

## 2. Kiến trúc (3 lớp)

```
┌─────────────────────────────────────────────────────────────┐
│  ProjectSwitcher → setProjectCode() → formHydrationScope    │
│  (đồng bộ ngay, trước React re-render)                      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  useScopedQueryKey    beginFormHydration    useResetFormOnProjectChange
  (cache React Query   (key: project:entity   (xóa form ngay khi
   tách theo dự án)     :locale)              projectCode đổi)
```

### Lớp 1 — Hydration key có phạm vi dự án

**File:** `src/hooks/useFormHydration.ts`, `src/lib/formHydrationScope.ts`

Định dạng key:

```
{projectCode}:{entityKey}:{locale}
```

Ví dụ: `hihalong:site:vi`, `hidalat:42:en`.

- **Cùng dự án** + cùng entity + cùng locale → key không đổi → `beginFormHydration` trả `false` → **bỏ qua refetch** (bảo vệ nội dung AI đang sửa).
- **Đổi dự án** → key đổi → `beginFormHydration` trả `true` → hydrate lại từ server.

`projectCode` lấy từ `getFormHydrationProjectScope()` — module ref đồng bộ với `localStorage` qua `setProjectCode()` trong `src/lib/api.ts`.  
**Lý do không chỉ dùng `useAuth().projectCode` trong `beginFormHydration`:** `ProjectSwitcher` gọi `setProjectCode` đồng bộ trước khi React re-render; scope ref đảm bảo key đúng ngay lập tức.

### Lớp 2 — Query key theo dự án

**File:** `src/hooks/useScopedQueryKey.ts`

```ts
const detailQueryKey = useScopedQueryKey('company-profile-site', locale);
// → [projectCode, 'company-profile-site', locale]
```

React Query không trả cache của dự án trước khi refetch xong.  
API vẫn scope qua header `X-Project-Code`; query key chỉ để **tách cache phía client**.

### Lớp 3 — Reset form ngay khi đổi dự án

**File:** `src/hooks/useFormHydration.ts` → `useResetFormOnProjectChange`

Khi `projectCode` đổi:

1. `markFormHydrationStale(hydrateKeyRef)` — cho phép hydrate lại.
2. `onReset()` — `setForm(empty)`, cập nhật `snapshotRef`, remount editor nếu cần.

**Vì sao cần lớp 3:** Sau khi đổi dự án, query key mới → `query.data` tạm `undefined` nhưng `useState` form vẫn giữ giá trị cũ. Không reset → user có thể lưu data dự án cũ vào dự án mới.

---

## 3. Tắt live refetch trên form edit

**File:** `src/lib/editFormQuery.ts`

```ts
export const EDIT_FORM_QUERY_OPTIONS = {
  refetchOnWindowFocus: false,
  refetchInterval: false,
};
```

Spread vào `useQuery` của trang edit. List/dashboard giữ default trong `src/app/providers.tsx` (refetch on focus + interval).

**Không thay** `EDIT_FORM_QUERY_OPTIONS` thành bật refetch trên form — sẽ xung đột với hydration guard dù vẫn có key đúng.

---

## 4. Luồng đổi dự án (ProjectSwitcher)

**File:** `src/components/ui/ProjectSwitcher.tsx`

1. `setActiveProject(code)` → `setProjectCode(code)` → cập nhật `formHydrationScope` + React state.
2. `qc.invalidateQueries()` — refetch toàn bộ cache.
3. Toast “Đang xem: …”.

Trang edit **không navigate** — component vẫn mount. Ba lớp trên xử lý reload form.

**Auth context:** `src/lib/auth-context.tsx` — `projectCode`, `setActiveProject`.  
**Persistence:** `localStorage` key `vt_admin_project_code`.

---

## 5. API chính (reference nhanh)

### `beginFormHydration(ref, entityKey, locale?)`

Gọi trong `useEffect` khi có `query.data`:

```ts
useEffect(() => {
  if (!query.data) return;
  if (!beginFormHydration(hydrateKeyRef, 'site', locale)) return;
  // setForm(...) từ query.data
}, [query.data, locale]);
```

Trả `true` chỉ lần đầu mỗi key `(project, entity, locale)`.

### `markFormHydrationStale(ref)`

Gọi **sau save thành công** để lần fetch tiếp theo được hydrate lại (ví dụ sau khi server cập nhật field khác).

### `useResetFormOnProjectChange(ref, onReset)`

Bắt buộc trên mọi trang edit có state form local:

```ts
const resetForm = useCallback(() => {
  setForm(empty);
  snapshotRef.current = JSON.stringify(empty);
}, []);
useResetFormOnProjectChange(hydrateKeyRef, resetForm);
```

### `useScopedQueryKey(...parts)`

Dùng cho mọi `queryKey` của data **theo dự án** trên trang edit.

### `useHydrateFormOnce(data, entityKey, locale, hydrate)`

Helper effect (ít dùng). Đã có `projectCode` trong dependency array.

---

## 6. Checklist — thêm trang form edit mới

- [ ] `useQuery` detail: `queryKey: useScopedQueryKey('tên-logic', id, locale)` + `...EDIT_FORM_QUERY_OPTIONS` nếu là form edit.
- [ ] `const hydrateKeyRef = useRef<string | null>(null)`.
- [ ] `useEffect` hydrate: `beginFormHydration(hydrateKeyRef, id hoặc 'site', locale)` trước `setForm`.
- [ ] `useResetFormOnProjectChange` + `resetForm` về `empty` (và `snapshotRef`, remount editor nếu có TipTap/epoch).
- [ ] `onSuccess` save: `markFormHydrationStale(hydrateKeyRef)`.
- [ ] Form dùng pattern `dirty` thủ công (không qua `beginFormHydration`): **phải** reset state khi `projectCode` đổi (xem `settings/project/page.tsx`).

### Trang dùng `ResourceFormPage`

**File:** `src/components/admin/ResourceFormPage.tsx` — đã tích hợp đủ 3 lớp. Chỉ cần truyền `queryKey`, `empty`, `getFn`, …

### Form đặc biệt (editor epoch, cluster URL, v.v.)

- **Package / product có TipTap:** tăng `itineraryEditorEpoch` / `contentEditorEpoch` trong `resetForm`.
- **Product form:** reset về `{ ...empty, cluster: clusterFromUrl }`.
- **Listing hub:** `setListingEditorEpoch((n) => n + 1)` trong reset.

---

## 7. Trang đã áp dụng (2026-03)

| Nhóm | File |
|------|------|
| Cài đặt | `settings/site/page.tsx`, `settings/project/page.tsx`, `settings/hubs/[hubKey]/ListingHubForm.tsx` |
| Nội dung | `content/home/page.tsx`, `content/navigation/page.tsx`, `content/articles/form/page.tsx`, `content/slides/form/page.tsx` |
| Brand | `brand/company/page.tsx`, `brand/team/form/page.tsx`, `brand/reviews/form/page.tsx`, `brand/videos/form/page.tsx` |
| Tour / cruise | `tours/categories/form/page.tsx`, `tours/destinations/form/page.tsx`, `tours/themes/form/page.tsx`, `features/packages/PackageFormPage.tsx`, `cruises/types/form/page.tsx` |
| Dịch vụ | `services/products/form/page.tsx`, `services/categories/form/page.tsx` |
| Hệ thống | `settings/users/form/page.tsx`, `components/admin/ResourceFormPage.tsx` |

Khi thêm form mới: grep `beginFormHydration` và đối chiếu checklist §6.

---

## 8. Trường hợp đặc biệt: Bối cảnh AI dự án

**File:** `src/app/(dashboard)/settings/project/page.tsx`

Không dùng `useFormHydration`; dùng flag `dirty` để chặn hydrate khi user đang sửa.

Khi đổi dự án:

```ts
useEffect(() => {
  if (prevProjectRef.current === projectCode) return;
  prevProjectRef.current = projectCode;
  setDirty(false);
  setAiBrief('');
}, [projectCode]);
```

Query key đã có `currentProject?.code`. **Không** chỉ dựa vào `dirty` mà quên reset khi đổi project.

---

## 9. Không được phá (regression thường gặp)

| Sai | Hậu quả |
|-----|----------|
| Query key thiếu `useScopedQueryKey` trên form theo dự án | Flash / hiển thị cache dự án cũ |
| Có `beginFormHydration` nhưng thiếu `useResetFormOnProjectChange` | Form giữ data cũ trong lúc loading → lưu nhầm |
| Bỏ `projectCode` khỏi `formHydrationKey` | Đổi dự án không hydrate lại |
| Bật `refetchOnWindowFocus` trên form edit | Dễ ghi đè nếu hydration key sai hoặc thiếu reset |
| `invalidateQueries()` sau save nhưng quên `markFormHydrationStale` | Sau save, data server mới không vào form (đến khi đổi entity/locale/project) |

---

## 10. Debug nhanh

1. **Đổi dự án, form không đổi**  
   - Kiểm tra `useScopedQueryKey` trên query detail.  
   - Kiểm tra `useResetFormOnProjectChange` có gọi không.  
   - DevTools → `localStorage['vt_admin_project_code']` có đổi không.

2. **Refetch làm mất nội dung AI đang sửa (cùng dự án)**  
   - `beginFormHydration` có chạy và trả `false` lần 2 không (key phải giữ `project:entity:locale`).  
   - Query edit có `EDIT_FORM_QUERY_OPTIONS` không.

3. **Sau save form không cập nhật field từ server**  
   - Thiếu `markFormHydrationStale(hydrateKeyRef)` trong `onSuccess`.

---

## 11. File map

| File | Vai trò |
|------|---------|
| `src/lib/formHydrationScope.ts` | Module ref `currentProjectCode` |
| `src/lib/api.ts` | `setProjectCode` / `clearSession` → sync scope |
| `src/hooks/useFormHydration.ts` | `beginFormHydration`, `markFormHydrationStale`, `useResetFormOnProjectChange` |
| `src/lib/apiScope.ts` | `runWithProjectScope`, `isScopedQueryForProject` |
| `src/hooks/useScopedQueryKey.ts` | `useScopedQueryKey`, `createScopedQueryFn` |
| `src/lib/editFormQuery.ts` | `EDIT_FORM_QUERY_OPTIONS` |
| `src/components/ui/ProjectSwitcher.tsx` | UI đổi dự án + invalidate cache |
| `src/lib/auth-context.tsx` | State `projectCode` cho UI và `useScopedQueryKey` |

---

## 12. LocaleSwitcher — tránh nhảy layout

**Vấn đề:** Khi đổi dự án/trang, `languages` từ query form tạm `[]` → `LocaleSwitcher` return `null` → thanh tab biến mất rồi hiện lại.

**Giải pháp:**

| Thành phần | File | Vai trò |
|------------|------|---------|
| `useLanguagesOptions` | `src/hooks/useLanguagesOptions.ts` | Cache `/languages` theo dự án; `keepPreviousData` + `staleTime` 5 phút |
| `LocaleSwitcher` | `src/components/ui/LocaleSwitcher.tsx` | Fallback cache khi prop rỗng; `useStableLanguages` giữ tab cuối |
| `ProjectSwitcher` | `src/components/ui/ProjectSwitcher.tsx` | Không `invalidate` query `languages-options` (key mới tự fetch) |

`LocaleSwitcher` tự gọi `useLanguagesOptions` — trang vẫn có thể truyền `languages` từ API entity (ưu tiên khi có data).

---

## 13. Race condition khi đổi dự án nhanh

### Triệu chứng

Đổi dự án liên tục ở header → sau vài lần form hiển thị data dự án khác hoặc không cập nhật đúng.

### Nguyên nhân

| # | Lỗi | Hậu quả |
|---|-----|---------|
| 1 | `queryFn` gọi API đọc `getProjectCode()` **lúc fetch**, không phải lúc tạo query key | Response dự án D ghi vào cache slot dự án C |
| 2 | `setActiveProject` → `authApi.me()` không hủy request cũ | `applyProjects(me, codeCũ)` đặt lại project đã bỏ chọn |
| 3 | Hydrate form khi `query.data` tới nhưng không khớp `projectCode` hiện tại | Form nạp data lệch |

### Giải pháp

**`createScopedQueryFn`** (`src/hooks/useScopedQueryKey.ts`) — bọc mọi scoped `queryFn`:

```ts
queryFn: createScopedQueryFn(() => companyProfileApi.get(locale)),
```

Gắn `X-Project-Code` từ `queryKey[0]` qua `runWithProjectScope` (`src/lib/apiScope.ts`), không đọc localStorage lúc fetch.

**`shouldHydrateScopedQuery(queryKey, projectCode)`** — gọi trước `beginFormHydration` trong `useEffect`.

**`setActiveProject`** — generation counter (`projectSwitchGenRef`): response `me()` cũ bị bỏ qua; chỉ cập nhật `user`, không gọi `applyProjects` (tránh reset project).

**`ProjectSwitcher`** — `cancelQueries()` trước `invalidateQueries()` khi đổi dự án.

### Checklist bổ sung (cùng §6)

- [ ] Scoped query **bắt buộc** `createScopedQueryFn`, không `queryFn: () => api...` thuần.
- [ ] Hydrate effect có `shouldHydrateScopedQuery` + deps gồm `queryKey` và `projectCode`.

---

## 14. Liên quan docs khác

- Multi-project API / header: `vitravel.dev/docs/11-multi-project-architecture.md`
- Admin API tổng quan: `vitravel.dev/docs/10-admin-console-api.md`
- Deploy admin static: `vitravel.dev/docs/13-deploy-aapanel-vps.md`

---

*Cập nhật: 2026-03 — fix đổi dự án trên trang Thông tin dự án và đồng bộ toàn bộ form edit admin.*
