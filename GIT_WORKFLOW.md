# Git Workflow - Split-Bill

Workflow ini bertujuan agar kolaborasi pada proyek Split-Bill terstruktur, aman, dan mudah diikuti oleh pengembang lain/pengguna yang ingin berkontribusi.

________________________________________________________________________

## Strategi Branching (Branching Strategy)

Kita menggunakan pendekatan **Feature Branching Workflow** untuk memastikan branch `main` selalu dalam kondisi stabil dan siap deploy.

### Jenis Branch:

- **`main`**: Branch utama yang berisi kode production-ready. Tidak ada commit langsung ke sini.
- **`develop`**: Branch integrasi untuk fitur-fitur yang sedang dikembangkan sebelum digabung ke `main`.
- **`feature/`**: Digunakan untuk pengembangan fitur baru. (Contoh: `feature/login-page`, `feature/ocr-receipt`)
- **`fix/`**: Digunakan untuk perbaikan bug. (Contoh: `fix/navbar-overlap`, `fix/currency-conversion`)
- **`refactor/`**: Digunakan untuk merapikan kode tanpa mengubah fungsionalitas. (Contoh: `refactor/api-helper`, `refactor/components-structure`)
- **`hotfix/`**: Digunakan untuk perbaikan darurat di production yang langsung di-merge ke `main`.

________________________________________________________________________

## Konvensi Pesan Commit (Commit Message Convention)

Gunakan standar **Conventional Commits** agar riwayat perubahan mudah dibaca oleh manusia maupun mesin.

### Format:

```
<tipe>(<scope>): <deskripsi singkat>

[opsional: body yang lebih detail]

[opsional: footer untuk breaking changes atau references]
```

### Jenis Type yang Sering Digunakan:

| Type | Deskripsi | Contoh |
|------|----------|--------|
| `feat` | Menambah fitur baru ke dalam kode | `feat(auth): add Google OAuth integration` |
| `fix` | Memperbaiki bug | `fix(bill): resolve calculation error for split amounts` |
| `docs` | Perubahan pada dokumentasi (README, dsb) | `docs: update installation steps in README` |
| `style` | Perubahan yang tidak mempengaruhi makna kode (formatting, missing semi-colons, dsb) | `style: fix indentation in BillForm component` |
| `refactor` | Perubahan kode yang bukan memperbaiki bug maupun menambah fitur | `refactor(api): extract common request handler` |
| `test` | Menambah atau memperbaiki test yang sudah ada | `test: add unit tests for currency conversion` |
| `chore` | Pembaruan tugas build, konfigurasi package manager, dsb | `chore: update dependencies to latest versions` |
| `perf` | Perubahan yang meningkatkan performa | `perf: optimize image processing for OCR` |

### Contoh yang Benar:

```bash
feat(ui): add responsive sidebar for mobile
fix(auth): fix token expiration logic
docs: update installation steps in README
refactor(bill): simplify split calculation logic
test(ocr): add tests for receipt parsing
```

### Scope yang Sering Digunakan di Split-Bill:

- `auth` - Sistem autentikasi
- `bill` - Fitur tagihan dan pembagian
- `ocr` - Optical Character Recognition untuk struk
- `ui` - Komponen user interface
- `api` - API routes dan handlers
- `db` - Database operations
- `utils` - Helper functions dan utilities

________________________________________________________________________

## Alur Kerja (Standard Workflow)

### 1. Sinkronisasi Branch Lokal

Pastikan branch lokal kamu selalu up-to-date dengan repositori pusat (upstream).

```bash
# Switch ke branch develop
git checkout develop

# Pull perubahan terbaru dari remote
git pull origin develop

# Pastikan juga branch main up-to-date
git checkout main
git pull origin main
```

### 2. Buat Branch Baru

Gunakan penamaan yang deskriptif dan ikuti konvensi yang sudah ditetapkan.

```bash
# Dari branch develop, buat branch fitur baru
git checkout develop
git pull origin develop
git checkout -b feature/nama-fitur

# Contoh:
git checkout -b feature/ocr-receipt-upload
git checkout -b fix/currency-display-bug
git checkout -b refactor/bill-calculation-logic
```

### 3. Lakukan Commit secara Atomik

Artinya, satu commit sebaiknya hanya mencakup satu tugas atau satu konteks perubahan saja.

```bash
# Add file yang sudah diubah
git add .

# Commit dengan pesan yang jelas
git commit -m "feat(ocr): add receipt image upload functionality"

# Atau untuk perubahan kecil
git commit -m "fix(ui): resolve navbar overlap on mobile"
```

### 4. Push ke Remote

```bash
# Push branch ke remote repository
git push origin feature/nama-fitur

# Jika pertama kali push branch baru
git push -u origin feature/nama-fitur
```

### 5. Buat Pull Request (PR)

Buka Pull Request ke branch `develop` dengan deskripsi yang jelas mengenai:
- Apa yang diubah?
- Bagaimana cara mencobanya?
- Apakah ada breaking changes?

#### Sebelum membuat PR, pastikan:

1. **Branch develop lokal sudah terbaru** agar tidak terjadi konflik:

```bash
git checkout develop
git pull origin develop
git checkout feature/nama-fitur
git rebase develop
```

2. **Pastikan Perubahan Sudah Lengkap & Bersih**:

   - ✅ Tidak ada error build
   - ✅ Tidak ada console error
   - ✅ Tidak ada file tidak terpakai
   - ✅ Sudah mengikuti coding standard (ESLint, Prettier)
   - ✅ Commit message sudah sesuai Conventional Commits
   - ✅ Tidak ada `console.log` atau kode debugging
   - ✅ Tidak ada credential sensitif

3. **Push Branch ke Remote Repository** jika belum di push:

```bash
git push origin feature/nama-fitur
```

#### Membuat Pull Request di GitHub:

1. Buka repository Split-Bill di GitHub
2. Akan muncul notifikasi "Compare & pull request" → klik
   *(atau buka tab Pull Requests → New Pull Request)*
3. Atur target branch:
   - **Base**: `develop`
   - **Compare**: `feature/nama-fitur`
4. Isi Deskripsi Pull Request. Gunakan format:

```markdown
## Deskripsi
Jelaskan secara singkat apa yang diubah dalam PR ini.

## Cara Mencoba
1. ...
2. ...
3. ...

## Perubahan
- [ ] Fitur baru: ...
- [ ] Perbaikan bug: ...
- [ ] Refactor: ...

## Checklist
- [ ] Code sudah di-review
- [ ] Testing sudah dilakukan
- [ ] Documentation sudah diperbarui (jika perlu)
- [ ] Tidak ada breaking changes (atau sudah di-documentasikan)
```

5. Sebelum submit PR, baca ulang diff code di tab **Files changed**. Pastikan tidak ada:
   - `console.log`, `debugger`, atau kode eksperimen
   - Credential sensitif (API keys, passwords)
   - File yang tidak seharusnya di-commit

6. **Create Pull Request**

### 6. Review dan Merge

#### Jika ada revisi:

```bash
# Lakukan perubahan yang diperlukan
git add .
git commit -m "fix(pr): address reviewer feedback on navbar alignment"
git push origin feature/nama-fitur
```

#### Untuk Merge Pull Request:

1. Gunakan **Squash and Merge** (disarankan)
2. Pastikan commit message tetap sesuai standar
3. Jika ingin hapus branch setelah merge, centang opsi tersebut

#### Hapus Branch Setelah Merge:

```bash
# Hapus branch lokal
git branch -d feature/nama-fitur

# Hapus branch remote
git push origin --delete feature/nama-fitur
```

________________________________________________________________________

## Aturan Tambahan (Golden Rules)

### 🚫 **JANGAN PERNAH** Force Push ke branch publik
```bash
# JANGAN LAKUKAN INI ke main atau develop!
git push -f origin main
git push -f origin develop
```
Kecuali dalam keadaan darurat yang sudah disepakati tim.

### 👥 **Review Sebelum Merge**
- Minimal satu orang rekan tim harus meninjau kode sebelum PR digabungkan
- Gunakan fitur **Request Reviewers** di GitHub
- Responsif terhadap feedback dari reviewer

### 🧹 **Hapus Branch Setelah Merge**
- Segera hapus branch fitur setelah berhasil di-merge
- Ini menjaga repository tetap rapi dan mudah dinavigasi

### 📝 **Tulis Deskripsi yang Jelas**
- Hindari pesan commit seperti "update", "fix", atau "coba-coba"
- Gunakan format Conventional Commits yang sudah ditetapkan
- Berikan konteks yang cukup untuk pengembang lain

### 🔄 **Sync Sebelum Mulai**
Selalu mulai dengan branch yang up-to-date:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/fitur-baru
```

### 🧪 **Testing adalah Wajib**
- Pastikan fitur yang dibuat sudah di-test
- Untuk UI, test di berbagai ukuran layar
- Untuk API, test dengan berbagai input scenarios

### 📚 **Dokumentasi**
- Update README jika ada perubahan besar
- Tambahkan komentar untuk kode yang kompleks
- Update changelog untuk fitur baru

________________________________________________________________________

## Commands Cheat Sheet

### Sehari-hari:
```bash
# Mulai fitur baru
git checkout develop && git pull origin develop && git checkout -b feature/nama-fitur

# Commit dengan pesan standar
git add . && git commit -m "feat(scope): deskripsi perubahan"

# Push branch baru
git push -u origin feature/nama-fitur

# Sync dengan develop
git checkout develop && git pull origin develop && git checkout feature/nama-fitur && git rebase develop
```

### Cleanup:
```bash
# Hapus branch yang sudah di-merge
git branch -d feature/nama-fitur && git push origin --delete feature/nama-fitur

# Cleanup branch lokal yang tidak ada di remote
git remote prune origin
```

### Darurat:
```bash
# Undo commit terakhir (tapi keep changes)
git reset --soft HEAD~1

# Undo commit terakhir (discard changes)
git reset --hard HEAD~1

# Stash changes sementara
git stash && git checkout develop && git pull && git checkout feature/nama-fitur && git stash pop
```

________________________________________________________________________

## Troubleshooting

### Konflik Merge:
```bash
# Saat rebase dengan develop
git rebase develop
# Fix conflicts manually
git add .
git rebase --continue
# Atau abort rebase
git rebase --abort
```

### Force Push yang Aman (hanya untuk branch fitur):
```bash
# Hanya untuk branch feature yang belum di-review
git push --force-with-lease origin feature/nama-fitur
```

### Melihat History:
```bash
# Lihat commit yang rapi
git log --oneline --graph --decorate

# Lihat perubahan di file tertentu
git log -p --follow path/to/file.tsx
```

________________________________________________________________________

**Selamat berkoding! 🚀**

Jika ada pertanyaan tentang workflow ini, jangan ragu untuk bertanya di team discussion atau buat issue di GitHub.
